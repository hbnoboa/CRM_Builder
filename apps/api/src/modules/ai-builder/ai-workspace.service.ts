import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { hasFullTenantAccess } from '../../common/utils/platform-access';
import { EntityDataQueryService } from '../../common/services/entity-data-query.service';
import { EntityService, type FieldDefinition } from '../entity/entity.service';
import { DashboardTemplateService } from '../dashboard-template/dashboard-template.service';
import { PdfTemplateService } from '../pdf/pdf-template.service';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import type { PdfTemplateContent } from '../pdf/interfaces/pdf-element.interface';
import { AuditService } from '../audit/audit.service';
import { AiBuilderService } from './ai-builder.service';
import { AiProposeDto } from './ai-builder.dto';
import { AiWorkspaceApplyDto, AiWorkspacePdfPreviewDto } from './ai-workspace.dto';
import { creationOrder, slugify, uniqueKey } from './ai-proposal-normalizer';
import { normalizeDashboard, type KeptWidget } from './dashboard-proposal';
import { normalizePdf } from './pdf-proposal';
import { describeSchema, loadTenantSchema, type SchemaTable } from './tenant-schema';
import { roleToDraft, type BaseRole } from './workspace-roles';
import { automationToDraft, type BaseAutomation } from './workspace-automations';
import { EntityAutomationService } from '../entity-automation/entity-automation.service';
import type { CreateAutomationDto } from '../entity-automation/dto/create-automation.dto';
import { CustomRoleService } from '../custom-role/custom-role.service';
import type { CreateCustomRoleDto } from '../custom-role/dto/custom-role.dto';
import { AI_WORKSPACE_JSON_SCHEMA, AI_WORKSPACE_SYSTEM_PROMPT } from './workspace-prompt';
import {
  dashboardToDraft, entityToDraft, normalizeWorkspace, pdfToDraft,
  type BaseDashboard, type BaseEntity, type ChangeKind, type ChangeModule, type NormalizedWorkspace, type RawField,
  type WorkspaceBase, type WsChange, type WsDashboard, type WsPdf,
} from './workspace-draft';

const MAX_DRAFT_BYTES = 200_000;
/** Painel automatico de cada tabela (mantido pelo sistema; fica fora do construtor). */
const TABLE_WIDGET_ID = 'w-data-table-1';
/** Paineis inteiros no pedido da IA ate este tamanho; depois, so a lista de nomes. */
const MAX_DASHBOARD_CONTEXT = 30_000;

const PERMISSION: Record<ChangeModule, { module: string; sub?: string; label: string }> = {
  table: { module: 'entities', label: 'tabelas' },
  dashboard: { module: 'dashboard', label: 'painéis' },
  pdf: { module: 'templates', sub: 'pdfTemplates', label: 'modelos de PDF' },
  role: { module: 'roles', label: 'cargos' },
  automation: { module: 'automations', sub: 'entityAutomation', label: 'automações' },
};
const ACTION: Record<ChangeKind, { perm: string; verb: string }> = {
  create: { perm: 'canCreate', verb: 'criar' },
  update: { perm: 'canUpdate', verb: 'alterar' },
  delete: { perm: 'canDelete', verb: 'excluir' },
};

export interface AppliedItem {
  module: ChangeModule;
  kind: ChangeKind;
  key: string;
  id: string;
  name: string;
}

/** Mesma regra do ModulePermissionGuard, sem lancar erro. */
function allowed(user: CurrentUser, module: string, action: string, sub?: string): boolean {
  if (hasFullTenantAccess(user.customRole?.modulePermissions)) return true;
  const perm = (user.customRole?.modulePermissions as Record<string, Record<string, unknown>> | undefined)?.[module];
  if (!perm || perm[action] !== true) return false;
  if (!sub) return true;
  const subPerm = perm[sub] as Record<string, boolean> | undefined;
  return subPerm === undefined || subPerm[action] === true;
}

