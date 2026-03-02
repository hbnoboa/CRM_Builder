import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface ExecutionLogEntry {
  id: string;
  type: 'webhook' | 'action-chain' | 'scheduled-task' | 'api-execution';
  name: string;
  status: string;
  duration?: number;
  error?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

interface QueryExecutionLogsDto {
  page?: number;
  limit?: number;
  type?: 'webhook' | 'action-chain' | 'scheduled-task' | 'api-execution';
  status?: 'success' | 'error' | 'timeout';
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class ExecutionLogsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista execucoes unificadas de todos os tipos
   */
  async findAll(tenantId: string, query: QueryExecutionLogsDto = {}) {
    const { page = 1, limit = 50, type, status, startDate, endDate } = query;

    const allLogs: ExecutionLogEntry[] = [];

    // Construir filtros de data
    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = startDate;
      if (endDate) dateFilter.createdAt.lte = endDate;
    }

    // Webhook executions
    if (!type || type === 'webhook') {
      const webhooks = await this.prisma.webhookExecution.findMany({
        where: {
          webhook: { tenantId },
          ...(status && { status }),
          ...dateFilter,
        },
        include: {
          webhook: { select: { name: true, url: true, events: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
      });

      for (const exec of webhooks) {
        allLogs.push({
          id: exec.id,
          type: 'webhook',
          name: exec.webhook.name,
          status: exec.status,
          duration: exec.responseTime ?? undefined,
          error: exec.errorMessage ?? undefined,
          createdAt: exec.createdAt,
          metadata: {
            webhookId: exec.webhookId,
            url: exec.webhook.url,
            httpStatus: exec.responseStatus,
            requestPayload: exec.requestBody,
            responsePayload: exec.responseBody,
          },
        });
      }
    }

    // Action chain executions
    if (!type || type === 'action-chain') {
      const chains = await this.prisma.actionChainExecution.findMany({
        where: {
          actionChain: { tenantId },
          ...(status && { status }),
          ...(startDate || endDate
            ? {
                startedAt: {
                  ...(startDate && { gte: startDate }),
                  ...(endDate && { lte: endDate }),
                },
              }
            : {}),
        },
        include: {
          actionChain: { select: { name: true, trigger: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: limit * 2,
      });

      for (const exec of chains) {
        allLogs.push({
          id: exec.id,
          type: 'action-chain',
          name: exec.actionChain.name,
          status: exec.status,
          duration: exec.duration ?? undefined,
          error: exec.errorMessage ?? undefined,
          createdAt: exec.startedAt,
          metadata: {
            actionChainId: exec.actionChainId,
            trigger: exec.actionChain.trigger,
            triggeredBy: exec.triggeredBy,
            currentStep: exec.currentStep,
            totalSteps: exec.totalSteps,
            stepResults: exec.stepResults,
          },
        });
      }
    }

    // Scheduled task executions
    if (!type || type === 'scheduled-task') {
      const tasks = await this.prisma.scheduledTaskExecution.findMany({
        where: {
          scheduledTask: { tenantId },
          ...(status && { status }),
          ...(startDate || endDate
            ? {
                startedAt: {
                  ...(startDate && { gte: startDate }),
                  ...(endDate && { lte: endDate }),
                },
              }
            : {}),
        },
        include: {
          scheduledTask: { select: { name: true, cronExpression: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: limit * 2,
      });

      for (const exec of tasks) {
        allLogs.push({
          id: exec.id,
          type: 'scheduled-task',
          name: exec.scheduledTask.name,
          status: exec.status,
          duration: exec.duration ?? undefined,
          error: exec.errorMessage ?? undefined,
          createdAt: exec.startedAt,
          metadata: {
            scheduledTaskId: exec.scheduledTaskId,
            cronExpression: exec.scheduledTask.cronExpression,
            outputData: exec.outputData,
          },
        });
      }
    }

    // API execution logs
    if (!type || type === 'api-execution') {
      const apiLogs = await this.prisma.apiExecutionLog.findMany({
        where: {
          tenantId,
          ...(status && { status }),
          ...dateFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
      });

      // Buscar nomes das custom APIs se houver IDs
      const customApiIds = [...new Set(apiLogs.map((l) => l.customApiId).filter(Boolean))] as string[];
      const customApis = customApiIds.length > 0
        ? await this.prisma.customEndpoint.findMany({
            where: { id: { in: customApiIds } },
            select: { id: true, name: true, path: true },
          })
        : [];
      const customApiMap = new Map(customApis.map((a) => [a.id, a]));

      for (const log of apiLogs) {
        const customApi = log.customApiId ? customApiMap.get(log.customApiId) : undefined;
        allLogs.push({
          id: log.id,
          type: 'api-execution',
          name: customApi?.name || `API ${log.path || log.customApiId?.slice(0, 8) || 'unknown'}`,
          status: log.status,
          duration: log.duration ?? undefined,
          error: log.errorMessage ?? undefined,
          createdAt: log.createdAt,
          metadata: {
            customApiId: log.customApiId,
            webhookId: log.webhookId,
            actionChainId: log.actionChainId,
            endpointPath: customApi?.path,
            method: log.method,
            path: log.path,
            inputPayload: log.inputPayload,
            outputPayload: log.outputPayload,
          },
        });
      }
    }

    // Ordenar por data e paginar
    allLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = (page - 1) * limit;
    const paginatedLogs = allLogs.slice(offset, offset + limit);
    const total = allLogs.length;

    return {
      data: paginatedLogs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Estatisticas de execucoes
   */
  async getStats(tenantId: string, period: 'day' | 'week' | 'month' = 'day') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const [webhookStats, chainStats, taskStats, apiStats] = await Promise.all([
      this.prisma.webhookExecution.groupBy({
        by: ['status'],
        where: {
          webhook: { tenantId },
          createdAt: { gte: startDate },
        },
        _count: true,
      }),
      this.prisma.actionChainExecution.groupBy({
        by: ['status'],
        where: {
          actionChain: { tenantId },
          startedAt: { gte: startDate },
        },
        _count: true,
      }),
      this.prisma.scheduledTaskExecution.groupBy({
        by: ['status'],
        where: {
          scheduledTask: { tenantId },
          startedAt: { gte: startDate },
        },
        _count: true,
      }),
      this.prisma.apiExecutionLog.groupBy({
        by: ['status'],
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),
    ]);

    const formatStats = (stats: Array<{ status: string; _count: number }>) => {
      const result: Record<string, number> = { success: 0, error: 0, timeout: 0, total: 0 };
      for (const stat of stats) {
        result[stat.status] = stat._count;
        result.total += stat._count;
      }
      return result;
    };

    return {
      period,
      startDate,
      endDate: now,
      webhook: formatStats(webhookStats),
      actionChain: formatStats(chainStats),
      scheduledTask: formatStats(taskStats),
      apiExecution: formatStats(apiStats),
      totals: {
        success:
          webhookStats.filter((s) => s.status === 'success').reduce((acc, s) => acc + s._count, 0) +
          chainStats.filter((s) => s.status === 'success').reduce((acc, s) => acc + s._count, 0) +
          taskStats.filter((s) => s.status === 'success').reduce((acc, s) => acc + s._count, 0) +
          apiStats.filter((s) => s.status === 'success').reduce((acc, s) => acc + s._count, 0),
        error:
          webhookStats.filter((s) => s.status === 'error').reduce((acc, s) => acc + s._count, 0) +
          chainStats.filter((s) => s.status === 'error').reduce((acc, s) => acc + s._count, 0) +
          taskStats.filter((s) => s.status === 'error').reduce((acc, s) => acc + s._count, 0) +
          apiStats.filter((s) => s.status === 'error').reduce((acc, s) => acc + s._count, 0),
        total:
          webhookStats.reduce((acc, s) => acc + s._count, 0) +
          chainStats.reduce((acc, s) => acc + s._count, 0) +
          taskStats.reduce((acc, s) => acc + s._count, 0) +
          apiStats.reduce((acc, s) => acc + s._count, 0),
      },
    };
  }

  /**
   * Busca detalhes de uma execucao especifica
   */
  async findOne(tenantId: string, id: string, type: string) {
    switch (type) {
      case 'webhook':
        return this.prisma.webhookExecution.findFirst({
          where: { id, webhook: { tenantId } },
          include: { webhook: true },
        });
      case 'action-chain':
        return this.prisma.actionChainExecution.findFirst({
          where: { id, actionChain: { tenantId } },
          include: { actionChain: true },
        });
      case 'scheduled-task':
        return this.prisma.scheduledTaskExecution.findFirst({
          where: { id, scheduledTask: { tenantId } },
          include: { scheduledTask: true },
        });
      case 'api-execution':
        return this.prisma.apiExecutionLog.findFirst({
          where: { id, tenantId },
        });
      default:
        return null;
    }
  }
}
