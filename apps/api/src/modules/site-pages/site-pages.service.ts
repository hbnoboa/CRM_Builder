import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Entity, Prisma, Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { EntityDataQueryService } from '../../common/services/entity-data-query.service';
import { TenantPlanService } from '../../common/services/tenant-plan.service';
import { DataService } from '../data/data.service';
import { UploadService } from '../upload/upload.service';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import { loadTenantSchema, type SchemaTable } from '../ai-builder/tenant-schema';
import { slugify } from '../ai-builder/ai-proposal-normalizer';
import {
  FORM_FIELD_TYPES, TRACK_FIELD_TYPES, normalizeBlocks, publicField, requiredFields,
  type FormBlock, type NormalizeContext, type RawField, type SiteBlock, type TrackingBlock,
} from './site-blocks';

const RESERVED_SLUGS = new Set(['app']);
const MAX_TEXT = 5000;
const MAX_FILES = 20;

type PageLike = { id?: string; title: string; description: string | null; slug: string; blocks: unknown };
type DisplayValue = string | number | boolean | string[] | null;

/**
 * Paginas para clientes: formulario publico (vira registro) e acompanhamento por
 * link secreto. Nada sai daqui alem dos campos que cada bloco libera.
 */
@Injectable()
export class SitePagesService {
  private readonly logger = new Logger(SitePagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataService: DataService,
    private readonly uploadService: UploadService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly tenantPlan: TenantPlanService,
    private readonly queryService: EntityDataQueryService,
  ) {}

  // ── Estrutura ──────────────────────────────────────────────────────────

  private async rawEntities(tenantId: string) {
    return this.prisma.entity.findMany({ where: { tenantId } });
  }

  private async context(tenantId: string): Promise<NormalizeContext & { entities: Entity[] }> {
    const [tables, entities, pdfTemplates] = await Promise.all([
      loadTenantSchema(this.prisma, tenantId),
      this.rawEntities(tenantId),
      this.prisma.pdfTemplate.findMany({ where: { tenantId, isPublished: true, templateType: 'single' }, select: { id: true, sourceEntityId: true, name: true } }),
    ]);
    const rawFieldsBySlug = new Map(entities.map((e) => [e.slug, (Array.isArray(e.fields) ? e.fields : []) as unknown as RawField[]]));
    return { tables, rawFieldsBySlug, pdfTemplates, entities };
  }

  private async uniqueSlug(tenantId: string, wanted: string, excludeId?: string): Promise<string> {
    const base = slugify(wanted, '-') || 'pagina';
    const taken = new Set((await this.prisma.sitePage.findMany({ where: { tenantId }, select: { id: true, slug: true } }))
      .filter((p) => p.id !== excludeId).map((p) => p.slug));
    let slug = base;
    for (let i = 2; taken.has(slug) || RESERVED_SLUGS.has(slug); i++) slug = `${base}-${i}`;
    return slug;
  }

  /**
   * Endereco da pagina. Com SITE_PAGES_BASE_URL (ex.: https://{empresa}.iossystem.com.br)
   * vira o subdominio da empresa; sem ela, o caminho /p/<empresa>/<pagina> no site.
   */
  private url(tenantSlug: string, pageSlug: string) {
    const base = process.env.SITE_PAGES_BASE_URL;
    if (base && base.includes('{empresa}')) return `${base.replace('{empresa}', tenantSlug).replace(/\/$/, '')}/${pageSlug}`;
    return `/p/${tenantSlug}/${pageSlug}`;
  }

  // ── Administracao ──────────────────────────────────────────────────────

  async list(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    const pages = await this.prisma.sitePage.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
    return pages.map((p) => ({
      id: p.id, title: p.title, slug: p.slug, description: p.description, isPublished: p.isPublished, updatedAt: p.updatedAt,
      url: this.url(tenant!.slug, p.slug),
      kinds: [...new Set((p.blocks as unknown as SiteBlock[]).filter((b) => b.type === 'form' || b.type === 'tracking').map((b) => b.type))],
    }));
  }

