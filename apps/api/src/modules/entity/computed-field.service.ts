import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ComputedFieldService {
  private readonly logger = new Logger(ComputedFieldService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Avalia uma fórmula substituindo placeholders pelos valores
   * Ex: "{{price}} * {{quantity}}" com {price: 10, quantity: 5} = 50
   */
  evaluateFormula(
    formula: string,
    data: Record<string, unknown>,
  ): number | null {
    try {
      // Substituir placeholders {{field}} pelos valores
      let expression = formula;
      const placeholderRegex = /\{\{(\w+)\}\}/g;
      const matches = formula.matchAll(placeholderRegex);

      for (const match of matches) {
        const fieldKey = match[1];
        const value = data[fieldKey];

        // Converter para número ou usar 0 se inválido
        const numericValue = typeof value === 'number' ? value : 0;
        expression = expression.replace(match[0], String(numericValue));
      }

      // Avaliar expressão matemática de forma segura
      // NOTA: eval() é perigoso - em produção usar lib como mathjs
      const result = eval(expression);
      return typeof result === 'number' ? result : null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Erro ao avaliar fórmula "${formula}": ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Avalia um rollup (agregação de registros relacionados)
   * Ex: COUNT de "tasks" relacionados a este "project"
   */
  async evaluateRollup(
    relatedEntitySlug: string,
    relatedField: string,
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max',
    parentRecordId: string,
    tenantId: string,
  ): Promise<number | null> {
    try {
      // Buscar entidade relacionada
      const relatedEntity = await this.prisma.entity.findFirst({
        where: { slug: relatedEntitySlug, tenantId },
      });

      if (!relatedEntity) {
        this.logger.warn(
          `Entidade relacionada ${relatedEntitySlug} não encontrada`,
        );
        return null;
      }

      // Buscar registros relacionados
      // NOTA: Assumindo que relacionamento é via campo no registro filho
      const relatedRecords = await this.prisma.entityData.findMany({
        where: {
          entityId: relatedEntity.id,
          tenantId,
          // NOTA: Query JSON no Prisma é limitada
          // Idealmente usar raw SQL com operadores JSON
        },
      });

      // Filtrar registros que referenciam o pai
      const filteredRecords = relatedRecords.filter((record) => {
        const recordData = record.data as Record<string, unknown>;
        // Procurar qualquer campo que contenha o parentRecordId
        return Object.values(recordData).some((value) => {
          if (Array.isArray(value)) {
            return value.includes(parentRecordId);
          }
          return value === parentRecordId;
        });
      });

      if (aggregation === 'count') {
        return filteredRecords.length;
      }

      // Para sum, avg, min, max - extrair valores do campo especificado
      const values = filteredRecords
        .map((record) => {
          const recordData = record.data as Record<string, unknown>;
          const value = recordData[relatedField];
          return typeof value === 'number' ? value : null;
        })
        .filter((v) => v !== null) as number[];

      if (values.length === 0) return null;

      switch (aggregation) {
        case 'sum':
          return values.reduce((sum, v) => sum + v, 0);
        case 'avg':
          return values.reduce((sum, v) => sum + v, 0) / values.length;
        case 'min':
          return Math.min(...values);
        case 'max':
          return Math.max(...values);
        default:
          return null;
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Erro ao avaliar rollup ${relatedEntitySlug}.${relatedField}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Calcula timer (diferença entre duas datas em horas/dias)
   */
  calculateTimer(
    startField: string,
    endField: string,
    data: Record<string, unknown>,
  ): number | null {
    try {
      const startValue = data[startField];
      const endValue = data[endField];

      if (!startValue) return null;

      const startDate = new Date(startValue as string);
      const endDate = endValue ? new Date(endValue as string) : new Date();

      if (isNaN(startDate.getTime())) return null;
      if (endValue && isNaN(endDate.getTime())) return null;

      // Retornar diferença em horas
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      return Math.round(diffHours * 100) / 100; // 2 casas decimais
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Erro ao calcular timer ${startField}-${endField}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Calcula status de SLA (on-time, warning, overdue)
   */
  calculateSLAStatus(
    deadlineField: string,
    warningHours: number,
    data: Record<string, unknown>,
  ): 'on-time' | 'warning' | 'overdue' | null {
    try {
      const deadlineValue = data[deadlineField];
      if (!deadlineValue) return null;

      const deadline = new Date(deadlineValue as string);
      if (isNaN(deadline.getTime())) return null;

      const now = new Date();
      const diffMs = deadline.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 0) {
        return 'overdue'; // Passou do prazo
      } else if (diffHours < warningHours) {
        return 'warning'; // Próximo do prazo
      } else {
        return 'on-time'; // No prazo
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Erro ao calcular SLA status para ${deadlineField}: ${err.message}`,
      );
      return null;
    }
  }
}
