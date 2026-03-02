import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servico para calcular campos automaticos (formula, rollup, timer, sla-status)
 */

// Interfaces para configuracao de campos
interface FormulaConfig {
  expression: string;
  dependsOn: string[];
  outputType: 'number' | 'text' | 'date';
  decimalPlaces?: number;
}

interface RollupConfig {
  sourceField: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  targetField?: string;
  filterConditions?: Array<{ field: string; operator: string; value: unknown }>;
}

interface TimerConfig {
  autoStartOnStatus?: string[];
  autoPauseOnStatus?: string[];
  autoStopOnStatus?: string[];
  displayFormat?: 'hours' | 'days' | 'business-hours';
  businessHoursOnly?: boolean;
}

interface TimerValue {
  totalSeconds: number;
  isRunning: boolean;
  lastStartedAt?: string;
  segments: Array<{
    startedAt: string;
    endedAt?: string;
    seconds: number;
  }>;
}

interface SlaStatusConfig {
  referenceField: string;
  targetField?: string;
  slaRules: Array<{
    condition?: Record<string, unknown>;
    targetMinutes: number;
    warningPercent?: number;
  }>;
  businessHoursOnly?: boolean;
  pauseOnStatus?: string[];
}

interface BusinessHoursConfig {
  timezone: string;
  schedule: Record<string, { start: string; end: string } | null>;
}

interface EntityField {
  slug: string;
  name: string;
  type: string;
  formulaConfig?: FormulaConfig;
  rollupConfig?: RollupConfig;
  timerConfig?: TimerConfig;
  slaConfig?: SlaStatusConfig;
  workflowConfig?: {
    statuses: Array<{ value: string; label: string; color: string; isFinal?: boolean; isInitial?: boolean }>;
    transitions: Array<{ from: string | string[]; to: string }>;
  };
}

