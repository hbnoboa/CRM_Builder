import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementSeverity, Prisma, TenantLifecycle } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { hasFullTenantAccess } from '../../common/utils/platform-access';
import { PlatformAuditService } from '../platform/platform-audit.service';
import type { PlatformStaffPrincipal } from '../platform/platform-permissions';

export const AUDIENCE_TYPES = ['all', 'plans', 'lifecycles', 'tenants'] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];
export interface Audience { type: AudienceType; ids: string[] }

export interface AnnouncementInput {
  title: string;
  body: string;
  severity?: AnnouncementSeverity;
  audience?: Audience;
  adminsOnly?: boolean;
  dismissible?: boolean;
  linkUrl?: string | null;
  linkLabel?: string | null;
  startsAt?: string;
  endsAt?: string | null;
}

const SEVERITY_ORDER: Record<AnnouncementSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

function audienceOf(raw: unknown): Audience {
  const a = (raw ?? {}) as Partial<Audience>;
  const type = AUDIENCE_TYPES.includes(a.type as AudienceType) ? (a.type as AudienceType) : 'all';
  return { type, ids: Array.isArray(a.ids) ? a.ids.filter((x): x is string => typeof x === 'string') : [] };
}

/** Filtro de empresas do publico (empresas ativas; canceladas nao recebem). */
function tenantWhere(audience: Audience): Prisma.TenantWhereInput {
  const base: Prisma.TenantWhereInput = { deletedAt: null, lifecycle: { not: 'CANCELED' } };
  switch (audience.type) {
    case 'plans': return { ...base, planId: { in: audience.ids } };
    case 'lifecycles': return { ...base, lifecycle: { in: audience.ids.filter((x) => x in TenantLifecycle) as TenantLifecycle[] } };
    case 'tenants': return { ...base, id: { in: audience.ids } };
    default: return base;
  }
}

/**
 * Comunicados da plataforma: o console cria e publica; o sistema mostra uma
 * faixa para as empresas do publico, e cada pessoa pode fechar (se permitido).
 */
