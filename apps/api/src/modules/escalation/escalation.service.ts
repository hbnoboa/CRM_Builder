import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ActionChainService } from '../action-chain/action-chain.service';
import { Prisma } from '@prisma/client';

/**
 * Configuracao de regras de escalacao
 * Definidas em entity.settings.escalation
 */
interface EscalationRule {
  id: string;
  name: string;
  condition: {
    slaBreached?: boolean;
    minutesWithoutUpdate?: number;
    statusIn?: string[];
    priorityIn?: string[];
  };
  actions: EscalationAction[];
  cooldownMinutes?: number; // Tempo minimo entre escalacoes do mesmo registro
}

interface EscalationAction {
  type: 'notify' | 'reassign' | 'change-priority' | 'change-status' | 'webhook' | 'action-chain';
  config: Record<string, unknown>;
}

interface EscalationSettings {
  enabled: boolean;
  checkIntervalMinutes?: number;
  rules: EscalationRule[];
}

interface EntitySettings {
  escalation?: EscalationSettings;
  slaConfig?: {
    businessHours?: {
      timezone: string;
      schedule: Record<string, { start: string; end: string } | null>;
    };
  };
}

interface EscalationLog {
  recordId: string;
  ruleId: string;
  escalatedAt: Date;
}

@Injectable()
export class EscalationService implements OnModuleInit {
  private readonly logger = new Logger(EscalationService.name);
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  // Cache de escalacoes recentes para cooldown
  private recentEscalations: Map<string, EscalationLog[]> = new Map();

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private actionChainService: ActionChainService,
  ) {}

  onModuleInit() {
    // Inicia verificacao periodica de escalacoes
    this.startEscalationChecker();
  }

  private startEscalationChecker() {
    // Verificar a cada 5 minutos por padrao
    const intervalMs = 5 * 60 * 1000;

    this.checkInterval = setInterval(() => {
      this.checkAllEscalations().catch((error) => {
        this.logger.error(`Erro na verificacao de escalacoes: ${error.message}`);
      });
    }, intervalMs);

    // Executar imediatamente na inicializacao
    this.checkAllEscalations().catch((error) => {
      this.logger.error(`Erro na inicializacao de escalacoes: ${error.message}`);
    });
  }

  /**
   * Verifica escalacoes para todas as entidades com regras configuradas
   */
  private async checkAllEscalations() {
    // Buscar entidades com escalacao habilitada
    const entities = await this.prisma.entity.findMany({
      where: {
        settings: {
          path: ['escalation', 'enabled'],
          equals: true,
        },
      },
    });

    for (const entity of entities) {
      await this.checkEntityEscalations(entity).catch((error) => {
        this.logger.error(`Erro ao verificar escalacoes da entidade ${entity.slug}: ${error.message}`);
      });
    }
  }

  /**
   * Verifica escalacoes para uma entidade especifica
   */
  private async checkEntityEscalations(entity: { id: string; tenantId: string; slug: string; settings: Prisma.JsonValue }) {
    const settings = entity.settings as EntitySettings | null;
    if (!settings?.escalation?.enabled || !settings.escalation.rules?.length) {
      return;
    }

    const rules = settings.escalation.rules;

    // Buscar registros ativos da entidade
    const records = await this.prisma.entityData.findMany({
      where: {
        entityId: entity.id,
        deletedAt: null,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    for (const record of records) {
      const recordData = record.data as Record<string, unknown>;

      for (const rule of rules) {
        // Verificar cooldown
        if (this.isInCooldown(record.id, rule.id, rule.cooldownMinutes)) {
          continue;
        }

        // Avaliar condicoes
        const shouldEscalate = await this.evaluateConditions(
          rule.condition,
          record,
          recordData,
          settings,
        );

        if (shouldEscalate) {
          await this.executeEscalation(rule, record, recordData, entity);
        }
      }
    }
  }

  /**
   * Verifica se o registro esta em cooldown para uma regra
   */
  private isInCooldown(recordId: string, ruleId: string, cooldownMinutes?: number): boolean {
    if (!cooldownMinutes) return false;

    const key = `${recordId}:${ruleId}`;
    const logs = this.recentEscalations.get(key) || [];
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const now = Date.now();

    // Limpar logs antigos
    const recentLogs = logs.filter((log) => now - log.escalatedAt.getTime() < cooldownMs);
    this.recentEscalations.set(key, recentLogs);

    return recentLogs.length > 0;
  }

  /**
   * Registra uma escalacao no cache de cooldown
   */
  private recordEscalation(recordId: string, ruleId: string) {
    const key = `${recordId}:${ruleId}`;
    const logs = this.recentEscalations.get(key) || [];
    logs.push({ recordId, ruleId, escalatedAt: new Date() });
    this.recentEscalations.set(key, logs);
  }

  /**
   * Avalia as condicoes de uma regra de escalacao
   */
  private async evaluateConditions(
    condition: EscalationRule['condition'],
    record: { id: string; updatedAt: Date; data: Prisma.JsonValue },
    recordData: Record<string, unknown>,
    settings: EntitySettings,
  ): Promise<boolean> {
    // Verificar SLA breach
    if (condition.slaBreached !== undefined) {
      const slaStatus = recordData['sla_status'] || recordData['slaStatus'];
      const isBreached = slaStatus === 'breached';
      if (condition.slaBreached !== isBreached) {
        return false;
      }
    }

    // Verificar tempo sem atualizacao
    if (condition.minutesWithoutUpdate !== undefined) {
      const lastUpdate = record.updatedAt;
      const minutesSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60));
      if (minutesSinceUpdate < condition.minutesWithoutUpdate) {
        return false;
      }
    }

    // Verificar status
    if (condition.statusIn && condition.statusIn.length > 0) {
      const status = recordData['status'] || recordData['workflow_status'] || recordData['workflowStatus'];
      if (!condition.statusIn.includes(String(status))) {
        return false;
      }
    }

    // Verificar prioridade
    if (condition.priorityIn && condition.priorityIn.length > 0) {
      const priority = recordData['priority'] || recordData['prioridade'];
      if (!condition.priorityIn.includes(String(priority))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Executa as acoes de escalacao
   */
  private async executeEscalation(
    rule: EscalationRule,
    record: { id: string; tenantId: string; createdBy: { id: string; name: string; email: string } | null },
    recordData: Record<string, unknown>,
    entity: { id: string; tenantId: string; slug: string },
  ) {
    this.logger.log(`Executando escalacao "${rule.name}" para registro ${record.id}`);

    for (const action of rule.actions) {
      try {
        await this.executeAction(action, record, recordData, entity);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Erro ao executar acao de escalacao: ${err.message}`);
      }
    }

    // Registrar escalacao para cooldown
    this.recordEscalation(record.id, rule.id);

    // Log de auditoria
    await this.prisma.auditLog.create({
      data: {
        tenantId: entity.tenantId,
        action: 'escalation',
        resource: 'entity_data',
        resourceId: record.id,
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          entitySlug: entity.slug,
          actions: rule.actions.map((a) => a.type),
        },
      },
    });
  }

  /**
   * Executa uma acao individual de escalacao
   */
  private async executeAction(
    action: EscalationAction,
    record: { id: string; tenantId: string; createdBy: { id: string; name: string; email: string } | null },
    recordData: Record<string, unknown>,
    entity: { id: string; tenantId: string; slug: string },
  ) {
    switch (action.type) {
      case 'notify':
        // Notificar usuarios especificos ou o criador
        const notifyUserIds = (action.config.userIds as string[]) || [];
        const notifyCreator = action.config.notifyCreator as boolean;
        const notifyAssignee = action.config.notifyAssignee as boolean;

        const targetUserIds = [...notifyUserIds];

        if (notifyCreator && record.createdBy) {
          targetUserIds.push(record.createdBy.id);
        }

        if (notifyAssignee && recordData['assignee_id']) {
          targetUserIds.push(recordData['assignee_id'] as string);
        }

        for (const userId of [...new Set(targetUserIds)]) {
          await this.prisma.notification.create({
            data: {
              tenantId: record.tenantId,
              userId,
              type: 'WARNING',
              title: (action.config.title as string) || 'Escalacao de Registro',
              message: this.replacePlaceholders(
                (action.config.message as string) || 'O registro foi escalado.',
                recordData,
                entity,
              ),
              entitySlug: entity.slug,
              data: { recordId: record.id },
            },
          });
        }
        break;

      case 'reassign':
        // Reatribuir para outro usuario
        const newAssigneeId = action.config.assigneeId as string;
        const assigneeField = (action.config.assigneeField as string) || 'assignee_id';

        if (newAssigneeId) {
          await this.prisma.entityData.update({
            where: { id: record.id },
            data: {
              data: {
                ...recordData,
                [assigneeField]: newAssigneeId,
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }
        break;

      case 'change-priority':
        // Alterar prioridade
        const newPriority = action.config.priority as string;
        const priorityField = (action.config.priorityField as string) || 'priority';

        if (newPriority) {
          await this.prisma.entityData.update({
            where: { id: record.id },
            data: {
              data: {
                ...recordData,
                [priorityField]: newPriority,
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }
        break;

      case 'change-status':
        // Alterar status
        const newStatus = action.config.status as string;
        const statusField = (action.config.statusField as string) || 'status';

        if (newStatus) {
          await this.prisma.entityData.update({
            where: { id: record.id },
            data: {
              data: {
                ...recordData,
                [statusField]: newStatus,
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }
        break;

      case 'webhook':
        // Chamar webhook externo
        const webhookUrl = action.config.url as string;
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'escalation',
              recordId: record.id,
              entitySlug: entity.slug,
              data: recordData,
            }),
          });
        }
        break;

      case 'action-chain':
        // Executar action chain
        const actionChainId = action.config.actionChainId as string;
        if (actionChainId) {
          await this.actionChainService.execute(actionChainId, record.tenantId, {
            tenantId: record.tenantId,
            triggeredBy: 'escalation',
            recordId: record.id,
            record: recordData,
            entity: { id: entity.id, slug: entity.slug, name: entity.slug },
          });
        }
        break;
    }
  }

  /**
   * Substitui placeholders em texto
   */
  private replacePlaceholders(
    text: string,
    recordData: Record<string, unknown>,
    entity: { slug: string },
  ): string {
    return text
      .replace(/\{\{entity\.slug\}\}/g, entity.slug)
      .replace(/\{\{record\.([^}]+)\}\}/g, (_, field) => {
        return String(recordData[field] ?? '');
      });
  }

  /**
   * Forca verificacao de escalacao para um registro especifico
   * Util para chamar apos updates manuais
   */
  async checkRecordEscalation(recordId: string) {
    const record = await this.prisma.entityData.findUnique({
      where: { id: recordId },
      include: {
        entity: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!record) return;

    const settings = record.entity.settings as EntitySettings | null;
    if (!settings?.escalation?.enabled || !settings.escalation.rules?.length) {
      return;
    }

    const recordData = record.data as Record<string, unknown>;

    for (const rule of settings.escalation.rules) {
      if (this.isInCooldown(record.id, rule.id, rule.cooldownMinutes)) {
        continue;
      }

      const shouldEscalate = await this.evaluateConditions(
        rule.condition,
        record,
        recordData,
        settings,
      );

      if (shouldEscalate) {
        await this.executeEscalation(rule, record, recordData, {
          id: record.entity.id,
          tenantId: record.tenantId,
          slug: record.entity.slug,
        });
      }
    }
  }
}
