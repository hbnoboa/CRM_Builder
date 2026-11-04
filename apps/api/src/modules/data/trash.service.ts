import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityDataQueryService } from '../../common/services/entity-data-query.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../../common/types';

export const TRASH_RETENTION_OPTIONS = [30, 60, 90, 180, 365] as const;
const PURGE_BATCH = 500;

/** Item da lixeira: so a "raiz" de cada exclusao (sub-registros vao junto com o pai). */
const ROOTS_ONLY: Prisma.EntityDataWhereInput = {
  OR: [{ parentRecordId: null }, { parentRecord: { deletedAt: null } }],
};

interface EntityLite { id: string; slug: string; name: string; icon: string | null; color: string | null; settings: Prisma.JsonValue; fields: Prisma.JsonValue }

/**
 * Lixeira: registros excluidos (soft delete) de todas as tabelas em que a pessoa
 * pode excluir, com as MESMAS regras de visibilidade da leitura (escopo, filtros do
 * cargo e da tabela) via EntityDataQueryService. Apagamento automatico so se a
 * empresa escolher um prazo (padrao: nunca).
 */
@Injectable()
export class TrashService {
  private readonly logger = new Logger(TrashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: EntityDataQueryService,
    private readonly customRoleService: CustomRoleService,
    private readonly auditService: AuditService,
  ) {}

