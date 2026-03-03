import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailTemplateService } from '../email-template/email-template.service';
import { NotificationService } from '../notification/notification.service';
import { Prisma, EntityAutomation } from '@prisma/client';
import { ConditionEvaluator } from './condition-evaluator';

interface ActionConfig {
  order: number;
  type: string;
  config: Record<string, unknown>;
  condition?: { field: string; operator: string; value: unknown };
}

export interface AutomationContext {
  tenantId: string;
  triggeredBy: string;
  recordId?: string;
  record?: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
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
export class AutomationExecutorService {
  private readonly logger = new Logger(AutomationExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(EmailTemplateService)
    private readonly emailTemplateService?: EmailTemplateService,
    @Optional() @Inject(NotificationService)
    private readonly notificationService?: NotificationService,
  ) {}

  /**
   * Executa uma automacao completa, criando registro de execucao
   * e iterando sobre todas as acoes em ordem.
   */
  async executeAutomation(
    automation: EntityAutomation,
    context: AutomationContext,
  ): Promise<string> {
    const actions = (
      (automation.actions as unknown as ActionConfig[]) || []
    ).sort((a, b) => a.order - b.order);

    // Verificar rate limiting
    const recentExecutions = await this.prisma.automationExecution.count({
      where: {
        automationId: automation.id,
        startedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // ultima hora
        },
      },
    });

    if (recentExecutions >= automation.maxExecutionsPerHour) {
      this.logger.warn(
        `Automacao ${automation.id} atingiu limite de ${automation.maxExecutionsPerHour} execucoes/hora`,
      );
      throw new Error(
        `Rate limit excedido: ${recentExecutions}/${automation.maxExecutionsPerHour} execucoes na ultima hora`,
      );
    }

    // Avaliar condicoes globais
    const conditions = automation.conditions as Array<{
      field: string;
      operator: string;
      value: unknown;
    }> | null;

    if (conditions && context.record) {
      const passes = ConditionEvaluator.evaluate(conditions, context.record);
      if (!passes) {
        this.logger.debug(
          `Automacao ${automation.id} ignorada: condicoes nao satisfeitas`,
        );
        return '';
      }
    }