  async get(id: string, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const page = await this.prisma.sitePage.findFirst({ where: { id, tenantId } });
    if (!page) throw new NotFoundException('Página não encontrada');
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    return { ...page, url: this.url(tenant!.slug, page.slug) };
  }

  async create(dto: { title: string; template?: 'form' | 'tracking' | 'blank'; entitySlug?: string }, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const ctx = await this.context(tenantId);
    const title = dto.title.trim().slice(0, 120);
    const table = dto.entitySlug ? ctx.tables.find((t) => t.slug === dto.entitySlug) : undefined;
    if (dto.template && dto.template !== 'blank' && !table) throw new BadRequestException('Escolha a tabela da página.');
    const blocks = normalizeBlocks(this.starterBlocks(dto.template ?? 'blank', title, table, ctx), ctx);
    const page = await this.prisma.sitePage.create({
      data: {
        tenantId, title, slug: await this.uniqueSlug(tenantId, title), createdById: user.id,
        blocks: blocks as unknown as Prisma.InputJsonValue,
      },
    });
    return this.get(page.id, user);
  }

  /** Pagina ja montada a partir da tabela: a pessoa so ajusta. */
  private starterBlocks(template: 'form' | 'tracking' | 'blank', title: string, table: SchemaTable | undefined, ctx: NormalizeContext): unknown[] {
    if (template === 'blank' || !table) return [{ type: 'heading', text: title }];
    const raw = ctx.rawFieldsBySlug.get(table.slug) || [];
    if (template === 'form') {
      const required = requiredFields(raw, table.statusField).map((f) => f.slug);
      const extra = table.fields.filter((f) => FORM_FIELD_TYPES.has(f.type) && f.slug !== table.statusField).map((f) => f.slug);
      return [
        { type: 'heading', text: title },
        { type: 'text', text: 'Preencha os dados abaixo. Os campos com * são obrigatórios.' },
        { type: 'form', entitySlug: table.slug, fields: [...new Set([...required, ...extra])].slice(0, Math.max(10, required.length)), submitLabel: 'Enviar' },
      ];
    }
    const simple = table.fields.filter((f) => TRACK_FIELD_TYPES.has(f.type) && !['image', 'file', 'textarea'].includes(f.type));
    const shown = [table.titleField, table.statusField, table.deadlineField, ...simple.map((f) => f.slug)].filter(Boolean) as string[];
    const timeline = table.fields.find((f) => f.type === 'sub-entity');
    const uploads = table.fields.filter((f) => f.type === 'image' || f.type === 'file').slice(0, 4).map((f) => f.slug);
    const pdf = ctx.pdfTemplates.find((p) => p.sourceEntityId === table.id);
    return [
      { type: 'heading', text: title },
      { type: 'text', text: 'Aqui você acompanha a situação e o histórico. Se precisar enviar documentos ou fotos, use os botões abaixo.' },
      {
        type: 'tracking', entitySlug: table.slug, fields: [...new Set(shown)].slice(0, 8),
        ...(timeline ? { timelineField: timeline.slug } : {}), uploadFields: uploads, ...(pdf ? { pdfTemplateId: pdf.id } : {}),
      },
    ];
  }

  async update(id: string, dto: { title?: string; slug?: string; description?: string | null; blocks?: unknown[] }, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const page = await this.prisma.sitePage.findFirst({ where: { id, tenantId } });
    if (!page) throw new NotFoundException('Página não encontrada');
    const data: Prisma.SitePageUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim().slice(0, 120) || page.title;
    if (dto.description !== undefined) data.description = dto.description ? dto.description.trim().slice(0, 300) : null;
    if (dto.slug !== undefined) {
      const wanted = slugify(dto.slug, '-');
      if (!wanted || RESERVED_SLUGS.has(wanted)) throw new BadRequestException('Escolha outro endereço para a página.');
      const clash = await this.prisma.sitePage.findFirst({ where: { tenantId, slug: wanted, id: { not: id } } });
      if (clash) throw new ConflictException('Já existe uma página com esse endereço.');
      data.slug = wanted;
    }
    if (dto.blocks !== undefined) data.blocks = normalizeBlocks(dto.blocks, await this.context(tenantId)) as unknown as Prisma.InputJsonValue;
    await this.prisma.sitePage.update({ where: { id }, data });
    return this.get(id, user);
  }

