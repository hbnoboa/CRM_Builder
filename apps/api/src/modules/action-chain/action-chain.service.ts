import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionChainTrigger, Prisma, ActionChain } from '@prisma/client';
import { WebhookService } from '../webhook/webhook.service';
import { EmailTemplateService } from '../email-template/email-template.service';

interface ActionConfig {
  order: number;
  type: 'custom-api' | 'email' | 'webhook' | 'status-change' | 'notification' | 'wait';
  config: Record<string, unknown>;
  inputMapping?: Record<string, string>;
  condition?: { field: string; operator: string; value: unknown };
}

interface CreateActionChainDto {
  entityId?: string;
  name: string;
  description?: string;
  trigger: ActionChainTrigger;
  triggerConfig?: Record<string, unknown>;
  actions: ActionConfig[];
  errorHandling?: 'stop' | 'continue' | 'rollback';
}

interface UpdateActionChainDto extends Partial<CreateActionChainDto> {
  isActive?: boolean;
}

interface ExecutionContext {
  tenantId: string;
  triggeredBy: string;
  recordId?: string;
  record?: Record<string, unknown>;
  user?: { id: string; name: string; email: string };
  entity?: { id: string; slug: string; name: string };
  inputData?: Record<string, unknown>;
}

interface StepResult {
  step: number;
  type: string;
  status: 'success' | 'error' | 'skipped';
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  duration: number;
}

@Injectable()
export class ActionChainService {
  private readonly logger = new Logger(ActionChainService.name);

  constructor(
    private prisma: PrismaService,
    private webhookService: WebhookService,
    private emailTemplateService: EmailTemplateService,
  ) {}

