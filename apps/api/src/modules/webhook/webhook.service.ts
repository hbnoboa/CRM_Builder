import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, HttpMethod, WebhookStatus, Webhook } from '@prisma/client';
import * as crypto from 'crypto';

interface CreateWebhookDto {
  entityId?: string;
  name: string;
  description?: string;
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  bodyTemplate?: Record<string, unknown>;
  events: string[];
  filterConditions?: Array<{ field: string; operator: string; value: unknown }>;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  secret?: string;
}

interface UpdateWebhookDto extends Partial<CreateWebhookDto> {
  status?: WebhookStatus;
}

interface TriggerContext {
  event: string;
  recordId?: string;
  record?: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
  user?: { id: string; name: string; email: string };
  entity?: { id: string; slug: string; name: string };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, entityId?: string) {
    return this.prisma.webhook.findMany({
      where: {
        tenantId,
        ...(entityId && { entityId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook nao encontrado');
    }

    return webhook;
  }

  async create(tenantId: string, dto: CreateWebhookDto) {
    return this.prisma.webhook.create({
      data: {
        tenantId,
        entityId: dto.entityId,
        name: dto.name,
        description: dto.description,
        url: dto.url,
        method: dto.method || HttpMethod.POST,
        headers: dto.headers as Prisma.InputJsonValue,
        bodyTemplate: dto.bodyTemplate as Prisma.InputJsonValue,
        events: dto.events,
        filterConditions: dto.filterConditions as Prisma.InputJsonValue,
        retryCount: dto.retryCount ?? 3,
        retryDelay: dto.retryDelay ?? 1000,
        timeout: dto.timeout ?? 30000,
        secret: dto.secret,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateWebhookDto) {
    await this.findOne(id, tenantId);

    const updateData: Prisma.WebhookUpdateInput = {
      ...dto,
      headers: dto.headers as Prisma.InputJsonValue,
      bodyTemplate: dto.bodyTemplate as Prisma.InputJsonValue,
      filterConditions: dto.filterConditions as Prisma.InputJsonValue,
      updatedAt: new Date(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    return this.prisma.webhook.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.webhook.delete({
      where: { id },
    });
  }

  /**
   * Dispara webhooks para um evento especifico
   */
  async triggerWebhooks(tenantId: string, context: TriggerContext) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        tenantId,
        status: WebhookStatus.ACTIVE,
        events: { has: context.event },
        ...(context.entity && { entityId: context.entity.id }),
      },
    });

    if (webhooks.length === 0) return;

    for (const webhook of webhooks) {
      // Verificar filtros
      if (webhook.filterConditions && context.record) {
        const conditions = webhook.filterConditions as Array<{
          field: string;
          operator: string;
          value: unknown;
        }>;
        const passes = this.evaluateConditions(conditions, context.record);
        if (!passes) continue;
      }

      // Executar webhook em background
      this.executeWebhook(webhook, context).catch((error) => {
        this.logger.error(`Erro ao executar webhook ${webhook.id}: ${error.message}`);
      });
    }
  }

  /**
   * Executa um webhook com retry
   */
  private async executeWebhook(
    webhook: Webhook,
    context: TriggerContext,
    retryCount = 0,
  ): Promise<void> {
    const startTime = Date.now();
    let status = 'success';
    let responseStatus: number | undefined;
    let responseBody: unknown;
    let errorMessage: string | undefined;

    try {
      // Preparar body
      const body = this.buildRequestBody(webhook, context);

      // Preparar headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'CRM-Builder-Webhook/1.0',
        'X-Webhook-ID': webhook.id,
        'X-Event': context.event,
        ...(webhook.headers as Record<string, string> | null),
      };

      // Adicionar assinatura HMAC se configurada
      if (webhook.secret) {
        const signature = this.generateSignature(JSON.stringify(body), webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Fazer request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhook.timeout);

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body: webhook.method !== 'GET' ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      responseStatus = response.status;

      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const error = err as Error;
      status = error.name === 'AbortError' ? 'timeout' : 'error';
      errorMessage = error.message;

      // Retry se configurado
      if (retryCount < webhook.retryCount) {
        status = 'retry';
        await new Promise((resolve) => setTimeout(resolve, webhook.retryDelay));
        return this.executeWebhook(webhook, context, retryCount + 1);
      }
    }

    // Registrar execucao
    await this.prisma.webhookExecution.create({
      data: {
        webhookId: webhook.id,
        tenantId: webhook.tenantId,
        event: context.event,
        recordId: context.recordId,
        requestUrl: webhook.url,
        requestMethod: webhook.method,
        requestHeaders: webhook.headers as Prisma.InputJsonValue,
        requestBody: this.buildRequestBody(webhook, context) as Prisma.InputJsonValue,
        responseStatus,
        responseBody: responseBody as Prisma.InputJsonValue,
        responseTime: Date.now() - startTime,
        status,
        errorMessage,
        retryCount,
      },
    });
  }

  /**
   * Constroi o body do request substituindo placeholders
   */
  private buildRequestBody(
    webhook: Webhook,
    context: TriggerContext,
  ): Record<string, unknown> {
    const template = (webhook.bodyTemplate as Record<string, unknown>) || {
      event: '{{event}}',
      timestamp: '{{now}}',
      record: '{{record}}',
      previousRecord: '{{previousRecord}}',
    };

    return this.replacePlaceholders(template, context);
  }

  /**
   * Substitui placeholders no template
   */
  private replacePlaceholders(
    obj: unknown,
    context: TriggerContext,
  ): Record<string, unknown> {
    if (typeof obj === 'string') {
      // Substituir placeholders de string
      return this.replaceStringPlaceholders(obj, context) as unknown as Record<string, unknown>;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.replacePlaceholders(item, context)) as unknown as Record<
        string,
        unknown
      >;
    }

    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replacePlaceholders(value, context);
      }
      return result;
    }

    return obj as Record<string, unknown>;
  }

  private replaceStringPlaceholders(str: string, context: TriggerContext): unknown {
    // Placeholders especiais que retornam objetos
    if (str === '{{record}}') return context.record || null;
    if (str === '{{previousRecord}}') return context.previousRecord || null;
    if (str === '{{user}}') return context.user || null;
    if (str === '{{entity}}') return context.entity || null;

    // Placeholders de texto
    return str
      .replace(/\{\{event\}\}/g, context.event)
      .replace(/\{\{recordId\}\}/g, context.recordId || '')
      .replace(/\{\{now\}\}/g, new Date().toISOString())
      .replace(/\{\{timestamp\}\}/g, String(Date.now()))
      .replace(/\{\{user\.id\}\}/g, context.user?.id || '')
      .replace(/\{\{user\.name\}\}/g, context.user?.name || '')
      .replace(/\{\{user\.email\}\}/g, context.user?.email || '')
      .replace(/\{\{entity\.id\}\}/g, context.entity?.id || '')
      .replace(/\{\{entity\.slug\}\}/g, context.entity?.slug || '')
      .replace(/\{\{entity\.name\}\}/g, context.entity?.name || '')
      .replace(/\{\{record\.([^}]+)\}\}/g, (_, path) => {
        return this.getNestedValue(context.record || {}, path);
      });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): string {
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

  /**
   * Avalia condicoes de filtro
   */
  private evaluateConditions(
    conditions: Array<{ field: string; operator: string; value: unknown }>,
    record: Record<string, unknown>,
  ): boolean {
    return conditions.every((condition) => {
      const fieldValue = record[condition.field];

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
    });
  }

  /**
   * Gera assinatura HMAC
   */
  private generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Lista execucoes de um webhook
   */
  async getExecutions(
    webhookId: string,
    tenantId: string,
    page = 1,
    limit = 20,
  ) {
    await this.findOne(webhookId, tenantId);

    const [data, total] = await Promise.all([
      this.prisma.webhookExecution.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webhookExecution.count({ where: { webhookId } }),
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
}