/**
 * Construtor da tela inicial: tabelas, paineis e PDFs juntos, novos ou que ja existem,
 * pela conversa com a IA ou mexendo a mao. Nada muda antes de "Aplicar"; cada
 * aplicacao fica registrada (quem pediu, o que pediu e o que mudou).
 */
@Injectable()
export class AiWorkspaceService {
  private readonly logger = new Logger(AiWorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiBuilderService,
    private readonly entityService: EntityService,
    private readonly dashboardService: DashboardTemplateService,
    private readonly pdfTemplateService: PdfTemplateService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly auditService: AuditService,
    private readonly queryService: EntityDataQueryService,
    private readonly customRoleService: CustomRoleService,
    private readonly automationService: EntityAutomationService,
  ) {}

  private async loadBase(user: CurrentUser): Promise<{ base: WorkspaceBase; kept: Map<string, Map<string, KeptWidget>>; dashboards: BaseDashboard[] }> {
    const tenantId = getEffectiveTenantId(user);
    const [schema, entities, dashboards, deletedDashboards, pdfs, roleRows, automationRows, members] = await Promise.all([
      loadTenantSchema(this.prisma, tenantId),
      this.prisma.entity.findMany({
        where: { tenantId },
        select: { id: true, slug: true, name: true, namePlural: true, description: true, icon: true, color: true, fields: true, settings: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      this.prisma.dashboardTemplate.findMany({
        where: { tenantId },
        select: { id: true, name: true, description: true, entitySlug: true, layout: true, widgets: true, tabs: true, roleIds: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dashboardTemplate.findMany({ where: { tenantId, deletedAt: { not: null } }, select: { name: true } }),
      this.prisma.pdfTemplate.findMany({
        where: { tenantId },
        select: { id: true, name: true, description: true, sourceEntityId: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      this.prisma.customRole.findMany({
        where: { tenantId },
        select: {
          id: true, name: true, description: true, color: true, isSystem: true, isDefault: true, rank: true, modulePermissions: true, permissions: true,
          _count: { select: { tenantAccessUsers: { where: { deletedAt: null, user: { deletedAt: null } } } } },
        },
        orderBy: { rank: 'asc' },
      }),
      this.prisma.entityAutomation.findMany({
        where: { tenantId },
        select: { id: true, name: true, description: true, entityId: true, isActive: true, trigger: true, triggerConfig: true, conditions: true, actions: true },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
      this.prisma.userTenantAccess.findMany({
        where: { tenantId, deletedAt: null, user: { deletedAt: null } },
        select: { user: { select: { id: true, name: true } } },
        take: 500,
      }),
    ]);
    const roles = roleRows.map((r) => ({ id: r.id, name: r.name }));
    const roleList: BaseRole[] = roleRows.map((r) => ({
      id: r.id, name: r.name, description: r.description || '', color: r.color, isSystem: r.isSystem, isDefault: r.isDefault, rank: r.rank,
      modulePermissions: (r.modulePermissions && typeof r.modulePermissions === 'object' ? r.modulePermissions : {}) as Record<string, unknown>,
      permissions: (Array.isArray(r.permissions) ? r.permissions : []) as Array<Record<string, unknown>>,
      people: r._count.tenantAccessUsers,
    }));
    const parentOf = new Map(schema.map((t) => [t.slug, t.parentSlug]));
    const slugById = new Map(entities.map((e) => [e.id, e.slug]));
    const baseEntities: BaseEntity[] = entities.map((e) => ({
      id: e.id, slug: e.slug, name: e.name, namePlural: e.namePlural || e.name, description: e.description || '',
      icon: e.icon, color: e.color,
      fields: ((Array.isArray(e.fields) ? e.fields : []) as unknown as RawField[])
        .filter((f) => f && typeof f === 'object' && (f.slug || f.name) && f.type)
        .map((f) => ({ ...f, slug: String(f.slug || f.name) })),
      settings: (e.settings && typeof e.settings === 'object' ? e.settings : {}) as Record<string, unknown>,
      ...(parentOf.get(e.slug) ? { parentSlug: parentOf.get(e.slug) } : {}),
    }));
    const editable: BaseDashboard[] = [];
    const automatic: string[] = [];
    for (const d of dashboards) {
      const widgets = (d.widgets && typeof d.widgets === 'object' ? d.widgets : {}) as BaseDashboard['widgets'];
      if (widgets[TABLE_WIDGET_ID]) { automatic.push(d.name); continue; }
      editable.push({
        id: d.id, name: d.name, description: d.description || '', entitySlug: d.entitySlug,
        layout: (Array.isArray(d.layout) ? d.layout : []) as BaseDashboard['layout'],
        widgets,
        tabs: (Array.isArray(d.tabs) ? d.tabs : []) as BaseDashboard['tabs'],
        roleIds: d.roleIds,
      });
    }
    const base: WorkspaceBase = {
      entities: baseEntities,
      schema,
      dashboards: editable,
      pdfs: pdfs.map((p) => ({ id: p.id, name: p.name, description: p.description || '', tableSlug: p.sourceEntityId ? slugById.get(p.sourceEntityId) ?? null : null })),
      roles,
      takenDashboardNames: [...automatic, ...deletedDashboards.map((d) => d.name)],
      roleList,
      actorRank: user.customRole?.rank ?? 999999,
      actorAll: hasFullTenantAccess(user.customRole?.modulePermissions),
      automations: automationRows
        .filter((a) => slugById.has(a.entityId))
        .map((a): BaseAutomation => ({
          id: a.id, name: a.name, description: a.description || '', entityId: a.entityId, tableSlug: slugById.get(a.entityId)!,
          isActive: a.isActive, trigger: a.trigger,
          triggerConfig: (a.triggerConfig && typeof a.triggerConfig === 'object' ? a.triggerConfig : null) as Record<string, unknown> | null,
          conditions: (Array.isArray(a.conditions) ? a.conditions : []) as Array<Record<string, unknown>>,
          actions: (Array.isArray(a.actions) ? a.actions : []) as Array<Record<string, unknown>>,
        })),
      people: members.map((m) => ({ id: m.user.id, name: m.user.name })),
    };
    const kept = new Map(editable.map((d) => [d.id, dashboardToDraft(d, roles, schema).kept]));
    return { base, kept, dashboards: editable };
  }

  private parseDraft(raw: Record<string, unknown> | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    if (JSON.stringify(raw).length > MAX_DRAFT_BYTES) throw new BadRequestException('O rascunho ficou grande demais. Aplique uma parte antes de continuar.');
    return raw;
  }

  /** Tudo o que existe, no formato do rascunho (o ponto de partida da tela). */
  async state(user: CurrentUser) {
    const { base } = await this.loadBase(user);
    return {
      enabled: this.ai.status().enabled,
      tables: base.entities.map(entityToDraft),
      previews: base.entities.map((e) => ({
        key: e.slug, name: e.name, namePlural: e.namePlural, description: e.description, icon: e.icon ?? 'Database', color: e.color ?? '#2563eb',
        parentKey: e.parentSlug ?? null, fields: e.fields, settings: e.settings,
      })),
      dashboards: base.dashboards.map((d) => ({
        draft: dashboardToDraft(d, base.roles, base.schema).draft,
        payload: { name: d.name, description: d.description, entitySlug: d.entitySlug ?? '', layout: d.layout, widgets: d.widgets, tabs: d.tabs, roleIds: d.roleIds },
      })),
      pdfs: base.pdfs.map(pdfToDraft),
      roles: base.roleList.map((r) => roleToDraft(r, base.actorRank)),
      automations: base.automations.map(automationToDraft),
      // So para a tela escolher quem recebe o aviso (a IA nao recebe nomes de pessoas)
      people: base.people,
    };
  }

  /** O que a tela recebe (o plano interno fica no servidor). */
  private async present(n: NormalizedWorkspace, user: CurrentUser) {
    const changes = await this.withRecordCounts(n.changes, n, user);
    return { reply: n.reply, warnings: n.warnings, proposal: n.draft, changes, marks: n.marks, preview: n.preview };
  }

  /** Quantos registros vao para a lixeira junto com cada tabela excluida. */
  private async withRecordCounts(changes: WsChange[], n: NormalizedWorkspace, user: CurrentUser): Promise<WsChange[]> {
    return Promise.all(changes.map(async (c) => {
      if (c.module !== 'table' || c.kind !== 'delete') return c;
      const plan = n.plan.tables.find((p) => p.key === c.key);
      if (!plan?.entity) return c;
      try {
        const { where } = await this.queryService.buildWhere({ entitySlug: plan.entity.slug, user });
        const count = await this.prisma.entityData.count({ where });
        return { ...c, details: [`${count} ${count === 1 ? 'registro vai' : 'registros vão'} para a lixeira (dá para restaurar)`, ...c.details.slice(1)] };
      } catch {
        return c;
      }
    }));
  }

  async propose(dto: AiProposeDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const { base, kept } = await this.loadBase(user);
    const raw = this.parseDraft(dto.currentProposal);
    const current = raw ? normalizeWorkspace(raw, base, kept).draft : null;
    const dashboards = base.dashboards.map((d) => dashboardToDraft(d, base.roles, base.schema).draft);
    const full = JSON.stringify(dashboards);
    const context = [
      'TABELAS QUE JÁ EXISTEM (identificadores entre colchetes; campos: identificador (tipo) "rótulo"):',
      describeSchema(base.schema, true),
      '',
      'NOME DE UM REGISTRO E DESCRIÇÃO DE CADA TABELA:',
      ...base.entities.slice(0, 60).map((e) => `- [${e.slug}] "${e.name}"${e.description ? `: ${e.description.slice(0, 120)}` : ''}`),
      '',
      'PAINÉIS QUE JÁ EXISTEM (no formato do rascunho; para mudar um, copie para "dashboards" com existing=true, o mesmo key e os blocos com o mesmo ref):',
      dashboards.length === 0 ? '(nenhum)'
        : full.length <= MAX_DASHBOARD_CONTEXT ? full
        : dashboards.map((d) => `- [${d.key}] ${d.name} (tabela [${d.mainTable}])`).join('\n') + '\n(blocos omitidos: peça para a pessoa abrir o painel no construtor antes de mudar blocos)',
      '',
      'PDFS QUE JÁ EXISTEM:',
      base.pdfs.length ? base.pdfs.map((p) => `- [${p.id}] ${p.name}${p.tableSlug ? ` (tabela [${p.tableSlug}])` : ''}`).join('\n') : '(nenhum)',
      '',
      'CARGOS QUE JÁ EXISTEM (no formato do rascunho; "locked": true = do nível de quem pede ou acima, não dá para mudar; "people" = quantas pessoas têm):',
      JSON.stringify(base.roleList.map((r) => roleToDraft(r, base.actorRank))),
      '',
      'AUTOMAÇÕES QUE JÁ EXISTEM (no formato do rascunho; "person" é o código de alguém da equipe):',
      base.automations.length ? JSON.stringify(base.automations.map(automationToDraft)) : '(nenhuma)',
    ];
    const output = await this.ai.ask('workspace', tenantId, AI_WORKSPACE_SYSTEM_PROMPT, AI_WORKSPACE_JSON_SCHEMA, context, dto, current, base.schema);
    // O rascunho guarda o que ja estava nele: o que a IA esqueceu de repetir continua
    const merged = mergeForgotten(output, current);
    return this.present(normalizeWorkspace(merged, base, kept), user);
  }

  /** Rascunho mexido a mao: confere e desenha de novo (sem IA, sem custo). */
  async preview(proposal: Record<string, unknown>, user: CurrentUser) {
    const { base, kept } = await this.loadBase(user);
    return this.present(normalizeWorkspace(this.parseDraft(proposal), base, kept), user);
  }

  /** PDF de um rascunho com dados de exemplo (so com a tabela ja criada). */
  async previewPdf(dto: AiWorkspacePdfPreviewDto, user: CurrentUser): Promise<Buffer> {
    const { base, kept } = await this.loadBase(user);
    const n = normalizeWorkspace(this.parseDraft(dto.proposal), base, kept);
    const plan = n.plan.pdfs.find((p) => p.key === dto.key);
    const table = base.schema.find((t) => t.slug === plan?.table);
    if (!plan || !table) throw new BadRequestException('A prévia aparece depois que a tabela do PDF for criada.');
    if (!plan.content) {
      if (!plan.base) throw new BadRequestException('Este PDF não tem prévia.');
      return this.pdfGenerator.preview(plan.base.id, user, {});
    }
    return this.pdfGenerator.previewDraft(table.id, plan.content as unknown as PdfTemplateContent, user);
  }

  /** Historico do construtor: quem aplicou, o que pediu e o que mudou. */
  async history(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId, resource: 'ai_builder', action: 'ai_apply' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, userId: true, createdAt: true, metadata: true, impersonatedByName: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))] } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    return logs.map((l) => {
      const m = (l.metadata || {}) as { request?: string[]; changes?: WsChange[]; applied?: AppliedItem[]; failed?: { name: string; message: string } | null; viaAi?: boolean };
      return {
        id: l.id, at: l.createdAt, by: l.userId ? nameOf.get(l.userId) ?? 'Usuário removido' : 'Sistema',
        impersonatedBy: l.impersonatedByName, request: m.request ?? [], viaAi: m.viaAi ?? false,
        changes: m.changes ?? [], applied: m.applied ?? [], failed: m.failed ?? null,
      };
    });
  }

  /**
   * Aplica o rascunho (conferido de novo aqui; nada do navegador e confiado), na
   * ordem: tabelas novas, tabelas alteradas, paineis, PDFs e, por ultimo, exclusoes.
   * Para no primeiro erro e conta o que ja foi feito.
   */
  async apply(dto: AiWorkspaceApplyDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const { base, kept } = await this.loadBase(user);
    const n = normalizeWorkspace(this.parseDraft(dto.proposal), base, kept);
    if (n.changes.length === 0) throw new BadRequestException('Não há mudanças para aplicar.');

    const missing = new Set<string>();
    for (const c of n.changes) {
      const p = PERMISSION[c.module];
      if (!allowed(user, p.module, ACTION[c.kind].perm, p.sub)) missing.add(`${ACTION[c.kind].verb} ${p.label}`);
      // Tirar campo esconde dados: precisa da mesma permissao de excluir
      if (c.removals?.length && !allowed(user, p.module, 'canDelete', p.sub)) missing.add(`excluir campos de ${p.label}`);
    }
    if (missing.size) throw new ForbiddenException(`Seu cargo não permite ${[...missing].join(', ')}. Peça para um administrador aplicar.`);
    if (n.changes.some((c) => c.kind === 'delete' || c.removals?.length) && dto.confirmRemovals !== true) {
      throw new BadRequestException('Confirme as exclusões antes de aplicar.');
    }

    const applied: AppliedItem[] = [];
    const snapshots: Record<string, unknown> = {};
    let failed: { name: string; message: string } | null = null;
    const created = new Map<string, { id: string; slug: string; name: string; titleField?: string }>();
    const step = async (module: ChangeModule, kind: ChangeKind, key: string, name: string, run: () => Promise<string>) => {
      if (failed) return;
      try {
        const id = await run();
        applied.push({ module, kind, key, id, name });
      } catch (err) {
        const message = (err as { response?: { message?: string | string[] } })?.response?.message ?? (err as Error).message;
        failed = { name, message: Array.isArray(message) ? message.join(', ') : String(message) };
        this.logger.error(`construtor: falhou ${module} ${kind} tenant=${tenantId}: ${failed.message}`);
      }
    };

    // 1. Tabelas novas (a de dentro antes da de cima; a ligada antes de quem liga)
    const newPlans = n.plan.tables.filter((p) => p.kind === 'create' && p.created);
    const order = creationOrder(newPlans.map((p) => p.created!), n.warnings);
    const [active, deleted] = await Promise.all([
      this.prisma.entity.findMany({ where: { tenantId }, select: { slug: true } }),
      this.prisma.entity.findMany({ where: { tenantId, deletedAt: { not: null } }, select: { slug: true } }),
    ]);
    const taken = new Set([...active, ...deleted].map((e) => e.slug));
    for (const t of order) {
      await step('table', 'create', t.key, t.namePlural, async () => {
        let slug = slugify(t.key, '-') || 'tabela';
        for (let i = 2; taken.has(slug); i++) slug = `${slugify(t.key, '-')}-${i}`;
        taken.add(slug);
        const fields = t.fields.map((f) => {
          const ref = t.refs.find((r) => r.fieldSlug === f.slug);
          const target = ref ? created.get(ref.targetKey) : undefined;
          if (!ref || !target) return f;
          return ref.kind === 'relation'
            ? { ...f, relatedEntitySlug: target.slug, relatedEntityId: target.id }
            : { ...f, subEntitySlug: target.slug, subEntityId: target.id };
        });
        const entity = await this.entityService.create({
          name: t.name, namePlural: t.namePlural, slug, description: t.description, icon: t.icon, color: t.color,
          ...(n.plan.group ? { category: n.plan.group } : {}),
          fields: fields as unknown as FieldDefinition[],
          settings: t.settings,
        }, user);
        created.set(t.key, { id: entity.id, slug: entity.slug, name: entity.name, titleField: t.settings.titleField as string | undefined });
        return entity.id;
      });
    }

    // 2. Tabelas que ja existem
    for (const p of n.plan.tables.filter((x) => x.kind === 'update')) {
      const u = p.update!;
      const e = p.entity!;
      await step('table', 'update', p.key, p.name, async () => {
        const fields: RawField[] = u.fields.map((f) => {
          const ref = u.refs.find((r) => r.fieldSlug === f.slug);
          const target = ref ? created.get(ref.targetKey) : undefined;
          if (!ref) return f;
          if (!target) return { ...f, type: 'text', relatedEntitySlug: undefined };
          return { ...f, relatedEntitySlug: target.slug, relatedEntityId: target.id, ...(target.titleField ? { relatedDisplayField: target.titleField } : {}) };
        });
        // Listas novas dentro desta tabela
        const takenSlugs = new Set(fields.map((f) => f.slug));
        let row = Math.max(0, ...fields.map((f) => Number(f.gridRow) || 0));
        for (const childKey of u.children) {
          const child = created.get(childKey);
          const plan = newPlans.find((x) => x.key === childKey)?.created;
          if (!child || !plan) continue;
          const slug = uniqueKey(slugify(child.slug, '_') || 'itens', takenSlugs, '_');
          fields.push({
            slug, name: slug, label: plan.namePlural, type: 'sub-entity', required: false,
            gridRow: ++row, gridColStart: 1, gridColSpan: 12,
            subEntitySlug: child.slug, subEntityId: child.id,
            subEntityDisplayFields: plan.fields.filter((f) => f.type !== 'section-title' && f.type !== 'sub-entity').slice(0, 4).map((f) => f.slug),
            ...(u.settings.titleField ? { parentDisplayField: u.settings.titleField } : {}),
          });
        }
        snapshots[`table:${e.slug}`] = { name: e.name, namePlural: e.namePlural, description: e.description, icon: e.icon, color: e.color, fields: e.fields, settings: e.settings };
        await this.entityService.update(e.id, {
          name: u.name, namePlural: u.namePlural, description: u.description,
          ...(u.icon ? { icon: u.icon } : {}), ...(u.color ? { color: u.color } : {}),
          fields: fields as unknown as FieldDefinition[], settings: u.settings,
        }, user);
        return e.id;
      });
    }

    // 3. Cargos (tabela nova citada pela chave ganha o nome definitivo). O servico de cargos
    // confere nivel e que ninguem da mais poder do que tem.
    for (const p of n.plan.roles.filter((x) => x.kind !== 'delete')) {
      await step('role', p.kind, p.key, p.name, async () => {
        const data = { ...p.data!, permissions: p.data!.permissions?.map((e) => ({ ...e, entitySlug: created.get(String(e.entitySlug))?.slug ?? e.entitySlug })) };
        if (p.kind === 'create') return (await this.customRoleService.create(data as unknown as CreateCustomRoleDto, user)).id;
        snapshots[`role:${p.base!.id}`] = p.base;
        await this.customRoleService.update(p.base!.id, data as unknown as CreateCustomRoleDto, user);
        return p.base!.id;
      });
    }

    // 4. Automacoes (tabela nova ja tem id)
    const entityIdOf = new Map((await this.prisma.entity.findMany({ where: { tenantId }, select: { id: true, slug: true } })).map((e) => [e.slug, e.id]));
    for (const p of n.plan.automations.filter((x) => x.kind !== 'delete')) {
      await step('automation', p.kind, p.key, p.name, async () => {
        const dto = p.data as unknown as CreateAutomationDto;
        if (p.kind === 'create') {
          const entityId = created.get(p.table)?.id ?? entityIdOf.get(p.table);
          if (!entityId) throw new BadRequestException('A tabela da automação não foi encontrada.');
          return (await this.automationService.create(tenantId, entityId, dto)).id;
        }
        snapshots[`automation:${p.base!.id}`] = p.base;
        await this.automationService.update(tenantId, p.base!.entityId, p.base!.id, dto);
        return p.base!.id;
      });
    }

    // 5. Paineis e PDFs: conferidos de novo com as tabelas reais (as novas ja tem nome definitivo)
    const schema = failed ? [] : await loadTenantSchema(this.prisma, tenantId);
    const realSlug = (ref: unknown) => (typeof ref === 'string' ? created.get(ref)?.slug ?? ref : ref);
    const fixDashboard = (d: WsDashboard): WsDashboard => ({
      ...d, mainTable: realSlug(d.mainTable) as string,
      tabs: d.tabs.map((tab) => ({ ...tab, rows: tab.rows.map((r) => r.map((w) => ({ ...w, table: realSlug(w.table) as string }))) })),
    });
    for (const p of n.plan.dashboards.filter((x) => x.kind !== 'delete')) {
      await step('dashboard', p.kind, p.key, p.name, async () => {
        const nd = normalizeDashboard(fixDashboard(p.draft!), schema, base.roles, p.base ? kept.get(p.base.id) : undefined);
        const payload = { ...nd.dashboard, name: p.draft!.name };
        if (p.kind === 'create') return (await this.dashboardService.create(payload, user)).id;
        snapshots[`dashboard:${p.base!.id}`] = p.base;
        const { name, description, layout, widgets, tabs, roleIds } = payload;
        await this.dashboardService.update(p.base!.id, { name, description, layout, widgets, tabs, roleIds }, user);
        return p.base!.id;
      });
    }
    const pdfSlugs = new Set((await this.prisma.pdfTemplate.findMany({ where: { tenantId }, select: { slug: true } })).map((t) => t.slug));
    for (const p of n.plan.pdfs.filter((x) => x.kind !== 'delete')) {
      await step('pdf', p.kind, p.key, p.name, async () => {
        const table = String(realSlug(p.table));
        const content = p.content ? (normalizePdf({ ...p.draft, table }, schema, table).content as unknown as PdfTemplateContent) : undefined;
        if (p.kind === 'create') {
          const source = schema.find((t) => t.slug === table);
          if (!source || !content) throw new BadRequestException('A tabela do PDF não foi encontrada.');
          const baseSlug = slugify(p.draft!.name, '-') || 'modelo';
          let slug = baseSlug;
          for (let i = 2; pdfSlugs.has(slug); i++) slug = `${baseSlug}-${i}`;
          pdfSlugs.add(slug);
          const t = await this.pdfTemplateService.create({
            name: p.draft!.name, slug, description: p.description, sourceEntityId: source.id, templateType: 'single', content,
          }, user);
          return t.id;
        }
        const old = await this.prisma.pdfTemplate.findFirst({ where: { id: p.base!.id, tenantId }, select: { name: true, description: true, content: true } });
        snapshots[`pdf:${p.base!.id}`] = old;
        await this.pdfTemplateService.update(p.base!.id, { name: p.draft!.name, description: p.description, ...(content ? { content } : {}) }, user);
        return p.base!.id;
      });
    }

    // 6. Exclusoes por ultimo (automacoes, cargos, PDFs, paineis e tabelas; tabelas vao para a lixeira)
    for (const p of n.plan.automations.filter((x) => x.kind === 'delete')) {
      await step('automation', 'delete', p.key, p.name, async () => {
        snapshots[`automation:${p.base!.id}`] = p.base;
        await this.automationService.remove(tenantId, p.base!.entityId, p.base!.id);
        return p.base!.id;
      });
    }
    for (const p of n.plan.roles.filter((x) => x.kind === 'delete')) {
      await step('role', 'delete', p.key, p.name, async () => {
        snapshots[`role:${p.base!.id}`] = p.base;
        await this.customRoleService.remove(p.base!.id, user);
        return p.base!.id;
      });
    }
    for (const p of n.plan.pdfs.filter((x) => x.kind === 'delete')) {
      await step('pdf', 'delete', p.key, p.name, async () => {
        snapshots[`pdf:${p.base!.id}`] = await this.prisma.pdfTemplate.findFirst({ where: { id: p.base!.id, tenantId } });
        await this.pdfTemplateService.remove(p.base!.id, user);
        return p.base!.id;
      });
    }
    for (const p of n.plan.dashboards.filter((x) => x.kind === 'delete')) {
      await step('dashboard', 'delete', p.key, p.name, async () => {
        snapshots[`dashboard:${p.base!.id}`] = p.base;
        await this.dashboardService.remove(p.base!.id, user);
        return p.base!.id;
      });
    }
    for (const p of n.plan.tables.filter((x) => x.kind === 'delete')) {
      await step('table', 'delete', p.key, p.name, async () => {
        await this.entityService.remove(p.entity!.id, user);
        return p.entity!.id;
      });
    }

    const request = (dto.conversation ?? []).map((m) => m.slice(0, 1000)).slice(-20);
    await this.auditService.log(user, {
      action: 'ai_apply',
      resource: 'ai_builder',
      metadata: { request, viaAi: request.length > 0, changes: n.changes, applied, failed, warnings: n.warnings, snapshots },
    });
    this.logger.log(`construtor aplicado tenant=${tenantId} mudancas=${applied.length}${failed ? ' (parou num erro)' : ''}`);
    return { applied, failed, warnings: n.warnings };
  }
}

/**
 * A IA devolve o rascunho inteiro; se esquecer um item que ja estava nele, o item
 * continua (desfazer e com a pessoa, na tela, ou pedindo "desfaça").
 */
function mergeForgotten(output: unknown, current: { tables: Array<{ key: string }>; dashboards: Array<{ key: string }>; pdfs: Array<{ key: string }>; roles?: Array<{ key: string }>; automations?: Array<{ key: string }> } | null): unknown {
  if (!output || typeof output !== 'object') return output;
  const out = output as Record<string, unknown>;
  const merge = (name: 'tables' | 'dashboards' | 'pdfs' | 'roles' | 'automations') => {
    const list = Array.isArray(out[name]) ? (out[name] as Array<{ key?: string; undo?: boolean }>) : [];
    // "undo": a pessoa pediu para desfazer a mudanca (o item volta a ser como esta)
    const keys = new Set(list.map((x) => x?.key));
    const kept = list.filter((x) => x && x.undo !== true);
    return [...kept, ...(current?.[name] ?? []).filter((x) => !keys.has(x.key))];
  };
  return { ...out, tables: merge('tables'), dashboards: merge('dashboards'), pdfs: merge('pdfs'), roles: merge('roles'), automations: merge('automations') };
}

export type { SchemaTable, WsPdf };
