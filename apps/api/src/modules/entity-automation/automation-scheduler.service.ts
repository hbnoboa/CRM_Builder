import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AutomationExecutorService, AutomationContext } from './automation-executor.service';
import { AutomationTrigger } from '@prisma/client';

@Injectable()
export class AutomationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationSchedulerService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: AutomationExecutorService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando scheduler de automacoes (intervalo: 60s)');
    this.intervalHandle = setInterval(() => {
      this.tick().catch((err) => {
        this.logger.error(`Erro no tick do scheduler: ${err.message}`);
      });
    }, 60 * 1000); // A cada 60 segundos

    // Executar imediatamente ao iniciar
    this.tick().catch((err) => {
      this.logger.error(`Erro no tick inicial do scheduler: ${err.message}`);
    });
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('Scheduler de automacoes parado');
  }

  /**
   * Tick do scheduler: busca automacoes agendadas prontas para executar.
   */
  private async tick(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Tick anterior ainda em execucao, ignorando');
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();

      // Buscar automacoes agendadas que precisam executar
      const automations = await this.prisma.entityAutomation.findMany({
        where: {
          trigger: AutomationTrigger.SCHEDULE,
          isActive: true,
          nextRunAt: {
            lte: now,
          },
        },
        include: {
          entity: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      });

      if (automations.length === 0) {
        return;
      }

      this.logger.log(
        `Scheduler encontrou ${automations.length} automacao(oes) para executar`,
      );

      for (const automation of automations) {
        try {
          const context: AutomationContext = {
            tenantId: automation.tenantId,
            triggeredBy: 'scheduler:cron',
            entity: {
              id: automation.entity.id,
              slug: automation.entity.slug,
              name: automation.entity.name,
            },
          };

          // Executar em fire-and-forget para nao bloquear outras automacoes
          this.executor
            .executeAutomation(automation, context)
            .then((executionId) => {
              if (executionId) {
                this.logger.log(
                  `Automacao agendada ${automation.id} executada: ${executionId}`,
                );
              }
            })
            .catch((err) => {
              this.logger.error(
                `Erro ao executar automacao agendada ${automation.id}: ${err.message}`,
              );
            });

          // Calcular proxima execucao
          const nextRunAt = this.calculateNextRun(automation.triggerConfig);

          await this.prisma.entityAutomation.update({
            where: { id: automation.id },
            data: {
              lastRunAt: now,
              nextRunAt,
            },
          });
        } catch (err) {
          const error = err as Error;
          this.logger.error(
            `Erro ao processar automacao agendada ${automation.id}: ${error.message}`,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Calcula a proxima execucao baseada na configuracao de trigger.
   *
   * Suporta formato cron simplificado: "minuto hora dia mes dia-da-semana"
   * Para producao completa, instalar e usar o pacote 'cron-parser'.
   */
  calculateNextRun(triggerConfig: unknown): Date {
    const config = triggerConfig as {
      cronExpression?: string;
      intervalMinutes?: number;
      timezone?: string;
    } | null;

    // Se tem intervalo em minutos, usar calculo simples
    if (config?.intervalMinutes) {
      return new Date(Date.now() + config.intervalMinutes * 60 * 1000);
    }

    // Se tem cron expression, calcular proxima execucao
    if (config?.cronExpression) {
      return this.parseCronExpression(config.cronExpression);
    }

    // Fallback: proximo minuto
    return new Date(Date.now() + 60 * 1000);
  }

  // Parser simplificado de cron expression.
  // Formato: "minuto hora dia-do-mes mes dia-da-semana"
  //
  // Exemplos:
  //  "0 9 * * *"     => todo dia as 9h
  //  "*/15 * * * *"  => a cada 15 minutos
  //  "30 14 * * 1"   => toda segunda as 14:30
  //  "0 0 1 * *"     => todo dia 1 a meia-noite
  //
  // NOTA: Para suporte completo a cron, instalar o pacote 'cron-parser'.
  private parseCronExpression(expression: string): Date {
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) {
      this.logger.warn(`Cron expression invalida: "${expression}", usando intervalo padrao`);
      return new Date(Date.now() + 60 * 1000);
    }

    const [minuteExpr, hourExpr, dayExpr, monthExpr, dowExpr] = parts;
    const now = new Date();

    // Tratar expressoes com intervalo "*/N"
    if (minuteExpr.startsWith('*/')) {
      const interval = parseInt(minuteExpr.slice(2), 10);
      if (!isNaN(interval) && interval > 0) {
        const currentMinute = now.getMinutes();
        const nextMinute =
          Math.ceil((currentMinute + 1) / interval) * interval;
        const next = new Date(now);
        next.setSeconds(0, 0);

        if (nextMinute >= 60) {
          next.setMinutes(0);
          next.setHours(next.getHours() + 1);
        } else {
          next.setMinutes(nextMinute);
        }

        return next;
      }
    }

    // Para expressoes fixas de hora e minuto
    const next = new Date(now);
    next.setSeconds(0, 0);

    const targetMinute =
      minuteExpr !== '*' && !minuteExpr.startsWith('*/')
        ? parseInt(minuteExpr, 10)
        : null;
    const targetHour =
      hourExpr !== '*' && !hourExpr.startsWith('*/')
        ? parseInt(hourExpr, 10)
        : null;
    const targetDay =
      dayExpr !== '*' && !dayExpr.startsWith('*/')
        ? parseInt(dayExpr, 10)
        : null;
    const targetMonth =
      monthExpr !== '*' && !monthExpr.startsWith('*/')
        ? parseInt(monthExpr, 10) - 1 // meses 0-indexed
        : null;
    const targetDow =
      dowExpr !== '*' && !dowExpr.startsWith('*/')
        ? parseInt(dowExpr, 10)
        : null;

    // Definir minuto e hora alvo
    if (targetMinute !== null) {
      next.setMinutes(targetMinute);
    }

    if (targetHour !== null) {
      next.setHours(targetHour);
    }

    if (targetDay !== null) {
      next.setDate(targetDay);
    }

    if (targetMonth !== null) {
      next.setMonth(targetMonth);
    }

    // Se a data calculada ja passou, avançar para o proximo periodo
    if (next <= now) {
      if (targetDay !== null && targetMonth === null) {
        // Dia fixo do mes: avancar para proximo mes
        next.setMonth(next.getMonth() + 1);
      } else if (targetHour !== null && targetDay === null) {
        // Hora fixa: avancar para proximo dia
        next.setDate(next.getDate() + 1);
      } else if (targetMinute !== null && targetHour === null) {
        // Minuto fixo: avancar para proxima hora
        next.setHours(next.getHours() + 1);
      } else if (targetMonth !== null) {
        // Mes fixo: avancar para proximo ano
        next.setFullYear(next.getFullYear() + 1);
      } else {
        // Fallback: proximo minuto
        next.setTime(now.getTime() + 60 * 1000);
      }
    }

    // Tratar dia da semana (DOW)
    if (targetDow !== null) {
      const currentDow = next.getDay();
      let daysUntil = targetDow - currentDow;
      if (daysUntil <= 0) daysUntil += 7;
      if (daysUntil === 0 && next <= now) daysUntil = 7;
      next.setDate(next.getDate() + daysUntil);

      if (targetHour !== null) next.setHours(targetHour);
      if (targetMinute !== null) next.setMinutes(targetMinute);
    }

    return next;
  }
}