  /** Tabelas em que a pessoa pode excluir (e portanto ver a lixeira). */
  private async deletableEntities(user: CurrentUser): Promise<EntityLite[]> {
    const entities = await this.prisma.entity.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, slug: true, name: true, icon: true, color: true, settings: true, fields: true },
      orderBy: { name: 'asc' },
    });
    const allowed = await Promise.all(
      entities.map((e) => this.customRoleService.hasEntityPermission(user.id, e.slug, 'canDelete')),
    );
    return entities.filter((_, i) => allowed[i]);
  }

  private async whereFor(user: CurrentUser, entity: EntityLite, search?: string): Promise<Prisma.EntityDataWhereInput> {
    const { where } = await this.queryService.buildWhere({
      entitySlug: entity.slug,
      user,
      includeChildren: true,
      onlyDeleted: true,
      search: search || undefined,
    });
    const and: Prisma.EntityDataWhereInput[] = [where, ROOTS_ONLY];
    // Tabela sem campos de busca configurados: na lixeira procura no titulo e nos textos.
    const configured = ((entity.settings ?? {}) as { searchFields?: string[] }).searchFields ?? [];
    if (search && configured.length === 0) and.push(this.textSearch(entity, search));
    return { AND: and };
  }

  private textSearch(entity: EntityLite, search: string): Prisma.EntityDataWhereInput {
    const settings = (entity.settings ?? {}) as { titleField?: string };
    const fields = (Array.isArray(entity.fields) ? entity.fields : []) as Array<{ slug?: string; type?: string }>;
    const slugs = [...new Set([
      settings.titleField,
      ...fields.filter((f) => ['text', 'textarea', 'email', 'phone', 'url'].includes(f.type ?? '')).map((f) => f.slug),
    ].filter((x): x is string => !!x))];
    if (slugs.length === 0) return { id: '__none__' };
    const capitalized = search.charAt(0).toUpperCase() + search.slice(1).toLowerCase();
    const variants = [...new Set([search, search.toLowerCase(), search.toUpperCase(), capitalized])];
    return { OR: slugs.flatMap((slug) => variants.map((term) => ({ data: { path: [slug], string_contains: term } }))) };
  }

  async tables(user: CurrentUser) {
    const entities = await this.deletableEntities(user);
    const counts = await Promise.all(
      entities.map(async (e) => this.prisma.entityData.count({ where: await this.whereFor(user, e) })),
    );
    return entities.map((e, i) => ({ slug: e.slug, name: e.name, icon: e.icon, color: e.color, count: counts[i] }));
  }

  async list(user: CurrentUser, query: { entitySlug?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const entities = (await this.deletableEntities(user)).filter((e) => !query.entitySlug || e.slug === query.entitySlug);
    const settings = await this.settings(user.tenantId);
    if (entities.length === 0) return { data: [], meta: { total: 0, page, limit, totalPages: 0 }, retentionDays: settings.retentionDays };

    const where: Prisma.EntityDataWhereInput = {
      OR: await Promise.all(entities.map((e) => this.whereFor(user, e, query.search))),
    };
    const [rows, total] = await Promise.all([
      this.prisma.entityData.findMany({
        where,
        orderBy: [{ deletedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, entityId: true, data: true, deletedAt: true, deletedById: true, createdById: true, parentRecordId: true },
      }),
      this.prisma.entityData.count({ where }),
    ]);

    const ids = rows.map((r) => r.id);
    const userIds = [...new Set(rows.flatMap((r) => [r.deletedById, r.createdById]).filter((x): x is string => !!x))];
    const [children, people] = await Promise.all([
      ids.length
        ? this.prisma.entityData.findMany({
            where: { parentRecordId: { in: ids }, deletedAt: { not: null } },
            select: { parentRecordId: true, deletedAt: true },
          })
        : [],
      userIds.length ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    ]);
    const byEntity = new Map(entities.map((e) => [e.id, e]));
    const nameOf = new Map(people.map((p) => [p.id, p.name]));

    const data = rows.map((r) => {
      const entity = byEntity.get(r.entityId)!;
      const sameOperation = children.filter(
        (c) => c.parentRecordId === r.id && c.deletedAt?.getTime() === r.deletedAt?.getTime(),
      ).length;
      return {
        id: r.id,
        entity: { slug: entity.slug, name: entity.name, icon: entity.icon, color: entity.color },
        title: this.titleOf(entity, r.data as Record<string, unknown>) ?? r.id,
        deletedAt: r.deletedAt,
        deletedBy: r.deletedById ? { id: r.deletedById, name: nameOf.get(r.deletedById) ?? null } : null,
        createdBy: r.createdById ? { id: r.createdById, name: nameOf.get(r.createdById) ?? null } : null,
        subRecords: sameOperation,
        isSubRecord: !!r.parentRecordId,
        purgeAt: settings.retentionDays && r.deletedAt
          ? new Date(r.deletedAt.getTime() + settings.retentionDays * 86_400_000)
          : null,
      };
    });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) }, retentionDays: settings.retentionDays };
  }

  /** Titulo do registro: campo de titulo da tabela, senao o primeiro texto preenchido. */
  private titleOf(entity: EntityLite, data: Record<string, unknown>): string | null {
    const settings = (entity.settings ?? {}) as { titleField?: string };
    const fields = (Array.isArray(entity.fields) ? entity.fields : []) as Array<{ slug?: string }>;
    const candidates = [settings.titleField, 'nome', 'name', 'titulo', 'title', ...fields.map((f) => f.slug)];
    for (const key of candidates) {
      if (!key) continue;
      const value = data?.[key];
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 200);
      if (typeof value === 'number') return String(value);
    }
    return null;
  }

  // ── Prazo e esvaziar ────────────────────────────────────────────────────

  async settings(tenantId: string): Promise<{ retentionDays: number | null }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const raw = ((tenant?.settings ?? {}) as { trash?: { retentionDays?: unknown } }).trash?.retentionDays;
    return { retentionDays: TRASH_RETENTION_OPTIONS.includes(raw as never) ? (raw as number) : null };
  }

  async updateSettings(user: CurrentUser, retentionDays: number | null) {
    if (retentionDays !== null && !TRASH_RETENTION_OPTIONS.includes(retentionDays as never)) {
      throw new BadRequestException(`Prazo invalido. Opcoes: ${TRASH_RETENTION_OPTIONS.join(', ')} dias ou nunca`);
    }
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { settings: true } });
    const current = (tenant.settings ?? {}) as Record<string, unknown>;
    await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: { settings: { ...current, trash: { retentionDays } } as unknown as Prisma.InputJsonValue },
    });
    this.auditService.log(user, {
      action: 'update', resource: 'tenant', resourceId: user.tenantId,
      metadata: { trashRetentionDays: retentionDays },
    }).catch(() => {});
    return { retentionDays };
  }

  /** Esvazia a lixeira da empresa (ou de uma tabela). Pula quem tem sub-registro em uso. */
  async empty(user: CurrentUser, entitySlug?: string) {
    let entityId: string | undefined;
    if (entitySlug) {
      const entity = await this.prisma.entity.findFirst({ where: { tenantId: user.tenantId, slug: entitySlug }, select: { id: true } });
      if (!entity) throw new BadRequestException('Tabela nao encontrada');
      entityId = entity.id;
    }
    const purged = await this.purgeWhere(user.tenantId, { entityId });
    this.auditService.log(user, {
      action: 'purge', resource: 'entity_data',
      metadata: { emptyTrash: true, entitySlug: entitySlug ?? null, purged },
    }).catch(() => {});
    return { purged };
  }

  /** Apaga em lotes; nunca derruba um sub-registro que esteja em uso. */
  private async purgeWhere(tenantId: string, opts: { entityId?: string; before?: Date }): Promise<number> {
    let total = 0;
    for (;;) {
      const deleted = await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM "EntityData" WHERE id IN (
          SELECT e.id FROM "EntityData" e
          WHERE e."tenantId" = ${tenantId}
            AND e."deletedAt" IS NOT NULL
            ${opts.entityId ? Prisma.sql`AND e."entityId" = ${opts.entityId}` : Prisma.empty}
            ${opts.before ? Prisma.sql`AND e."deletedAt" < ${opts.before}` : Prisma.empty}
            AND NOT EXISTS (SELECT 1 FROM "EntityData" c WHERE c."parentRecordId" = e.id AND c."deletedAt" IS NULL)
          LIMIT ${PURGE_BATCH}
        )
      `);
      total += deleted;
      if (deleted < PURGE_BATCH) return total;
    }
  }

  /** Todo dia: apaga o que passou do prazo nas empresas que escolheram um prazo. */
  @Cron('30 3 * * *', { name: 'trash-retention', timeZone: 'America/Sao_Paulo' })
  async purgeExpired(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null, settings: { path: ['trash', 'retentionDays'], not: Prisma.AnyNull } },
      select: { id: true, slug: true, settings: true },
    });
    for (const t of tenants) {
      const { retentionDays } = await this.settings(t.id);
      if (!retentionDays) continue;
      const purged = await this.purgeWhere(t.id, { before: new Date(Date.now() - retentionDays * 86_400_000) });
      if (purged > 0) this.logger.log(`[lixeira] ${t.slug}: ${purged} registros apagados (prazo ${retentionDays} dias)`);
    }
  }
}