  async publish(id: string, publish: boolean, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const page = await this.prisma.sitePage.findFirst({ where: { id, tenantId } });
    if (!page) throw new NotFoundException('Página não encontrada');
    if (publish) normalizeBlocks(page.blocks, await this.context(tenantId)); // confere de novo (tabela pode ter mudado)
    await this.prisma.sitePage.update({ where: { id }, data: { isPublished: publish, publishedAt: publish ? new Date() : page.publishedAt } });
    return this.get(id, user);
  }

  async remove(id: string, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const page = await this.prisma.sitePage.findFirst({ where: { id, tenantId } });
    if (!page) throw new NotFoundException('Página não encontrada');
    await this.prisma.sitePage.delete({ where: { id } });
    return { ok: true };
  }

  /** Previa no editor: blocos ainda nao salvos, com registro de exemplo no acompanhamento. */
  async preview(blocks: unknown[], title: string, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const ctx = await this.context(tenantId);
    let normalized: SiteBlock[];
    try {
      normalized = normalizeBlocks(blocks, ctx);
    } catch (err) {
      return { error: (err as Error).message };
    }
    return this.buildPublic(tenant!, { title, description: null, slug: 'previa', blocks: normalized }, ctx, { sample: true });
  }

  /**
   * Link de acompanhamento de um registro. Quem pede precisa enxergar o registro
   * (mesmas regras de cargo da tela de registros).
   */
  async trackingLink(dto: { entitySlug: string; recordId: string }, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const { where, entity } = await this.queryService.buildWhere({ entitySlug: dto.entitySlug, user, includeChildren: true });
    const record = await this.prisma.entityData.findFirst({ where: { ...where, id: dto.recordId }, select: { id: true } });
    if (!record) throw new NotFoundException('Registro não encontrado');
    const page = await this.trackingPageFor(tenantId, dto.entitySlug);
    if (!page) throw new NotFoundException('Nenhuma página de acompanhamento publicada para esta tabela. Crie uma em Páginas para clientes.');
    const token = await this.ensureToken(tenantId, entity.id, record.id, user.id);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    return { url: `${this.url(tenant!.slug, page.slug)}?c=${token}`, pageTitle: page.title };
  }

  /** O botao "Link de acompanhamento" so aparece se houver pagina publicada para a tabela. */
  async hasTrackingPage(entitySlug: string, user: CurrentUser) {
    return { available: !!(await this.trackingPageFor(getEffectiveTenantId(user), entitySlug)) };
  }

  private async trackingPageFor(tenantId: string, entitySlug: string) {
    const pages = await this.prisma.sitePage.findMany({ where: { tenantId, isPublished: true }, orderBy: { publishedAt: 'asc' } });
    return pages.find((p) => (p.blocks as unknown as SiteBlock[]).some((b) => b.type === 'tracking' && b.entitySlug === entitySlug)) ?? null;
  }

  private async ensureToken(tenantId: string, entityId: string, recordId: string, userId?: string | null): Promise<string> {
    const existing = await this.prisma.recordTrackingLink.findUnique({ where: { recordId } });
    if (existing && existing.tenantId === tenantId) return existing.token;
    const token = randomBytes(24).toString('base64url');
    await this.prisma.recordTrackingLink.create({ data: { tenantId, entityId, recordId, token, createdById: userId ?? null } });
    return token;
  }

  // ── Publico ────────────────────────────────────────────────────────────