@Injectable()
export class ComputedFieldsService {
  private readonly logger = new Logger(ComputedFieldsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Processa todos os campos calculados de um registro
   */
  async processComputedFields(
    data: Record<string, unknown>,
    fields: EntityField[],
    entityId: string,
    tenantId: string,
    recordId?: string,
    previousData?: Record<string, unknown>,
    entitySettings?: { slaConfig?: { businessHours?: BusinessHoursConfig } },
  ): Promise<Record<string, unknown>> {
    const result = { ...data };

    for (const field of fields) {
      try {
        switch (field.type) {
          case 'formula':
            if (field.formulaConfig) {
              result[field.slug] = this.calculateFormula(result, field.formulaConfig);
            }
            break;

          case 'rollup':
            if (field.rollupConfig && recordId) {
              result[field.slug] = await this.calculateRollup(
                recordId,
                field.rollupConfig,
                tenantId,
              );
            }
            break;

          case 'timer':
            if (field.timerConfig) {
              result[field.slug] = this.processTimer(
                result[field.slug] as TimerValue | undefined,
                result,
                previousData,
                field.timerConfig,
                fields,
              );
            }
            break;

          case 'sla-status':
            if (field.slaConfig) {
              result[field.slug] = this.calculateSlaStatus(
                result,
                field.slaConfig,
                entitySettings?.slaConfig?.businessHours,
              );
            }
            break;
        }
      } catch (err) {
        const error = err as Error;
        this.logger.warn(`Erro ao calcular campo ${field.slug}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Calcula o valor de um campo formula
   * Suporta operacoes matematicas basicas: +, -, *, /, ()
   * Placeholders: {{fieldSlug}}
   */
  calculateFormula(
    data: Record<string, unknown>,
    config: FormulaConfig,
  ): unknown {
    let expression = config.expression;

    // Substituir placeholders por valores
    for (const fieldSlug of config.dependsOn) {
      const value = data[fieldSlug];
      const numValue = typeof value === 'number' ? value : parseFloat(String(value || '0')) || 0;
      expression = expression.replace(new RegExp(`\\{\\{\\s*${fieldSlug}\\s*\\}\\}`, 'g'), String(numValue));
    }

    try {
      // Avaliar expressao matematica de forma segura
      // Apenas permite numeros, operadores e parenteses
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
      if (sanitized !== expression.replace(/\s/g, '')) {
        this.logger.warn(`Formula contem caracteres invalidos: ${expression}`);
        return null;
      }

      // Usar Function para avaliar (mais seguro que eval)
      const result = new Function(`return ${sanitized}`)();

      if (config.outputType === 'number') {
        const num = parseFloat(result);
        if (isNaN(num)) return null;
        if (config.decimalPlaces !== undefined) {
          return parseFloat(num.toFixed(config.decimalPlaces));
        }
        return num;
      }

      if (config.outputType === 'text') {
        return String(result);
      }

      return result;
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Erro ao avaliar formula: ${expression} - ${error.message}`);
      return null;
    }
  }

  /**
   * Calcula o valor de um campo rollup (agregacao de sub-entidade)
   */
  async calculateRollup(
    parentRecordId: string,
    config: RollupConfig,
    tenantId: string,
  ): Promise<number | null> {
    try {
      // Buscar sub-registros
      const childRecords = await this.prisma.entityData.findMany({
        where: {
          parentRecordId,
          tenantId,
        },
        select: {
          data: true,
        },
      });

      if (childRecords.length === 0) {
        return config.aggregation === 'count' ? 0 : null;
      }

      // Aplicar filtros se configurados
      let filteredRecords = childRecords;
      if (config.filterConditions && config.filterConditions.length > 0) {
        filteredRecords = childRecords.filter(record => {
          const data = record.data as Record<string, unknown>;
          return config.filterConditions!.every(condition => {
            const fieldValue = data[condition.field];
            switch (condition.operator) {
              case 'equals': return fieldValue === condition.value;
              case 'not_equals': return fieldValue !== condition.value;
              case 'gt': return Number(fieldValue) > Number(condition.value);
              case 'gte': return Number(fieldValue) >= Number(condition.value);
              case 'lt': return Number(fieldValue) < Number(condition.value);
              case 'lte': return Number(fieldValue) <= Number(condition.value);
              case 'contains': return String(fieldValue || '').includes(String(condition.value));
              default: return true;
            }
          });
        });
      }

      // Calcular agregacao
      switch (config.aggregation) {
        case 'count':
          return filteredRecords.length;

        case 'sum': {
          if (!config.targetField) return null;
          const sum = filteredRecords.reduce((acc, record) => {
            const data = record.data as Record<string, unknown>;
            const value = parseFloat(String(data[config.targetField!] || 0)) || 0;
            return acc + value;
          }, 0);
          return sum;
        }

        case 'avg': {
          if (!config.targetField) return null;
          const values = filteredRecords.map(record => {
            const data = record.data as Record<string, unknown>;
            return parseFloat(String(data[config.targetField!] || 0)) || 0;
          });
          if (values.length === 0) return null;
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          return parseFloat(avg.toFixed(2));
        }

        case 'min': {
          if (!config.targetField) return null;
          const values = filteredRecords.map(record => {
            const data = record.data as Record<string, unknown>;
            return parseFloat(String(data[config.targetField!] || 0)) || 0;
          });
          if (values.length === 0) return null;
          return Math.min(...values);
        }

        case 'max': {
          if (!config.targetField) return null;
          const values = filteredRecords.map(record => {
            const data = record.data as Record<string, unknown>;
            return parseFloat(String(data[config.targetField!] || 0)) || 0;
          });
          if (values.length === 0) return null;
          return Math.max(...values);
        }

        default:
          return null;
      }
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Erro ao calcular rollup: ${error.message}`);
      return null;
    }
  }

  /**
   * Processa o campo timer baseado em mudancas de status
   */
  processTimer(
    currentTimer: TimerValue | undefined,
    data: Record<string, unknown>,
    previousData: Record<string, unknown> | undefined,
    config: TimerConfig,
    fields: EntityField[],
  ): TimerValue {
    const now = new Date();
    const timer: TimerValue = currentTimer || {
      totalSeconds: 0,
      isRunning: false,
      segments: [],
    };

    // Encontrar campo de workflow-status
    const workflowField = fields.find(f => f.type === 'workflow-status');
    if (!workflowField) return timer;

    const currentStatus = data[workflowField.slug] as string | undefined;
    const previousStatus = previousData?.[workflowField.slug] as string | undefined;

    // Se status nao mudou, apenas atualizar tempo se estiver rodando
    if (currentStatus === previousStatus) {
      if (timer.isRunning && timer.lastStartedAt) {
        const lastStarted = new Date(timer.lastStartedAt);
        const elapsedSeconds = Math.floor((now.getTime() - lastStarted.getTime()) / 1000);

        // Atualizar ultimo segmento
        if (timer.segments.length > 0) {
          const lastSegment = timer.segments[timer.segments.length - 1];
          if (!lastSegment.endedAt) {
            lastSegment.seconds = elapsedSeconds;
          }
        }

        // Recalcular total
        timer.totalSeconds = timer.segments.reduce((sum, seg) => sum + seg.seconds, 0);
      }
      return timer;
    }

    // Status mudou - verificar acoes

    // Auto-start
    if (config.autoStartOnStatus?.includes(currentStatus || '') && !timer.isRunning) {
      timer.isRunning = true;
      timer.lastStartedAt = now.toISOString();
      timer.segments.push({
        startedAt: now.toISOString(),
        seconds: 0,
      });
      this.logger.debug(`Timer started on status: ${currentStatus}`);
    }

    // Auto-pause
    if (config.autoPauseOnStatus?.includes(currentStatus || '') && timer.isRunning) {
      timer.isRunning = false;

      // Finalizar ultimo segmento
      if (timer.segments.length > 0) {
        const lastSegment = timer.segments[timer.segments.length - 1];
        if (!lastSegment.endedAt && timer.lastStartedAt) {
          lastSegment.endedAt = now.toISOString();
          const lastStarted = new Date(timer.lastStartedAt);
          lastSegment.seconds = Math.floor((now.getTime() - lastStarted.getTime()) / 1000);
        }
      }

      // Recalcular total
      timer.totalSeconds = timer.segments.reduce((sum, seg) => sum + seg.seconds, 0);
      timer.lastStartedAt = undefined;
      this.logger.debug(`Timer paused on status: ${currentStatus}`);
    }

    // Auto-stop (finaliza permanentemente)
    if (config.autoStopOnStatus?.includes(currentStatus || '') && timer.isRunning) {
      timer.isRunning = false;

      // Finalizar ultimo segmento
      if (timer.segments.length > 0) {
        const lastSegment = timer.segments[timer.segments.length - 1];
        if (!lastSegment.endedAt && timer.lastStartedAt) {
          lastSegment.endedAt = now.toISOString();
          const lastStarted = new Date(timer.lastStartedAt);
          lastSegment.seconds = Math.floor((now.getTime() - lastStarted.getTime()) / 1000);
        }
      }

      // Recalcular total
      timer.totalSeconds = timer.segments.reduce((sum, seg) => sum + seg.seconds, 0);
      timer.lastStartedAt = undefined;
      this.logger.debug(`Timer stopped on status: ${currentStatus}`);
    }

    return timer;
  }

  /**
   * Calcula o status do SLA
   */
  calculateSlaStatus(
    data: Record<string, unknown>,
    config: SlaStatusConfig,
    businessHours?: BusinessHoursConfig,
  ): 'on-track' | 'warning' | 'breached' | 'paused' {
    const now = new Date();

    // Verificar se esta em status de pausa
    if (config.pauseOnStatus && config.pauseOnStatus.length > 0) {
      // Procurar campo de status nos dados
      for (const key of Object.keys(data)) {
        const value = data[key];
        if (typeof value === 'string' && config.pauseOnStatus.includes(value)) {
          return 'paused';
        }
      }
    }

    // Obter data de referencia
    const referenceValue = data[config.referenceField];
    if (!referenceValue) return 'on-track';

    const referenceDate = new Date(String(referenceValue));
    if (isNaN(referenceDate.getTime())) return 'on-track';

    // Encontrar regra de SLA aplicavel
    let targetMinutes = 0;
    let warningPercent = 80;

    for (const rule of config.slaRules) {
      // Verificar condicao
      if (rule.condition) {
        const matches = Object.entries(rule.condition).every(([field, expectedValue]) => {
          return data[field] === expectedValue;
        });
        if (!matches) continue;
      }

      targetMinutes = rule.targetMinutes;
      warningPercent = rule.warningPercent || 80;
      break;
    }

    if (targetMinutes === 0) return 'on-track';

    // Calcular tempo decorrido
    let elapsedMinutes: number;

    if (config.businessHoursOnly && businessHours) {
      elapsedMinutes = this.calculateBusinessMinutes(referenceDate, now, businessHours);
    } else {
      elapsedMinutes = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60));
    }

    // Determinar status
    const percentUsed = (elapsedMinutes / targetMinutes) * 100;

    if (percentUsed >= 100) {
      return 'breached';
    }

    if (percentUsed >= warningPercent) {
      return 'warning';
    }

    return 'on-track';
  }

  /**
   * Calcula minutos em horario comercial entre duas datas
   */
  private calculateBusinessMinutes(
    start: Date,
    end: Date,
    businessHours: BusinessHoursConfig,
  ): number {
    let totalMinutes = 0;
    const current = new Date(start);

    while (current < end) {
      const dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'long', timeZone: businessHours.timezone }).toLowerCase();
      const daySchedule = businessHours.schedule[dayOfWeek];

      if (daySchedule) {
        const [startHour, startMin] = daySchedule.start.split(':').map(Number);
        const [endHour, endMin] = daySchedule.end.split(':').map(Number);

        const dayStart = new Date(current);
        dayStart.setHours(startHour, startMin, 0, 0);

        const dayEnd = new Date(current);
        dayEnd.setHours(endHour, endMin, 0, 0);

        // Ajustar para limites do periodo
        const effectiveStart = current > dayStart ? current : dayStart;
        const effectiveEnd = end < dayEnd ? end : dayEnd;

        if (effectiveStart < effectiveEnd) {
          totalMinutes += Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60));
        }
      }

      // Avancar para o proximo dia
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }

    return totalMinutes;
  }
}