    // Criar registro de execucao
    const execution = await this.prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        tenantId: context.tenantId,
        recordId: context.recordId,
        triggeredBy: context.triggeredBy,
        inputData: context.inputData as Prisma.InputJsonValue,
        totalSteps: actions.length,
        status: 'running',
      },
    });

    // Executar acoes sequencialmente
    const stepResults: StepResult[] = [];
    let currentData: Record<string, unknown> = {
      ...context.inputData,
      record: context.record,
      previousRecord: context.previousRecord,
    };
    let hasError = false;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const stepStart = Date.now();

      // Atualizar progresso
      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: { currentStep: i + 1 },
      });

      try {
        // Verificar condicao da acao individual
        if (action.condition) {
          const passes = ConditionEvaluator.evaluate(
            [action.condition],
            currentData,
          );
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

        // Executar acao
        const output = await this.executeAction(action.type, action.config, {
          ...context,
          inputData: currentData,
        });

        // Merge output para proximas acoes
        if (output && typeof output === 'object') {
          currentData = {
            ...currentData,
            [`step_${action.order}_output`]: output,
          };
        }

        stepResults.push({
          step: action.order,
          type: action.type,
          status: 'success',
          input: action.config,
          output,
          duration: Date.now() - stepStart,
        });
      } catch (err) {
        const error = err as Error;
        hasError = true;

        this.logger.error(
          `Erro na acao ${action.type} (step ${action.order}) da automacao ${automation.id}: ${error.message}`,
        );

        stepResults.push({
          step: action.order,
          type: action.type,
          status: 'error',
          error: error.message,
          duration: Date.now() - stepStart,
        });

        if (automation.errorHandling === 'stop') {
          break;
        }
        // errorHandling === 'continue': segue para proxima acao
      }
    }

    // Finalizar execucao
    const finalStatus = hasError ? 'failed' : 'completed';
    await this.prisma.automationExecution.update({
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

    // Atualizar lastRunAt da automacao
    await this.prisma.entityAutomation.update({
      where: { id: automation.id },
      data: { lastRunAt: new Date() },
    });

    this.logger.log(
      `Automacao ${automation.id} finalizada: ${finalStatus} (${stepResults.length} steps)`,
    );

    return execution.id;
  }

  /**
   * Executa uma acao individual baseada no tipo.
   */
  private async executeAction(
    type: string,
    config: Record<string, unknown>,
    context: AutomationContext,
  ): Promise<unknown> {
    switch (type) {
      case 'send_email':
        return this.executeSendEmail(config, context);

      case 'call_webhook':
        return this.executeCallWebhook(config, context);

      case 'update_field':
        return this.executeUpdateField(config, context);

      case 'create_record':
        return this.executeCreateRecord(config, context);

      case 'notify_user':
        return this.executeNotifyUser(config, context);

      case 'change_status':
        return this.executeChangeStatus(config, context);

      case 'wait':
        return this.executeWait(config);

      default:
        throw new Error(`Tipo de acao desconhecido: ${type}`);
    }
  }

  /**
   * Acao: Enviar email usando template
   */
  private async executeSendEmail(
    config: Record<string, unknown>,
    context: AutomationContext,
  ): Promise<unknown> {
    if (!this.emailTemplateService) {
      this.logger.warn('EmailTemplateService nao disponivel, acao send_email ignorada');
      return { sent: false, reason: 'EmailTemplateService not available' };
    }

    const templateId = config.emailTemplateId as string || config.templateId as string;
    if (!templateId) {
      throw new Error('emailTemplateId ou templateId e obrigatorio para send_email');
    }

    const rendered = await this.emailTemplateService.renderTemplate(
      templateId,
      context.tenantId,
      {
        user: context.user,
        record: context.record,
        entity: context.entity,
        custom: config.variables as Record<string, unknown>,
      },
    );

    const to = (config.to as string) || context.user?.email;

    // Log do email preparado (envio real requer integracao com servico de email)
    this.logger.log(
      `Email preparado: "${rendered.subject}" para ${to}`,
    );

    return {
      subject: rendered.subject,
      to,
      html: rendered.html,
      sent: false, // Marcaria true apos integracao real com SendGrid/SES
    };
  }

  /**
   * Acao: Chamar webhook externo
   */
  private async executeCallWebhook(
    config: Record<string, unknown>,
    context: AutomationContext,
  ): Promise<unknown> {
    const url = config.url as string;
    if (!url) {
      throw new Error('url e obrigatorio para call_webhook');
    }

    const method = (config.method as string || 'POST').toUpperCase();
    const timeout = (config.timeout as number) || 30000;
    const maxRetries = (config.retries as number) || 0;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CRM-Builder-Automation/1.0',
      ...((config.headers as Record<string, string>) || {}),
    };

    // Construir body com placeholders substituidos
    const body = config.body
      ? this.replacePlaceholders(config.body, context)
      : {
          event: context.triggeredBy,
          timestamp: new Date().toISOString(),
          record: context.record || null,
          recordId: context.recordId || null,
        };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: method !== 'GET' ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let responseBody: unknown;
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          status: response.status,
          body: responseBody,
          attempt: attempt + 1,
        };
      } catch (err) {
        lastError = err as Error;

        if (attempt < maxRetries) {
          const delay = (config.retryDelay as number) || 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Webhook falhou apos ${maxRetries + 1} tentativa(s): ${lastError?.message}`,
    );
  }

  /**
   * Acao: Atualizar campo de um registro
   */
  private async executeUpdateField(
    config: Record<string, unknown>,
    context: AutomationContext,
  ): Promise<unknown> {
    const recordId = (config.recordId as string) || context.recordId;
    if (!recordId) {
      throw new Error('recordId e obrigatorio para update_field');
    }

    const fieldSlug = config.fieldSlug as string;
    const newValue = config.value;

    if (!fieldSlug) {
      throw new Error('fieldSlug e obrigatorio para update_field');
    }

    // Buscar registro atual (validando tenant)
    const entityData = await this.prisma.entityData.findFirst({
      where: {
        id: recordId,
        tenantId: context.tenantId,
      },
    });

    if (!entityData) {
      throw new Error(`Registro ${recordId} nao encontrado`);
    }

    const currentData = (entityData.data as Record<string, unknown>) || {};
    const updatedData = {
      ...currentData,
      [fieldSlug]: newValue,
    };

    await this.prisma.entityData.update({
      where: { id: recordId },
      data: {
        data: updatedData as Prisma.InputJsonValue,
      },
    });

    return {
      recordId,
      fieldSlug,
      previousValue: currentData[fieldSlug],
      newValue,
    };
  }

  /**
   * Acao: Criar novo registro
   */
  private async executeCreateRecord(
    config: Record<string, unknown>,
    context: AutomationContext,
  ): Promise<unknown> {
    const entityId = (config.entityId as string) || context.entity?.id;
    if (!entityId) {
      throw new Error('entityId e obrigatorio para create_record');
    }

    // Validar que a entidade pertence ao tenant
    const entity = await this.prisma.entity.findFirst({
      where: {
        id: entityId,
        tenantId: context.tenantId,
      },
    });

    if (!entity) {
      throw new Error(`Entidade ${entityId} nao encontrada no tenant`);
    }

    // Construir dados do novo registro
    let recordData = (config.data as Record<string, unknown>) || {};

    // Substituir placeholders nos dados
    if (context.record) {
      recordData = this.replacePlaceholders(
        recordData,
        context,
      ) as Record<string, unknown>;
    }

    const newRecord = await this.prisma.entityData.create({
      data: {
        entityId,
        tenantId: context.tenantId,
        data: recordData as Prisma.InputJsonValue,
        createdById: context.user?.id,
      },
    });

    return {
      recordId: newRecord.id,
      entityId,
      data: recordData,
    };
  }

  /**
   * Acao: Notificar usuario
   */
  private async executeNotifyUser(
    config: Record<string, unknown>,
    context: AutomationContext,
  ): Promise<unknown> {
    const title = this.replaceStringPlaceholders(
      (config.title as string) || 'Automacao',
      context,
    );
    const message = this.replaceStringPlaceholders(
      (config.message as string) || '',
      context,
    );
    const targetUserId = (config.userId as string) || context.user?.id;
    const notificationType =
      (config.type as 'info' | 'success' | 'warning' | 'error') || 'info';

    if (!targetUserId) {
      throw new Error('userId ou user no contexto e obrigatorio para notify_user');
    }

    // Usar NotificationService se disponivel
    if (this.notificationService) {
      await this.notificationService.notifyUser(
        targetUserId,
        {
          type: notificationType,
          title,
          message,
          data: {
            automationId: config.automationId,
            recordId: context.recordId,
            entitySlug: context.entity?.slug,
          },
        },
        context.tenantId,
        true,
      );

      return { notificationSent: true, userId: targetUserId };
    }

    // Fallback: criar notificacao direto no banco
    await this.prisma.notification.create({
      data: {
        tenantId: context.tenantId,
        userId: targetUserId,
        type: notificationType.toUpperCase() as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
        title,
        message,
        data: {
          automationId: config.automationId,
          recordId: context.recordId,
          entitySlug: context.entity?.slug,
        } as Prisma.InputJsonValue,
        entitySlug: context.entity?.slug,
      },
    });

    return { notificationCreated: true, userId: targetUserId };
  }

  /**
   * Acao: Alterar status de um registro
   */
  private async executeChangeStatus(
    config: Record<string, unknown>,
    context: AutomationContext,
  ): Promise<unknown> {
    const recordId = (config.recordId as string) || context.recordId;
    if (!recordId) {
      throw new Error('recordId e obrigatorio para change_status');
    }

    const statusField = (config.statusField as string) || 'status';
    const newStatus = config.newStatus;

    if (newStatus === undefined) {
      throw new Error('newStatus e obrigatorio para change_status');
    }

    // Buscar registro atual (validando tenant)
    const entityData = await this.prisma.entityData.findFirst({
      where: {
        id: recordId,
        tenantId: context.tenantId,
      },
    });

    if (!entityData) {
      throw new Error(`Registro ${recordId} nao encontrado`);
    }

    const currentData = (entityData.data as Record<string, unknown>) || {};
    const previousStatus = currentData[statusField];

    const updatedData = {
      ...currentData,
      [statusField]: newStatus,
    };

    await this.prisma.entityData.update({
      where: { id: recordId },
      data: {
        data: updatedData as Prisma.InputJsonValue,
      },
    });

    return {
      recordId,
      statusField,
      previousStatus,
      newStatus,
    };
  }

  /**
   * Acao: Aguardar um periodo de tempo
   */
  private async executeWait(config: Record<string, unknown>): Promise<unknown> {
    const milliseconds = (config.milliseconds as number) || 1000;
    const maxWait = 60000; // maximo 60 segundos
    const waitTime = Math.min(milliseconds, maxWait);

    await new Promise((resolve) => setTimeout(resolve, waitTime));

    return { waited: waitTime };
  }

  /**
   * Substitui placeholders em strings usando o contexto da automacao.
   */
  private replaceStringPlaceholders(
    text: string,
    context: AutomationContext,
  ): string {
    if (!text) return '';

    return text
      .replace(/\{\{user\.name\}\}/g, context.user?.name || '')
      .replace(/\{\{user\.email\}\}/g, context.user?.email || '')
      .replace(/\{\{user\.id\}\}/g, context.user?.id || '')
      .replace(/\{\{entity\.name\}\}/g, context.entity?.name || '')
      .replace(/\{\{entity\.slug\}\}/g, context.entity?.slug || '')
      .replace(/\{\{entity\.id\}\}/g, context.entity?.id || '')
      .replace(/\{\{recordId\}\}/g, context.recordId || '')
      .replace(/\{\{now\}\}/g, new Date().toISOString())
      .replace(/\{\{timestamp\}\}/g, String(Date.now()))
      .replace(/\{\{record\.([^}]+)\}\}/g, (_, path) => {
        return this.getNestedStringValue(context.record || {}, path);
      })
      .replace(/\{\{previousRecord\.([^}]+)\}\}/g, (_, path) => {
        return this.getNestedStringValue(context.previousRecord || {}, path);
      });
  }

  /**
   * Substitui placeholders em objetos recursivamente.
   */
  private replacePlaceholders(
    obj: unknown,
    context: AutomationContext,
  ): unknown {
    if (typeof obj === 'string') {
      // Placeholders especiais que retornam objetos inteiros
      if (obj === '{{record}}') return context.record || null;
      if (obj === '{{previousRecord}}') return context.previousRecord || null;
      if (obj === '{{user}}') return context.user || null;
      if (obj === '{{entity}}') return context.entity || null;

      return this.replaceStringPlaceholders(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.replacePlaceholders(item, context));
    }

    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replacePlaceholders(value, context);
      }
      return result;
    }

    return obj;
  }

  /**
   * Obtem valor aninhado de um objeto e retorna como string.
   */
  private getNestedStringValue(
    obj: Record<string, unknown>,
    path: string,
  ): string {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }

    return current != null ? String(current) : '';
  }
}
