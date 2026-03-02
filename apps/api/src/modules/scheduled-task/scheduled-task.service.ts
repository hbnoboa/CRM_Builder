import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ScheduledTask } from '@prisma/client';
import { ActionChainService } from '../action-chain/action-chain.service';
import { WebhookService } from '../webhook/webhook.service';

interface CreateScheduledTaskDto {
  entityId?: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  actionType: 'custom-api' | 'action-chain' | 'webhook' | 'email-report';
  actionConfig?: Record<string, unknown>;
}

interface UpdateScheduledTaskDto extends Partial<CreateScheduledTaskDto> {
  isActive?: boolean;
}

@Injectable()
export class ScheduledTaskService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledTaskService.name);
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private prisma: PrismaService,
    private actionChainService: ActionChainService,
    private webhookService: WebhookService,
  ) {}

  onModuleInit() {
    // Inicia o scheduler que verifica tarefas a cada minuto
    this.startScheduler();
  }

  private startScheduler() {
    // Verificar a cada minuto
    this.schedulerInterval = setInterval(
      () => {
        this.checkAndRunTasks().catch((error) => {
          this.logger.error(`Erro no scheduler: ${error.message}`);
        });
      },
      60 * 1000, // 1 minuto
    );

    // Executar imediatamente na inicializacao
    this.checkAndRunTasks().catch((error) => {
      this.logger.error(`Erro na inicializacao do scheduler: ${error.message}`);
    });
  }

  private async checkAndRunTasks() {
    const now = new Date();

    // Buscar tarefas ativas que precisam ser executadas
    const tasks = await this.prisma.scheduledTask.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: now,
        },
      },
    });

    for (const task of tasks) {
      // Executar em background
      this.runTask(task).catch((error) => {
        this.logger.error(`Erro ao executar task ${task.id}: ${error.message}`);
      });
    }
  }

  private async runTask(task: ScheduledTask) {
    const startTime = Date.now();
    let status = 'success';
    let errorMessage: string | undefined;
    let outputData: unknown;

    try {
      // Executar acao baseada no tipo
      outputData = await this.executeAction(task);
    } catch (err) {
      const error = err as Error;
      status = 'error';
      errorMessage = error.message;
    }

    const duration = Date.now() - startTime;

    // Registrar execucao
    await this.prisma.scheduledTaskExecution.create({
      data: {
        scheduledTaskId: task.id,
        tenantId: task.tenantId,
        status,
        duration,
        outputData: outputData as Prisma.InputJsonValue,
        errorMessage,
        completedAt: new Date(),
      },
    });

    // Atualizar task
    const nextRun = this.calculateNextRun(task.cronExpression, task.timezone);

    await this.prisma.scheduledTask.update({
      where: { id: task.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: nextRun,
        runCount: { increment: 1 },
        ...(status === 'success'
          ? { successCount: { increment: 1 } }
          : { failureCount: { increment: 1 } }),
      },
    });
  }

  private async executeAction(task: ScheduledTask): Promise<unknown> {
    const config = task.actionConfig as Record<string, unknown> | null;

    switch (task.actionType) {
      case 'action-chain':
        if (!config?.actionChainId) {
          throw new Error('actionChainId necessario para action-chain');
        }
        return this.actionChainService.execute(
          config.actionChainId as string,
          task.tenantId,
          {
            tenantId: task.tenantId,
            triggeredBy: `schedule:${task.id}`,
            inputData: config.inputData as Record<string, unknown>,
          },
        );

      case 'webhook':
        if (!config?.url) {
          throw new Error('url necessaria para webhook');
        }
        const response = await fetch(config.url as string, {
          method: (config.method as string) || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...((config.headers as Record<string, string>) || {}),
          },
          body: JSON.stringify(config.body || {}),
        });
        return {
          status: response.status,
          body: await response.json().catch(() => null),
        };

      case 'email-report':
        // Prepararia e enviaria um relatorio por email
        this.logger.log(`Email report scheduled: ${task.name}`);
        return { emailReportPrepared: true };

      case 'custom-api':
        // Chamaria um custom endpoint
        this.logger.log(`Custom API scheduled: ${task.name}`);
        return { customApiCalled: true, endpoint: config?.endpoint };

      default:
        throw new Error(`Tipo de acao desconhecido: ${task.actionType}`);
    }
  }

  /**
   * Calcula a proxima execucao baseada no cron expression
   * Implementacao simplificada - em producao usar biblioteca como cron-parser
   */
  private calculateNextRun(cronExpression: string, timezone: string): Date {
    // Formato simplificado: "minuto hora dia mes dia-da-semana"
    // Exemplo: "0 9 * * *" = todo dia as 9h
    // Exemplo: "*/15 * * * *" = a cada 15 minutos

    const parts = cronExpression.split(' ');
    const now = new Date();

    // Para simplicidade, apenas incrementa 1 minuto para testes
    // Em producao, usar biblioteca como 'cron-parser'
    const next = new Date(now.getTime() + 60 * 1000);

    // Ajustar para o proximo horario baseado no cron
    if (parts.length >= 5) {
      const [minute, hour] = parts;

      if (minute !== '*' && !minute.startsWith('*/')) {
        next.setMinutes(parseInt(minute, 10));
      }

      if (hour !== '*' && !hour.startsWith('*/')) {
        next.setHours(parseInt(hour, 10));
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
      }
    }

    return next;
  }

  // CRUD operations

  async findAll(tenantId: string, entityId?: string) {
    return this.prisma.scheduledTask.findMany({
      where: {
        tenantId,
        ...(entityId && { entityId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const task = await this.prisma.scheduledTask.findFirst({
      where: { id, tenantId },
    });

    if (!task) {
      throw new NotFoundException('Scheduled Task nao encontrada');
    }

    return task;
  }

  async create(tenantId: string, dto: CreateScheduledTaskDto) {
    const nextRun = this.calculateNextRun(dto.cronExpression, dto.timezone || 'America/Sao_Paulo');

    return this.prisma.scheduledTask.create({
      data: {
        tenantId,
        entityId: dto.entityId,
        name: dto.name,
        description: dto.description,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone || 'America/Sao_Paulo',
        actionType: dto.actionType,
        actionConfig: dto.actionConfig as Prisma.InputJsonValue,
        nextRunAt: nextRun,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateScheduledTaskDto) {
    await this.findOne(id, tenantId);

    const updateData: Prisma.ScheduledTaskUpdateInput = {
      entityId: dto.entityId,
      name: dto.name,
      description: dto.description,
      cronExpression: dto.cronExpression,
      timezone: dto.timezone,
      actionType: dto.actionType,
      actionConfig: dto.actionConfig as Prisma.InputJsonValue,
      isActive: dto.isActive,
      updatedAt: new Date(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    // Recalcular nextRunAt se cron mudou
    if (dto.cronExpression || dto.timezone) {
      const current = await this.prisma.scheduledTask.findUnique({ where: { id } });
      updateData.nextRunAt = this.calculateNextRun(
        dto.cronExpression || current!.cronExpression,
        dto.timezone || current!.timezone,
      );
    }

    return this.prisma.scheduledTask.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.scheduledTask.delete({
      where: { id },
    });
  }

  async getExecutions(taskId: string, tenantId: string, page = 1, limit = 20) {
    await this.findOne(taskId, tenantId);

    const [data, total] = await Promise.all([
      this.prisma.scheduledTaskExecution.findMany({
        where: { scheduledTaskId: taskId },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.scheduledTaskExecution.count({ where: { scheduledTaskId: taskId } }),
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
   * Executa uma task manualmente (fora do schedule)
   */
  async runManually(id: string, tenantId: string) {
    const task = await this.findOne(id, tenantId);

    // Executar em background
    this.runTask(task).catch((err) => {
      const error = err as Error;
      this.logger.error(`Erro ao executar task ${id} manualmente: ${error.message}`);
    });

    return { message: 'Task iniciada', taskId: id };
  }
}