  private async publicPage(tenantSlug: string, pageSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== Status.ACTIVE) throw new NotFoundException('Página não encontrada');
    if (!(await this.tenantPlan.isFeatureEnabled(tenant.id, 'publicLinks'))) {
      throw new ForbiddenException({ code: 'FEATURE_DISABLED', message: 'Esta página não está disponível no momento' });
    }
    const page = await this.prisma.sitePage.findUnique({ where: { tenantId_slug: { tenantId: tenant.id, slug: pageSlug } } });
    if (!page || !page.isPublished) throw new NotFoundException('Página não encontrada');
    return { tenant, page, blocks: page.blocks as unknown as SiteBlock[] };
  }

  async getPublic(tenantSlug: string, pageSlug: string, token?: string) {
    const { tenant, page } = await this.publicPage(tenantSlug, pageSlug);
    const ctx = await this.context(tenant.id);
    return this.buildPublic(tenant, page, ctx, { token });
  }

  /** Monta o que a pagina mostra: definicoes dos campos e, com token valido, o registro. */
  private async buildPublic(
    tenant: { id: string; name: string; logo: string | null; settings: unknown },
    page: PageLike,
    ctx: NormalizeContext & { entities: Entity[] },
    opts: { token?: string; sample?: boolean },
  ) {
    const theme = ((tenant.settings as { theme?: { brandColor?: string } } | null)?.theme) ?? {};
    const entityBySlug = new Map(ctx.entities.map((e) => [e.slug, e]));
    const fieldsOf = (slug: string) => (ctx.rawFieldsBySlug.get(slug) || []);
    const blocks = (page.blocks as SiteBlock[]).map((b) => {
      if (b.type === 'form') {
        const raw = fieldsOf(b.entitySlug);
        return { ...b, fieldDefs: b.fields.map((s) => raw.find((f) => f.slug === s)).filter(Boolean).map((f) => publicField(f!)) };
      }
      if (b.type === 'tracking') {
        const raw = fieldsOf(b.entitySlug);
        const { pdfTemplateId, ...rest } = b;
        return {
          ...rest, hasPdf: !!pdfTemplateId,
          entityName: entityBySlug.get(b.entitySlug)?.name ?? '',
          uploadDefs: (b.uploadFields || []).map((s) => raw.find((f) => f.slug === s)).filter(Boolean).map((f) => publicField(f!)),
        };
      }
      return b;
    });

    const tracking = (page.blocks as SiteBlock[]).find((b): b is TrackingBlock => b.type === 'tracking');
    let record: unknown = null;
    let trackingError: string | null = null;
    if (tracking && opts.sample) {
      record = await this.sampleRecord(tracking, ctx);
    } else if (tracking && opts.token) {
      record = await this.trackedRecord(tenant.id, tracking, opts.token, ctx);
      if (!record) trackingError = 'Este link de acompanhamento não é válido. Confira se copiou o link inteiro ou peça um novo.';
    }
    return {
      tenant: { name: tenant.name, logo: tenant.logo, brandColor: theme.brandColor ?? null },
      page: { title: page.title, description: page.description, slug: page.slug },
      blocks,
      record,
      trackingError,
    };
  }

  private display(field: RawField | undefined, value: unknown): DisplayValue {
    if (value === undefined || value === null || value === '') return null;
    if (!field) return String(value);
    const options = (field.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    const label = (v: unknown) => options.find((o) => o.value === v)?.label ?? String(v);
    switch (field.type) {
      case 'select':
      case 'radio-group':
        return label(value);
      case 'multiselect':
      case 'checkbox-group':
      case 'tags':
        return (Array.isArray(value) ? value : [value]).map(label);
      case 'relation': {
        const v = value as { label?: string; name?: string; title?: string };
        return typeof value === 'object' ? (v.label ?? v.name ?? v.title ?? null) : String(value);
      }
      case 'boolean':
        return value === true || value === 'true';
      case 'image':
      case 'file':
        return (Array.isArray(value) ? value : [value]).filter((u): u is string => typeof u === 'string');
      case 'number':
      case 'currency':
      case 'percentage':
      case 'rating':
        return Number(value);
      default:
        return typeof value === 'object' ? JSON.stringify(value) : (value as string);
    }
  }

  /**
   * Registro do link de acompanhamento. Sem usuario logado: o token e a autorizacao,
   * por isso a busca e direta (tenant + tabela + id do link) e so saem os campos do bloco.
   */
  private async trackedRecord(tenantId: string, block: TrackingBlock, token: string, ctx: NormalizeContext & { entities: Entity[] }) {
    const link = await this.prisma.recordTrackingLink.findUnique({ where: { token } });
    const entity = ctx.entities.find((e) => e.slug === block.entitySlug);
    if (!link || !entity || link.tenantId !== tenantId || link.entityId !== entity.id) return null;
    const record = await this.prisma.entityData.findFirst({ where: { id: link.recordId, tenantId, entityId: entity.id, deletedAt: null } });
    if (!record) return null;
    this.prisma.recordTrackingLink.update({ where: { id: link.id }, data: { lastAccessAt: new Date() } }).catch(() => undefined);
    return this.recordPayload(block, entity, record.data as Record<string, unknown>, record.updatedAt, ctx, record.id);
  }

  private async recordPayload(
    block: TrackingBlock, entity: Entity, data: Record<string, unknown>, updatedAt: Date,
    ctx: NormalizeContext & { entities: Entity[] }, recordId: string | null,
  ) {
    const raw = ctx.rawFieldsBySlug.get(entity.slug) || [];
    const byslug = new Map(raw.map((f) => [f.slug, f]));
    const settings = (entity.settings || {}) as { titleField?: string; statusField?: string };
    const statusField = settings.statusField ? byslug.get(settings.statusField) : undefined;
    const statusOpt = statusField
      ? (statusField.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)).find((o) => o.value === data[statusField.slug])
      : undefined;

    let timeline: unknown = null;
    if (block.timelineField) {
      const sub = byslug.get(block.timelineField) as (RawField & { subEntitySlug?: string; subEntityId?: string; subEntityDisplayFields?: string[] }) | undefined;
      const child = ctx.entities.find((e) => e.slug === sub?.subEntitySlug || e.id === sub?.subEntityId);
      if (sub && child) {
        const childRaw = ctx.rawFieldsBySlug.get(child.slug) || [];
        const wanted = (sub.subEntityDisplayFields || []).map((s) => childRaw.find((f) => f.slug === s)).filter(Boolean) as RawField[];
        const columns = (wanted.length ? wanted : childRaw).filter((f) => TRACK_FIELD_TYPES.has(f.type) && f.type !== 'image' && f.type !== 'file').slice(0, 4);
        const rows = recordId
          ? await this.prisma.entityData.findMany({
            where: { tenantId: entity.tenantId, entityId: child.id, parentRecordId: recordId, deletedAt: null },
            orderBy: { createdAt: 'desc' }, take: 50,
          })
          : [];
        timeline = {
          label: sub.label || sub.name || sub.slug,
          columns: columns.map((c) => ({ slug: c.slug, label: c.label || c.name || c.slug, type: c.type })),
          rows: recordId
            ? rows.map((r) => Object.fromEntries(columns.map((c) => [c.slug, this.display(c, (r.data as Record<string, unknown>)[c.slug])])))
            : [Object.fromEntries(columns.map((c) => [c.slug, `${c.label || c.slug} de exemplo`]))],
        };
      }
    }

    return {
      title: settings.titleField ? this.display(byslug.get(settings.titleField), data[settings.titleField]) : null,
      status: statusOpt ? { label: statusOpt.label, color: (statusOpt as { color?: string }).color ?? null } : null,
      updatedAt,
      fields: block.fields
        .filter((s) => s !== settings.statusField && s !== settings.titleField)
        .map((s) => byslug.get(s))
        .filter(Boolean)
        .map((f) => ({ slug: f!.slug, label: f!.label || f!.name || f!.slug, type: f!.type, value: this.display(f, data[f!.slug]) })),
      uploads: (block.uploadFields || []).map((s) => byslug.get(s)).filter(Boolean)
        .map((f) => ({ slug: f!.slug, label: f!.label || f!.name || f!.slug, type: f!.type, multiple: !!f!.multiple, value: this.display(f, data[f!.slug]) ?? [] })),
      timeline,
    };
  }

  private async sampleRecord(block: TrackingBlock, ctx: NormalizeContext & { entities: Entity[] }) {
    const entity = ctx.entities.find((e) => e.slug === block.entitySlug);
    if (!entity) return null;
    const raw = ctx.rawFieldsBySlug.get(entity.slug) || [];
    const data: Record<string, unknown> = {};
    for (const f of raw) {
      const opts = (f.options || []).map((o) => (typeof o === 'string' ? o : o.value));
      data[f.slug] = opts.length ? (['multiselect', 'checkbox-group'].includes(f.type) ? [opts[0]] : opts[Math.min(1, opts.length - 1)])
        : ['number', 'currency', 'percentage', 'rating'].includes(f.type) ? 3
          : ['date', 'datetime'].includes(f.type) ? new Date().toISOString()
            : f.type === 'boolean' ? true
              : ['image', 'file'].includes(f.type) ? null
                : `${f.label || f.slug} de exemplo`;
    }
    return this.recordPayload(block, entity, data, new Date(), ctx, null);
  }

  // ── Envio de formulario ────────────────────────────────────────────────

  private isOwnUpload(url: string, tenantId: string) {
    return typeof url === 'string' && url.includes(`/${tenantId}/site/`) && /^(https?:\/\/|\/)/.test(url);
  }

  /** So os campos do bloco, convertidos e conferidos pelo tipo. */
  private sanitize(raw: RawField[], allowed: string[], input: Record<string, unknown>, tenantId: string) {
    const out: Record<string, unknown> = {};
    for (const slug of allowed) {
      const f = raw.find((x) => x.slug === slug);
      const v = input?.[slug];
      if (!f || v === undefined || v === null || v === '') continue;
      const values = (f.options || []).map((o) => (typeof o === 'string' ? o : o.value));
      switch (f.type) {
        case 'number': case 'currency': case 'percentage': case 'rating': {
          const n = Number(v);
          if (Number.isFinite(n)) out[slug] = n;
          break;
        }
        case 'date': case 'datetime':
          if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) out[slug] = v.slice(0, 40);
          break;
        case 'boolean':
          out[slug] = v === true || v === 'true';
          break;
        case 'select': case 'radio-group':
          if (values.includes(String(v))) out[slug] = String(v);
          break;
        case 'multiselect': case 'checkbox-group': {
          const picked = (Array.isArray(v) ? v : [v]).map(String).filter((x) => values.includes(x));
          if (picked.length) out[slug] = [...new Set(picked)];
          break;
        }
        case 'tags': {
          const tags = (Array.isArray(v) ? v : [v]).map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 20);
          if (tags.length) out[slug] = tags;
          break;
        }
        case 'image': case 'file': {
          const urls = (Array.isArray(v) ? v : [v]).map(String).filter((u) => this.isOwnUpload(u, tenantId)).slice(0, MAX_FILES);
          if (urls.length) out[slug] = f.multiple ? urls : urls[0];
          break;
        }
        default:
          if (typeof v === 'string' || typeof v === 'number') out[slug] = String(v).trim().slice(0, MAX_TEXT);
      }
    }
    return out;
  }

  async submitForm(tenantSlug: string, pageSlug: string, blockId: string, body: { data?: Record<string, unknown>; website?: string }) {
    const { tenant, page, blocks } = await this.publicPage(tenantSlug, pageSlug);
    const block = blocks.find((b): b is FormBlock => b.type === 'form' && b.id === blockId);
    if (!block) throw new NotFoundException('Formulário não encontrado');
    // Robo preencheu o campo escondido: finge que deu certo e nao grava
    if (body.website) return { ok: true, message: block.successMessage };

    const entity = await this.prisma.entity.findFirst({ where: { tenantId: tenant.id, slug: block.entitySlug } });
    if (!entity) throw new NotFoundException('Formulário não encontrado');
    const raw = (Array.isArray(entity.fields) ? entity.fields : []) as unknown as RawField[];
    const data = this.sanitize(raw, block.fields, body.data || {}, tenant.id);

    // Situacao fora do formulario comeca na primeira opcao
    const statusSlug = (entity.settings as { statusField?: string } | null)?.statusField;
    const status = statusSlug ? raw.find((f) => f.slug === statusSlug) : undefined;
    if (status && !block.fields.includes(status.slug) && status.options?.length) {
      const first = status.options[0];
      data[status.slug] = typeof first === 'string' ? first : first.value;
    }

    const record = await this.dataService.createFromSite(entity, data, `Página "${page.title}"`);
    let trackingUrl: string | undefined;
    if (block.showTrackingLink !== false) {
      const trackingPage = await this.trackingPageFor(tenant.id, entity.slug);
      if (trackingPage) {
        const token = await this.ensureToken(tenant.id, entity.id, record.id, null);
        trackingUrl = `${this.url(tenant.slug, trackingPage.slug)}?c=${token}`;
      }
    }
    return { ok: true, message: block.successMessage, ...(trackingUrl ? { trackingUrl } : {}) };
  }

  /** Arquivo enviado no formulario (antes de enviar): so para campos de foto/arquivo do bloco. */
  async uploadForForm(tenantSlug: string, pageSlug: string, blockId: string, fieldSlug: string, file: Express.Multer.File) {
    const { tenant, blocks } = await this.publicPage(tenantSlug, pageSlug);
    const block = blocks.find((b): b is FormBlock => b.type === 'form' && b.id === blockId);
    if (!block || !block.fields.includes(fieldSlug)) throw new NotFoundException('Campo não encontrado');
    const entity = await this.prisma.entity.findFirst({ where: { tenantId: tenant.id, slug: block.entitySlug } });
    const field = ((entity?.fields || []) as unknown as RawField[]).find((f) => f.slug === fieldSlug);
    if (!field || !['image', 'file'].includes(field.type)) throw new BadRequestException('Este campo não recebe arquivos');
    const saved = await this.uploadService.uploadFile(file, tenant.id, 'site');
    return { url: saved.publicUrl || saved.url, name: saved.originalName };
  }

  private async trackingTarget(tenantSlug: string, pageSlug: string, token: string) {
    const { tenant, page, blocks } = await this.publicPage(tenantSlug, pageSlug);
    const block = blocks.find((b): b is TrackingBlock => b.type === 'tracking');
    const link = await this.prisma.recordTrackingLink.findUnique({ where: { token } });
    const entity = block ? await this.prisma.entity.findFirst({ where: { tenantId: tenant.id, slug: block.entitySlug } }) : null;
    if (!block || !link || !entity || link.tenantId !== tenant.id || link.entityId !== entity.id) {
      throw new NotFoundException('Link de acompanhamento inválido');
    }
    return { tenant, page, block, link, entity };
  }

  /** Cliente envia documento/foto pelo link de acompanhamento. */
  async uploadForTracking(tenantSlug: string, pageSlug: string, token: string, fieldSlug: string, file: Express.Multer.File) {
    const { tenant, block, link, entity } = await this.trackingTarget(tenantSlug, pageSlug, token);
    if (!(block.uploadFields || []).includes(fieldSlug)) throw new BadRequestException('Este campo não recebe arquivos');
    const field = ((entity.fields || []) as unknown as RawField[]).find((f) => f.slug === fieldSlug);
    if (!field) throw new BadRequestException('Este campo não recebe arquivos');
    const record = await this.prisma.entityData.findFirst({ where: { id: link.recordId, tenantId: tenant.id, entityId: entity.id, deletedAt: null } });
    if (!record) throw new NotFoundException('Link de acompanhamento inválido');
    const current = (record.data as Record<string, unknown>)[fieldSlug];
    const list = (Array.isArray(current) ? current : current ? [current] : []).filter((u): u is string => typeof u === 'string');
    if (field.multiple && list.length >= MAX_FILES) throw new BadRequestException('Limite de arquivos atingido para este campo');
    const saved = await this.uploadService.uploadFile(file, tenant.id, 'site');
    const url = saved.publicUrl || saved.url;
    await this.dataService.updateFromSite(entity, record.id, { [fieldSlug]: field.multiple ? [...list, url] : url }, 'Cliente (link de acompanhamento)');
    this.logger.log(`arquivo pelo link de acompanhamento tenant=${tenant.id} registro=${record.id} campo=${fieldSlug}`);
    return { ok: true };
  }

  async trackingPdf(tenantSlug: string, pageSlug: string, token: string) {
    const { tenant, block, link } = await this.trackingTarget(tenantSlug, pageSlug, token);
    if (!block.pdfTemplateId) throw new NotFoundException('Documento não disponível');
    return this.pdfGenerator.generateForTracking(block.pdfTemplateId, link.recordId, tenant.id);
  }
}