@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  // ── Sistema (cliente) ───────────────────────────────────────────────────

  async activeFor(user: CurrentUser) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { id: true, planId: true, lifecycle: true } });
    if (!tenant) return [];
    const now = new Date();
    const rows = await this.prisma.announcement.findMany({
      where: {
        publishedAt: { not: null },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        dismissals: { none: { userId: user.id } },
      },
      orderBy: { startsAt: 'desc' },
      take: 50,
    });
    const mp = user.customRole?.modulePermissions as Record<string, { canUpdate?: boolean }> | undefined;
    const isAdmin = hasFullTenantAccess(mp) || mp?.settings?.canUpdate === true;
    return rows
      .filter((a) => {
        if (a.adminsOnly && !isAdmin) return false;
        const aud = audienceOf(a.audience);
        if (aud.type === 'all') return true;
        if (aud.type === 'plans') return !!tenant.planId && aud.ids.includes(tenant.planId);
        if (aud.type === 'lifecycles') return aud.ids.includes(tenant.lifecycle);
        return aud.ids.includes(tenant.id);
      })
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .slice(0, 5)
      .map((a) => ({
        id: a.id, title: a.title, body: a.body, severity: a.severity, dismissible: a.dismissible,
        linkUrl: a.linkUrl, linkLabel: a.linkLabel, startsAt: a.startsAt,
      }));
  }

  async dismiss(user: CurrentUser, id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id }, select: { dismissible: true, publishedAt: true } });
    if (!a || !a.publishedAt) throw new NotFoundException('Comunicado nao encontrado');
    if (!a.dismissible) throw new BadRequestException('Este comunicado nao pode ser fechado');
    await this.prisma.announcementDismissal.upsert({
      where: { announcementId_userId: { announcementId: id, userId: user.id } },
      create: { announcementId: id, userId: user.id, tenantId: user.tenantId },
      update: {},
    });
    return { success: true };
  }

  // ── Console ─────────────────────────────────────────────────────────────

  async list() {
    const rows = await this.prisma.announcement.findMany({
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
      include: { _count: { select: { dismissals: true } } },
    });
    const now = Date.now();
    return Promise.all(rows.map(async ({ _count, ...a }) => ({
      ...a,
      audience: audienceOf(a.audience),
      dismissals: _count.dismissals,
      reach: await this.prisma.tenant.count({ where: tenantWhere(audienceOf(a.audience)) }),
      state: !a.publishedAt ? 'draft'
        : a.endsAt && a.endsAt.getTime() <= now ? 'ended'
          : a.startsAt.getTime() > now ? 'scheduled' : 'active',
    })));
  }

  async reach(audience: unknown) {
    return { tenants: await this.prisma.tenant.count({ where: tenantWhere(audienceOf(audience)) }) };
  }

  private validate(input: AnnouncementInput) {
    if (input.linkUrl && !/^https?:\/\//i.test(input.linkUrl)) throw new BadRequestException('O link precisa comecar com http:// ou https://');
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new BadRequestException('O fim precisa ser depois do inicio');
    }
    const aud = input.audience ? audienceOf(input.audience) : undefined;
    if (aud && aud.type !== 'all' && aud.ids.length === 0) throw new BadRequestException('Escolha ao menos um item do publico');
    return aud;
  }

  private data(input: AnnouncementInput, aud?: Audience): Prisma.AnnouncementUncheckedUpdateInput {
    return {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(aud ? { audience: aud as unknown as Prisma.InputJsonValue } : {}),
      ...(input.adminsOnly !== undefined ? { adminsOnly: input.adminsOnly } : {}),
      ...(input.dismissible !== undefined ? { dismissible: input.dismissible } : {}),
      ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl || null, linkLabel: input.linkUrl ? input.linkLabel || null : null } : {}),
      ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
    };
  }

  async create(staff: PlatformStaffPrincipal, input: AnnouncementInput) {
    const aud = this.validate(input);
    const a = await this.prisma.announcement.create({
      data: { ...(this.data(input, aud) as Prisma.AnnouncementUncheckedCreateInput), title: input.title.trim(), body: input.body.trim(), createdById: staff.id, createdByName: staff.name },
    });
    this.audit.log(staff, { action: 'announcement.created', targetType: 'announcement', targetId: a.id, metadata: { title: a.title } }).catch(() => {});
    return a;
  }

  private async find(id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Comunicado nao encontrado');
    return a;
  }

  async update(staff: PlatformStaffPrincipal, id: string, input: Partial<AnnouncementInput>) {
    const current = await this.find(id);
    const merged: AnnouncementInput = {
      title: input.title ?? current.title, body: input.body ?? current.body,
      startsAt: input.startsAt ?? current.startsAt.toISOString(),
      endsAt: input.endsAt !== undefined ? input.endsAt : current.endsAt?.toISOString() ?? null,
      linkUrl: input.linkUrl, audience: input.audience,
    };
    const aud = this.validate(merged);
    const a = await this.prisma.announcement.update({ where: { id }, data: this.data(input as AnnouncementInput, aud) });
    this.audit.log(staff, { action: 'announcement.updated', targetType: 'announcement', targetId: id }).catch(() => {});
    return a;
  }

  async publish(staff: PlatformStaffPrincipal, id: string, publish: boolean) {
    await this.find(id);
    const a = await this.prisma.announcement.update({ where: { id }, data: { publishedAt: publish ? new Date() : null } });
    this.audit.log(staff, { action: publish ? 'announcement.published' : 'announcement.unpublished', targetType: 'announcement', targetId: id, metadata: { title: a.title } }).catch(() => {});
    return a;
  }

  async remove(staff: PlatformStaffPrincipal, id: string) {
    const a = await this.find(id);
    await this.prisma.announcement.delete({ where: { id } });
    this.audit.log(staff, { action: 'announcement.deleted', targetType: 'announcement', targetId: id, metadata: { title: a.title } }).catch(() => {});
    return { success: true };
  }
}
