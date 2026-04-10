import { Controller, Get, Post, Delete, Param, Query, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../common/types';

@Controller('automation-queue')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiTags('Automation Queue')
@ApiBearerAuth()
export class AutomationQueueController {
  constructor(
    @InjectQueue('automation-execution') private readonly queue: Queue,
  ) {}

  @Get('stats')
  @RequireModulePermission('automations', 'canRead')
  @ApiOperation({ summary: 'Obter estatísticas da fila' })
  async getStats() {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.getPausedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + delayed + paused,
    };
  }

  @Get('jobs')
  @RequireModulePermission('automations', 'canRead')
  @ApiOperation({ summary: 'Listar jobs' })
  async getJobs(
    @Query('status') status?: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    @Query('limit') limit = 50,
  ) {
    const maxLimit = Math.min(limit, 100);
    let jobs;

    switch (status) {
      case 'waiting':
        jobs = await this.queue.getWaiting(0, maxLimit);
        break;
      case 'active':
        jobs = await this.queue.getActive(0, maxLimit);
        break;
      case 'completed':
        jobs = await this.queue.getCompleted(0, maxLimit);
        break;
      case 'failed':
        jobs = await this.queue.getFailed(0, maxLimit);
        break;
      case 'delayed':
        jobs = await this.queue.getDelayed(0, maxLimit);
        break;
      default:
        // Retorna todos os tipos
        const [waiting, active, failed] = await Promise.all([
          this.queue.getWaiting(0, 20),
          this.queue.getActive(0, 20),
          this.queue.getFailed(0, 10),
        ]);
        jobs = [...active, ...waiting, ...failed].slice(0, maxLimit);
    }

    return jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace?.slice(0, 500), // Limitar stacktrace
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
    }));
  }

  @Get('jobs/failed')
  @RequireModulePermission('automations', 'canRead')
  @ApiOperation({ summary: 'Listar jobs falhados' })
  async getFailedJobs(@Query('limit') limit = 50) {
    const maxLimit = Math.min(limit, 100);
    const failed = await this.queue.getFailed(0, maxLimit);

    return failed.map(job => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      timestamp: job.timestamp,
      attemptsMade: job.attemptsMade,
      opts: {
        attempts: job.opts.attempts,
        backoff: job.opts.backoff,
      },
    }));
  }

  @Get('jobs/:id')
  @RequireModulePermission('automations', 'canRead')
  @ApiOperation({ summary: 'Obter detalhes de um job' })
  async getJob(@Param('id') jobId: string) {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Job não encontrado');
    }

    const state = await job.getState();
    const logs = await this.queue.client.lrange(`bull:automation-execution:${jobId}:logs`, 0, -1);

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
      logs,
      opts: job.opts,
    };
  }

  @Post('jobs/:id/retry')
  @RequireModulePermission('automations', 'canUpdate')
  @ApiOperation({ summary: 'Retentar job falhado' })
  async retryJob(@Param('id') jobId: string) {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Job não encontrado');
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new BadRequestException('Apenas jobs falhados podem ser retentados');
    }

    await job.retry();

    return {
      success: true,
      message: 'Job reenfileirado para retry',
      jobId: job.id,
    };
  }

  @Delete('jobs/:id')
  @RequireModulePermission('automations', 'canDelete')
  @ApiOperation({ summary: 'Remover job da fila' })
  async removeJob(@Param('id') jobId: string) {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Job não encontrado');
    }

    await job.remove();

    return {
      success: true,
      message: 'Job removido',
      jobId,
    };
  }

  @Post('clean')
  @RequireModulePermission('automations', 'canDelete')
  @ApiOperation({ summary: 'Limpar jobs completados/falhados antigos' })
  async cleanQueue(
    @Query('grace') grace = 86400000, // 24h em ms
    @Query('status') status: 'completed' | 'failed' = 'completed',
  ) {
    await this.queue.clean(grace, status);

    return {
      success: true,
      message: `Jobs ${status} mais antigos que ${grace}ms foram removidos`,
    };
  }

  @Post('pause')
  @RequireModulePermission('automations', 'canUpdate')
  @ApiOperation({ summary: 'Pausar processamento da fila' })
  async pauseQueue() {
    await this.queue.pause();

    return {
      success: true,
      message: 'Fila pausada',
    };
  }

  @Post('resume')
  @RequireModulePermission('automations', 'canUpdate')
  @ApiOperation({ summary: 'Resumir processamento da fila' })
  async resumeQueue() {
    await this.queue.resume();

    return {
      success: true,
      message: 'Fila resumida',
    };
  }

  @Delete('clear')
  @RequireModulePermission('automations', 'canDelete')
  @ApiOperation({ summary: 'Limpar TODOS os jobs (CUIDADO!)' })
  async clearQueue(@CurrentUser() user: CurrentUserType) {
    // Apenas PLATFORM_ADMIN pode limpar tudo
    if (user.customRole.roleType !== 'PLATFORM_ADMIN') {
      throw new BadRequestException('Apenas PLATFORM_ADMIN pode limpar a fila completamente');
    }

    await this.queue.empty();

    return {
      success: true,
      message: 'Fila completamente limpa',
    };
  }
}