  async findAll(tenantId: string, entityId?: string) {
    return this.prisma.actionChain.findMany({
      where: {
        tenantId,
        ...(entityId && { entityId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const actionChain = await this.prisma.actionChain.findFirst({
      where: { id, tenantId },
    });

    if (!actionChain) {
      throw new NotFoundException('Action Chain nao encontrada');
    }

    return actionChain;
  }

  async create(tenantId: string, dto: CreateActionChainDto) {
    // Validar acoes
    this.validateActions(dto.actions);

    return this.prisma.actionChain.create({
      data: {
        tenantId,
        entityId: dto.entityId,
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        triggerConfig: dto.triggerConfig as Prisma.InputJsonValue,
        actions: dto.actions as unknown as Prisma.InputJsonValue,
        errorHandling: dto.errorHandling || 'stop',
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateActionChainDto) {
    await this.findOne(id, tenantId);

    if (dto.actions) {
      this.validateActions(dto.actions);
    }

    const updateData: Prisma.ActionChainUpdateInput = {
      entityId: dto.entityId,
      name: dto.name,
      description: dto.description,
      trigger: dto.trigger,
      triggerConfig: dto.triggerConfig as Prisma.InputJsonValue,
      errorHandling: dto.errorHandling,
      isActive: dto.isActive,
      ...(dto.actions && { actions: dto.actions as unknown as Prisma.InputJsonValue }),
      updatedAt: new Date(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    return this.prisma.actionChain.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.actionChain.delete({
      where: { id },
    });
  }

  /**
   * Valida as acoes de uma chain
   */
  private validateActions(actions: ActionConfig[]) {
    const validTypes = ['custom-api', 'email', 'webhook', 'status-change', 'notification', 'wait'];

    for (const action of actions) {
      if (!validTypes.includes(action.type)) {
        throw new BadRequestException(`Tipo de acao invalido: ${action.type}`);
      }

      if (action.order < 0) {
        throw new BadRequestException('Ordem de acao deve ser >= 0');
      }
    }

    // Verificar se nao ha ordens duplicadas
    const orders = actions.map((a) => a.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Ordens de acoes devem ser unicas');
    }
  }

  /**
   * Dispara action chains por evento
   */
  async triggerByEvent(
    tenantId: string,
    event: string,
    context: Omit<ExecutionContext, 'tenantId' | 'triggeredBy'>,
  ) {
    const chains = await this.prisma.actionChain.findMany({
      where: {
        tenantId,
        trigger: ActionChainTrigger.EVENT,
        isActive: true,
        ...(context.entity && { entityId: context.entity.id }),
      },
    });

    for (const chain of chains) {
      const triggerConfig = chain.triggerConfig as { events?: string[] } | null;

      // Verificar se o evento esta na lista de eventos
      if (triggerConfig?.events && !triggerConfig.events.includes(event)) {
        continue;
      }

      // Executar chain em background
      this.execute(chain.id, tenantId, {
        ...context,
        tenantId,
        triggeredBy: `event:${event}`,
      }).catch((error) => {
        this.logger.error(`Erro ao executar action chain ${chain.id}: ${error.message}`);
      });
    }
  }

  /**
   * Executa uma action chain
   */
  async execute(
    actionChainId: string,
    tenantId: string,
    context: ExecutionContext,
  ): Promise<string> {
    const chain = await this.findOne(actionChainId, tenantId);

    if (!chain.isActive) {
      throw new BadRequestException('Action Chain esta inativa');
    }

    const actions = (chain.actions as unknown as ActionConfig[]).sort((a, b) => a.order - b.order);

    // Criar registro de execucao
    const execution = await this.prisma.actionChainExecution.create({
      data: {
        actionChainId,
        tenantId,
        triggeredBy: context.triggeredBy,
        recordId: context.recordId,
        inputData: context.inputData as Prisma.InputJsonValue,
        totalSteps: actions.length,
        status: 'running',
      },
    });

    // Executar acoes
    const stepResults: StepResult[] = [];
    let currentData = { ...context.inputData, record: context.record };
    let hasError = false;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const stepStart = Date.now();

      // Atualizar progresso
      await this.prisma.actionChainExecution.update({
        where: { id: execution.id },
        data: { currentStep: i + 1 },
      });

      try {
        // Verificar condicao
        if (action.condition) {
          const passes = this.evaluateCondition(action.condition, currentData);
          if (!passes) {
            stepResults.push({
              step: action.order,
              type: action.type,
              status: 'skipped',
              duration: Date.now() - stepStart,
            });
            continue;
          }
        }

        // Mapear inputs
        const input = this.mapInputs(action.inputMapping || {}, currentData);
        const mergedConfig = { ...action.config, ...input };

        // Executar acao
        const output = await this.executeAction(action.type, mergedConfig, {
          ...context,
          inputData: currentData as Record<string, unknown>,
        });

        // Merge output para proximas acoes
        if (output && typeof output === 'object') {
          currentData = { ...currentData, [`step_${action.order}_output`]: output };
        }

        stepResults.push({
          step: action.order,
          type: action.type,
          status: 'success',
          input: mergedConfig,
          output,
          duration: Date.now() - stepStart,
        });
      } catch (err) {
        const error = err as Error;
        hasError = true;

        stepResults.push({
          step: action.order,
          type: action.type,
          status: 'error',
          error: error.message,
          duration: Date.now() - stepStart,
        });

        if (chain.errorHandling === 'stop') {
          break;
        }
      }
    }

    // Finalizar execucao
    const finalStatus = hasError ? 'failed' : 'completed';
    await this.prisma.actionChainExecution.update({
      where: { id: execution.id },
      data: {
        status: finalStatus,
        stepResults: stepResults as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
        duration: Date.now() - execution.startedAt.getTime(),
        ...(hasError && {
          errorMessage: stepResults.find((s) => s.status === 'error')?.error,
        }),
      },
    });

    return execution.id;
  }

  /**
   * Executa uma acao individual
   */
  private async executeAction(
    type: string,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    switch (type) {
      case 'wait':
        await new Promise((resolve) =>
          setTimeout(resolve, (config.milliseconds as number) || 1000),
        );
        return { waited: config.milliseconds || 1000 };

      case 'webhook':
        // Dispara webhook inline (nao usa o sistema de webhooks)
        const webhookResponse = await fetch(config.url as string, {
          method: (config.method as string) || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...((config.headers as Record<string, string>) || {}),
          },
          body: JSON.stringify(config.body || context.record),
        });
        return {
          status: webhookResponse.status,
          body: await webhookResponse.json().catch(() => null),
        };

      case 'email':
        // Renderiza e "envia" email (apenas prepara - envio real requer integracao)
        const rendered = await this.emailTemplateService.renderTemplate(
          config.templateId as string,
          context.tenantId,
          {
            user: context.user,
            record: context.record,
            entity: context.entity,
            custom: config.variables as Record<string, unknown>,
          },
        );
        // Aqui integraria com servico de email real (SendGrid, SES, etc)
        this.logger.log(`Email preparado: ${rendered.subject} para ${config.to || context.user?.email}`);
        return {
          subject: rendered.subject,
          to: config.to || context.user?.email,
          sent: false, // Marcaria true apos integracao real
        };

      case 'status-change':
        // Atualiza status de um registro
        if (!context.recordId) {
          throw new Error('recordId necessario para status-change');
        }
        await this.prisma.entityData.update({
          where: { id: context.recordId },
          data: {
            data: {
              ...(context.record || {}),
              [config.statusField as string]: config.newStatus,
            } as Prisma.InputJsonValue,
          },
        });
        return { statusChanged: true, newStatus: config.newStatus };

      case 'notification':
        // Cria notificacao no sistema
        const targetUserId = (config.userId as string) || context.user?.id;
        if (!targetUserId) {
          throw new Error('userId necessario para notification');
        }
        await this.prisma.notification.create({
          data: {
            tenantId: context.tenantId,
            userId: targetUserId,
            type: (config.type as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR') || 'INFO',
            title: this.replacePlaceholders(config.title as string, context),
            message: this.replacePlaceholders(config.message as string, context),
            data: config.data as Prisma.InputJsonValue,
            entitySlug: context.entity?.slug,
          },
        });
        return { notificationCreated: true };

      case 'custom-api':
        // Chama um CustomEndpoint interno
        // Isso seria implementado com o servico de custom-api
        this.logger.log(`Custom API call: ${config.endpoint}`);
        return { customApiCalled: true, endpoint: config.endpoint };

      default:
        throw new Error(`Tipo de acao desconhecido: ${type}`);
    }
  }

  /**
   * Avalia uma condicao
   */
  private evaluateCondition(
    condition: { field: string; operator: string; value: unknown },
    data: Record<string, unknown>,
  ): boolean {
    const fieldValue = this.getNestedValue(data, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue || '').includes(String(condition.value));
      case 'gt':
        return Number(fieldValue) > Number(condition.value);
      case 'gte':
        return Number(fieldValue) >= Number(condition.value);
      case 'lt':
        return Number(fieldValue) < Number(condition.value);
      case 'lte':
        return Number(fieldValue) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'is_empty':
        return fieldValue == null || fieldValue === '';
      case 'is_not_empty':
        return fieldValue != null && fieldValue !== '';
      default:
        return true;
    }
  }

  /**
   * Mapeia inputs de passos anteriores
   */
  private mapInputs(
    mapping: Record<string, string>,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, path] of Object.entries(mapping)) {
      result[key] = this.getNestedValue(data, path);
    }

    return result;
  }

  /**
   * Obtem valor aninhado
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Substitui placeholders simples
   */
  private replacePlaceholders(text: string, context: ExecutionContext): string {
    if (!text) return '';

    return text
      .replace(/\{\{user\.name\}\}/g, context.user?.name || '')
      .replace(/\{\{user\.email\}\}/g, context.user?.email || '')
      .replace(/\{\{entity\.name\}\}/g, context.entity?.name || '')
      .replace(/\{\{record\.([^}]+)\}\}/g, (_, path) => {
        const value = this.getNestedValue(context.record || {}, path);
        return value != null ? String(value) : '';
      });
  }

  /**
   * Lista execucoes de uma action chain
   */
  async getExecutions(actionChainId: string, tenantId: string, page = 1, limit = 20) {
    await this.findOne(actionChainId, tenantId);

    const [data, total] = await Promise.all([
      this.prisma.actionChainExecution.findMany({
        where: { actionChainId },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.actionChainExecution.count({ where: { actionChainId } }),
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
   * Executa manualmente uma action chain
   */
  async executeManual(
    actionChainId: string,
    tenantId: string,
    userId: string,
    recordId?: string,
    inputData?: Record<string, unknown>,
  ) {
    const chain = await this.findOne(actionChainId, tenantId);

    if (chain.trigger !== ActionChainTrigger.MANUAL) {
      throw new BadRequestException('Esta action chain nao pode ser executada manualmente');
    }

    // Buscar user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    // Buscar record se informado
    let record: Record<string, unknown> | undefined;
    let entity: { id: string; slug: string; name: string } | undefined;

    if (recordId) {
      const entityData = await this.prisma.entityData.findUnique({
        where: { id: recordId },
        include: { entity: true },
      });

      if (entityData) {
        record = entityData.data as Record<string, unknown>;
        entity = {
          id: entityData.entity.id,
          slug: entityData.entity.slug,
          name: entityData.entity.name,
        };
      }
    }

    return this.execute(actionChainId, tenantId, {
      tenantId,
      triggeredBy: `manual:${userId}`,
      recordId,
      record,
      user: user || undefined,
      entity,
      inputData,
    });
  }
}
