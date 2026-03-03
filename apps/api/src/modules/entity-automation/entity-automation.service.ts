import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AutomationExecutorService, AutomationContext } from './automation-executor.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { ConditionEvaluator } from './condition-evaluator';
import { AutomationTrigger, Prisma } from '@prisma/client';

interface TriggerContext {
  event: string;
  recordId?: string;
  record?: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
  user?: { id: string; name: string; email: string };
  entity?: { id: string; slug: string; name: string };
  changedFields?: string[];
}

@Injectable()
export class EntityAutomationService {
  private readonly logger = new Logger(EntityAutomationService.name);

  private readonly validTriggers = [
    'ON_CREATE',
    'ON_UPDATE',
    'ON_DELETE',
    'ON_FIELD_CHANGE',
    'ON_STATUS_CHANGE',
    'SCHEDULE',
    'MANUAL',
  ];

  private readonly validActionTypes = [
    'send_email',
    'call_webhook',
    'update_field',
    'create_record',
    'notify_user',
    'change_status',
    'wait',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: AutomationExecutorService,
    private readonly scheduler: AutomationSchedulerService,
  ) {}

  /**
   * Lista automacoes de uma entidade.
   */
  async findAll(
    tenantId: string,
    entityId: string,
    query?: { isActive?: boolean; trigger?: string; search?: string; page?: number; limit?: number },
  ) {
    const { isActive, trigger, search, page = 1, limit = 50 } = query || {};

    const where: Prisma.EntityAutomationWhereInput = {
      tenantId,
      entityId,
      ...(isActive !== undefined && { isActive }),
      ...(trigger && { trigger: trigger as AutomationTrigger }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.entityAutomation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.entityAutomation.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Busca uma automacao por ID.
   */
  async findOne(tenantId: string, entityId: string, id: string) {
    const automation = await this.prisma.entityAutomation.findFirst({
      where: {
        id,
        tenantId,
        entityId,
      },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });

    if (!automation) {
      throw new NotFoundException('Automacao nao encontrada');
    }

    return automation;
  }

  /**
   * Cria uma nova automacao.
   */
  async create(tenantId: string, entityId: string, dto: CreateAutomationDto) {
    // Validar que a entidade pertence ao tenant
    const entity = await this.prisma.entity.findFirst({
      where: {
        id: entityId,
        tenantId,
      },
    });

    if (!entity) {
      throw new ForbiddenException('Entidade nao encontrada no tenant');
    }

    // Validar trigger
    if (!this.validTriggers.includes(dto.trigger)) {
      throw new BadRequestException(
        `Trigger invalido: ${dto.trigger}. Validos: ${this.validTriggers.join(', ')}`,
      );
    }

    // Validar acoes
    this.validateActions(dto.actions);

    // Calcular nextRunAt para triggers SCHEDULE
    let nextRunAt: Date | null = null;
    if (dto.trigger === 'SCHEDULE' && (dto.isActive ?? true)) {
      if (!dto.triggerConfig) {
        throw new BadRequestException(
          'triggerConfig e obrigatorio para trigger SCHEDULE (cronExpression ou intervalMinutes)',
        );
      }
      nextRunAt = this.scheduler.calculateNextRun(dto.triggerConfig);
    }

    return this.prisma.entityAutomation.create({
      data: {
        tenantId,
        entityId,
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger as AutomationTrigger,
        triggerConfig: dto.triggerConfig as Prisma.InputJsonValue,
        conditions: dto.conditions as Prisma.InputJsonValue,
        actions: dto.actions as unknown as Prisma.InputJsonValue,
        errorHandling: dto.errorHandling || 'stop',
        isActive: dto.isActive ?? true,
        maxExecutionsPerHour: dto.maxExecutionsPerHour ?? 100,
        nextRunAt,
      },
    });
  }

  /**
   * Atualiza uma automacao existente.
   */
  async update(
    tenantId: string,
    entityId: string,
    id: string,
    dto: UpdateAutomationDto,
  ) {
    const existing = await this.findOne(tenantId, entityId, id);

    // Validar trigger se fornecido
    if (dto.trigger && !this.validTriggers.includes(dto.trigger)) {
      throw new BadRequestException(
        `Trigger invalido: ${dto.trigger}. Validos: ${this.validTriggers.join(', ')}`,
      );
    }

    // Validar acoes se fornecidas
    if (dto.actions) {
      this.validateActions(dto.actions);
    }

    // Recalcular nextRunAt se trigger ou triggerConfig mudou
    let nextRunAt: Date | null | undefined;
    const newTrigger = dto.trigger || existing.trigger;
    const newTriggerConfig = dto.triggerConfig || existing.triggerConfig;
    const newIsActive = dto.isActive !== undefined ? dto.isActive : existing.isActive;

    if (
      newTrigger === 'SCHEDULE' &&
      newIsActive &&
      (dto.trigger || dto.triggerConfig || dto.isActive !== undefined)
    ) {
      nextRunAt = this.scheduler.calculateNextRun(newTriggerConfig);
    } else if (newTrigger !== 'SCHEDULE') {
      nextRunAt = null; // Limpar nextRunAt se nao e mais SCHEDULE
    }

    const updateData: Prisma.EntityAutomationUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.trigger !== undefined) updateData.trigger = dto.trigger as AutomationTrigger;
    if (dto.triggerConfig !== undefined) updateData.triggerConfig = dto.triggerConfig as Prisma.InputJsonValue;
    if (dto.conditions !== undefined) updateData.conditions = dto.conditions as Prisma.InputJsonValue;
    if (dto.actions !== undefined) updateData.actions = dto.actions as unknown as Prisma.InputJsonValue;
    if (dto.errorHandling !== undefined) updateData.errorHandling = dto.errorHandling;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.maxExecutionsPerHour !== undefined) updateData.maxExecutionsPerHour = dto.maxExecutionsPerHour;
    if (nextRunAt !== undefined) updateData.nextRunAt = nextRunAt;

    return this.prisma.entityAutomation.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Remove uma automacao.
   */
  async remove(tenantId: string, entityId: string, id: string) {
    await this.findOne(tenantId, entityId, id);

    return this.prisma.entityAutomation.delete({
      where: { id },
    });
  }

  /**
   * Executa manualmente uma automacao (trigger MANUAL).
   */
  async executeManual(
    tenantId: string,
    entityId: string,
    id: string,
    userId: string,
    recordId?: string,
    inputData?: Record<string, unknown>,
  ) {
    const automation = await this.findOne(tenantId, entityId, id);

    if (!automation.isActive) {
      throw new BadRequestException('Automacao esta inativa');
    }

    if (automation.trigger !== AutomationTrigger.MANUAL) {
      throw new BadRequestException(
        'Esta automacao nao pode ser executada manualmente (trigger != MANUAL)',
      );
    }

    // Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    // Buscar entidade
    const entity = await this.prisma.entity.findUnique({
      where: { id: entityId },
      select: { id: true, slug: true, name: true },
    });

    // Buscar registro se informado
    let record: Record<string, unknown> | undefined;
    if (recordId) {
      const entityData = await this.prisma.entityData.findFirst({
        where: {
          id: recordId,
          tenantId,
        },
      });

      if (entityData) {
        record = entityData.data as Record<string, unknown>;
      }
    }

    const context: AutomationContext = {
      tenantId,
      triggeredBy: `manual:${userId}`,
      recordId,
      record,
      user: user || undefined,
      entity: entity || undefined,
      inputData,
    };

    const executionId = await this.executor.executeAutomation(automation, context);

    return { executionId, message: 'Automacao iniciada' };
  }

  /**
   * Lista execucoes de uma automacao.
   */
  async getExecutions(
    tenantId: string,
    automationId: string,
    page = 1,
    limit = 20,
  ) {
    // Validar que a automacao pertence ao tenant
    const automation = await this.prisma.entityAutomation.findFirst({
      where: { id: automationId, tenantId },
    });

    if (!automation) {
      throw new NotFoundException('Automacao nao encontrada');
    }

    const where: Prisma.AutomationExecutionWhereInput = {
      automationId,
      tenantId,
    };

    const [data, total] = await Promise.all([
      this.prisma.automationExecution.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.automationExecution.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Disparado por DataService quando ocorre um evento em uma entidade.
   * Busca automacoes correspondentes ao evento e executa em background.
   */
  async triggerByEvent(
    tenantId: string,
    entityId: string,
    event: string,
    context: TriggerContext,
  ) {
    // Mapear evento para trigger
    const triggerMap: Record<string, AutomationTrigger[]> = {
      'record.created': [AutomationTrigger.ON_CREATE],
      'record.updated': [
        AutomationTrigger.ON_UPDATE,
        AutomationTrigger.ON_FIELD_CHANGE,
        AutomationTrigger.ON_STATUS_CHANGE,
      ],
      'record.deleted': [AutomationTrigger.ON_DELETE],
    };

    const triggers = triggerMap[event];
    if (!triggers || triggers.length === 0) {
      return;
    }

    // Buscar automacoes ativas para esta entidade e triggers
    const automations = await this.prisma.entityAutomation.findMany({
      where: {
        tenantId,
        entityId,
        isActive: true,
        trigger: { in: triggers },
      },
    });

    if (automations.length === 0) return;

    this.logger.log(
      `Evento "${event}" em entidade ${entityId}: ${automations.length} automacao(oes) encontrada(s)`,
    );

    for (const automation of automations) {
      // Filtrar por trigger especifico
      if (!this.matchesTrigger(automation, event, context)) {
        continue;
      }

      // Avaliar condicoes
      const conditions = automation.conditions as Array<{
        field: string;
        operator: string;
        value: unknown;
      }> | null;

      if (conditions && context.record) {
        if (!ConditionEvaluator.evaluate(conditions, context.record)) {
          this.logger.debug(
            `Automacao ${automation.id} ignorada: condicoes nao satisfeitas`,
          );
          continue;
        }
      }

      // Executar em fire-and-forget
      const executionContext: AutomationContext = {
        tenantId,
        triggeredBy: `system:${event}`,
        recordId: context.recordId,
        record: context.record,
        previousRecord: context.previousRecord,
        user: context.user,
        entity: context.entity,
      };

      // Fire-and-forget: executa sem bloquear o fluxo principal
      setImmediate(() => {
        this.executor
          .executeAutomation(automation, executionContext)
          .then((executionId) => {
            if (executionId) {
              this.logger.log(
                `Automacao ${automation.id} disparada por "${event}": execucao ${executionId}`,
              );
            }
          })
          .catch((err) => {
            this.logger.error(
              `Erro ao executar automacao ${automation.id} para evento "${event}": ${err.message}`,
            );
          });
      });
    }
  }

  /**
   * Verifica se uma automacao corresponde ao evento e contexto.
   */
  private matchesTrigger(
    automation: { trigger: AutomationTrigger; triggerConfig: unknown },
    event: string,
    context: TriggerContext,
  ): boolean {
    const config = automation.triggerConfig as Record<string, unknown> | null;

    switch (automation.trigger) {
      case AutomationTrigger.ON_CREATE:
        return event === 'record.created';

      case AutomationTrigger.ON_UPDATE:
        return event === 'record.updated';

      case AutomationTrigger.ON_DELETE:
        return event === 'record.deleted';

      case AutomationTrigger.ON_FIELD_CHANGE:
        if (event !== 'record.updated') return false;
        if (!config?.fieldSlug) return true; // Qualquer campo

        // Verificar se o campo especifico mudou
        const fieldSlug = config.fieldSlug as string;
        if (context.changedFields && !context.changedFields.includes(fieldSlug)) {
          return false;
        }

        // Verificar valores de/para se configurados
        const previousValue = context.previousRecord?.[fieldSlug];
        const currentValue = context.record?.[fieldSlug];

        if (config.fromValue !== undefined && previousValue !== config.fromValue) {
          return false;
        }
        if (config.toValue !== undefined && currentValue !== config.toValue) {
          return false;
        }

        return previousValue !== currentValue;

      case AutomationTrigger.ON_STATUS_CHANGE:
        if (event !== 'record.updated') return false;

        const statusField = (config?.statusField as string) || 'status';
        const prevStatus = context.previousRecord?.[statusField];
        const currStatus = context.record?.[statusField];

        // Status precisa ter mudado
        if (prevStatus === currStatus) return false;

        // Verificar filtros de/para
        if (config?.fromStatus !== undefined && prevStatus !== config.fromStatus) {
          return false;
        }
        if (config?.toStatus !== undefined && currStatus !== config.toStatus) {
          return false;
        }

        return true;

      default:
        return false;
    }
  }

  /**
   * Valida a lista de acoes de uma automacao.
   */
  private validateActions(actions: Array<Record<string, unknown>>) {
    if (!Array.isArray(actions)) {
      throw new BadRequestException('actions deve ser um array');
    }

    for (const action of actions) {
      if (!action.type) {
        throw new BadRequestException('Cada acao deve ter um "type"');
      }

      if (!this.validActionTypes.includes(action.type as string)) {
        throw new BadRequestException(
          `Tipo de acao invalido: ${action.type}. Validos: ${this.validActionTypes.join(', ')}`,
        );
      }

      if (action.order === undefined || action.order === null) {
        throw new BadRequestException('Cada acao deve ter um "order"');
      }
    }

    // Verificar ordens duplicadas
    const orders = actions.map((a) => a.order as number);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Ordens de acoes devem ser unicas');
    }
  }
}
