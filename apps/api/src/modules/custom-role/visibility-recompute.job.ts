import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Consumidor da outbox `visibility_recompute`. Substitui o trigger sincrono
 * trg_custom_role_permissions: quando um cargo muda os filtros, a app enfileira
 * as entidades afetadas; este poller recomputa a visibilidade do PowerSync em
 * LOTES, fora do request. Transacoes curtas (1 lote por passo) -> sem 504, sem
 * lock longo. Os filhos cascateiam via o trigger AFTER de propagacao ja existente.
 */
@Injectable()
export class VisibilityRecomputeJob {
  private readonly logger = new Logger(VisibilityRecomputeJob.name);
  private running = false;

  /** Linhas recomputadas por lote (transacao). */
  private static readonly BATCH = 500;
  /** Lotes por tick (limita o trabalho por ciclo, mas drena rapido). */
  private static readonly MAX_STEPS_PER_TICK = 20;

  constructor(private readonly prisma: PrismaService) {}

  @Interval('visibility-recompute-drain', 2000)
  async drain(): Promise<void> {
    if (this.running) return; // evita sobreposicao de ticks
    this.running = true;
    try {
      for (let i = 0; i < VisibilityRecomputeJob.MAX_STEPS_PER_TICK; i++) {
        const drained = await this.step();
        if (drained) break; // fila vazia
      }
    } catch (e) {
      this.logger.error(`erro no drain de visibilidade: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Processa 1 lote de 1 job. Retorna true se a fila estava vazia. */
  private async step(): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        // Reivindica 1 job sem competir com outras instancias.
        const jobs = await tx.$queryRawUnsafe<
          Array<{ id: string; tenantId: string; entitySlug: string; cursor: string }>
        >(
          `SELECT id::text AS id, "tenantId", "entitySlug", cursor
             FROM "visibility_recompute"
            ORDER BY id
            LIMIT 1
            FOR UPDATE SKIP LOCKED`,
        );
        if (jobs.length === 0) return true;
        const job = jobs[0];

        const entity = await tx.entity.findFirst({
          where: { tenantId: job.tenantId, slug: job.entitySlug },
          select: { id: true },
        });
        if (!entity) {
          // entidade sumiu: descarta o job
          await tx.$executeRawUnsafe(
            `DELETE FROM "visibility_recompute" WHERE id = $1::bigint`,
            job.id,
          );
          return false;
        }

        const res = await tx.$queryRawUnsafe<Array<{ last_id: string; n: number }>>(
          `SELECT last_id, n FROM recompute_visibility_batch($1, $2, $3, $4::int)`,
          job.tenantId,
          entity.id,
          job.cursor,
          VisibilityRecomputeJob.BATCH,
        );
        const n = Number(res[0]?.n ?? 0);
        const lastId = res[0]?.last_id ?? job.cursor;

        if (n < VisibilityRecomputeJob.BATCH) {
          // lote parcial/vazio => acabou essa entidade
          await tx.$executeRawUnsafe(
            `DELETE FROM "visibility_recompute" WHERE id = $1::bigint`,
            job.id,
          );
          this.logger.log(
            `recompute concluido: tenant=${job.tenantId} entidade=${job.entitySlug} (ultimo lote=${n})`,
          );
        } else {
          // ainda ha linhas => avanca o cursor
          await tx.$executeRawUnsafe(
            `UPDATE "visibility_recompute" SET cursor = $1 WHERE id = $2::bigint`,
            lastId,
            job.id,
          );
        }
        return false;
      },
      { timeout: 30000 },
    );
  }
}
