import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { EntityService, type FieldDefinition } from '../entity/entity.service';
import { DashboardTemplateService } from '../dashboard-template/dashboard-template.service';
import { PdfTemplateService } from '../pdf/pdf-template.service';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import type { PdfTemplateContent } from '../pdf/interfaces/pdf-element.interface';
import { AI_PROPOSAL_JSON_SCHEMA, AI_SYSTEM_PROMPT } from './ai-builder.schema';
import { AiApplyDto, AiPdfPreviewDto, AiProposeDto } from './ai-builder.dto';
import { createAiBuilderProvider, type AiAssistantKind, type AiBuilderProvider } from './ai-providers';
import { creationOrder, normalizeProposal, slugify, type ExistingTable, type NormalizedProposal } from './ai-proposal-normalizer';
import { AI_DASHBOARD_JSON_SCHEMA, AI_DASHBOARD_SYSTEM_PROMPT, normalizeDashboard, type NormalizedDashboard } from './dashboard-proposal';
import { AI_PDF_JSON_SCHEMA, AI_PDF_SYSTEM_PROMPT, normalizePdf, type NormalizedPdf } from './pdf-proposal';
import { describeSchema, loadTenantSchema, type SchemaTable } from './tenant-schema';

const MAX_PROPOSAL_BYTES = 100_000;

@Injectable()
export class AiBuilderService {
  private readonly logger = new Logger(AiBuilderService.name);
  private readonly provider: AiBuilderProvider | null = createAiBuilderProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly entityService: EntityService,
    private readonly dashboardService: DashboardTemplateService,
    private readonly pdfTemplateService: PdfTemplateService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  status() {
    return { enabled: !!this.provider, provider: this.provider?.name ?? null };
  }

  private toExisting(tables: SchemaTable[]): ExistingTable[] {
    return tables.map((t) => ({
      id: t.id, slug: t.slug, name: t.name, titleField: t.titleField,
      fieldLabels: t.fields.filter((f) => f.type !== 'section-title').map((f) => f.label),
    }));
  }

  private parseProposal(raw: Record<string, unknown> | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    if (JSON.stringify(raw).length > MAX_PROPOSAL_BYTES) throw new BadRequestException('A proposta ficou grande demais.');
    return raw;
  }

  private conversation(messages: AiProposeDto['messages']): string[] {
    const last = messages[messages.length - 1];
    if (last.role !== 'user') throw new BadRequestException('A última mensagem precisa ser da pessoa.');
    return messages.map((m) => `${m.role === 'user' ? 'Pessoa' : 'Assistente'}: ${m.content}`);
  }

  /** Chama a IA (so estrutura + conversa) e registra so metadados. */
  private async ask(
    kind: AiAssistantKind,
    tenantId: string,
    system: string,
    schema: Record<string, unknown>,
    context: string[],
    dto: AiProposeDto,
    current: unknown,
    tables: SchemaTable[],
    preferredTable?: string,
  ): Promise<unknown> {
    if (!this.provider) throw new ServiceUnavailableException('O assistente não está ligado neste ambiente.');
    const conversation = this.conversation(dto.messages);
    const prompt = [
      ...context,
      '', 'PROPOSTA ATUAL:', current ? JSON.stringify(current) : '(ainda não há; monte a primeira)',
      '', 'CONVERSA:', ...conversation,
      '', 'Devolva a proposta completa e atualizada.',
    ].join('\n');
    const started = Date.now();
    const result = await this.provider.propose({
      kind, system, prompt, schema, lastMessage: dto.messages[dto.messages.length - 1].content, current, tables, preferredTable,
    });
    // So metadados no log (nada do que a pessoa escreveu)
    this.logger.log(
      `proposta ${kind} tenant=${tenantId} provider=${this.provider.name} ms=${result.durationMs ?? Date.now() - started}` +
        (result.costUsd !== undefined ? ` custo=$${result.costUsd.toFixed(4)}` : ''),
    );
    return result.output;
  }

  // ── Tabelas ──────────────────────────────────────────────────────────

  private presentTables(n: NormalizedProposal, existing: ExistingTable[]) {
    const linked = new Set(n.tables.flatMap((t) => t.fields.map((f) => f.relatedEntityId).filter(Boolean)));
    return {
      reply: n.reply,
      warnings: n.warnings,
      proposal: n.proposal,
      tables: n.tables.map(({ refs: _refs, ...t }) => t),
      /** Nome das tabelas que ja existem e que a proposta liga (para a previa). */
      existingNames: Object.fromEntries(existing.filter((e) => linked.has(e.id)).map((e) => [e.slug, e.name])),
    };
  }

  async propose(dto: AiProposeDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const existing = this.toExisting(await loadTenantSchema(this.prisma, tenantId));
    // A proposta atual vem do navegador: so a versao corrigida segue para a IA
    const raw = this.parseProposal(dto.currentProposal);
    const current = raw ? normalizeProposal(raw, existing).proposal : null;
    const context = [
      'TABELAS QUE JÁ EXISTEM NESTA EMPRESA (para ligar a uma delas, use o identificador entre colchetes em "relatedTable"):',
      ...(existing.length ? existing.slice(0, 60).map((e) => `- [${e.slug}] ${e.name}: ${e.fieldLabels.slice(0, 15).join(', ')}`) : ['(nenhuma)']),
    ];
    const output = await this.ask('tables', tenantId, AI_SYSTEM_PROMPT, AI_PROPOSAL_JSON_SCHEMA, context, dto, current, []);
    return this.presentTables(normalizeProposal(output, existing), existing);
  }

  /** Previa de uma proposta mexida a mao (sem IA, sem custo): confere e desenha de novo. */
  async previewTables(dto: AiApplyDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const existing = this.toExisting(await loadTenantSchema(this.prisma, tenantId));
    return this.presentTables(normalizeProposal(this.parseProposal(dto.proposal), existing), existing);
  }

  /** Cria as tabelas da proposta (revalidada aqui; nada do cliente e confiado). */
  async apply(dto: AiApplyDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const existing = this.toExisting(await loadTenantSchema(this.prisma, tenantId));
    const normalized = normalizeProposal(this.parseProposal(dto.proposal), existing);
    if (normalized.tables.length === 0) throw new BadRequestException('A proposta não tem tabelas.');
    const order = creationOrder(normalized.tables, normalized.warnings);

    // Slugs unicos no banco inclusive entre tabelas excluidas (o indice unico as conta)
    const [active, deleted] = await Promise.all([
      this.prisma.entity.findMany({ where: { tenantId }, select: { slug: true } }),
      this.prisma.entity.findMany({ where: { tenantId, deletedAt: { not: null } }, select: { slug: true } }),
    ]);
    const taken = new Set([...active, ...deleted].map((e) => e.slug));

    const created = new Map<string, { id: string; slug: string; name: string }>();
    try {
      for (const t of order) {
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
        const entity = await this.entityService.create(
          {
            name: t.name,
            namePlural: t.namePlural,
            slug,
            description: t.description,
            icon: t.icon,
            color: t.color,
            ...(normalized.group ? { category: normalized.group } : {}),
            fields: fields as unknown as FieldDefinition[],
            settings: t.settings,
          },
          user,
        );
        created.set(t.key, { id: entity.id, slug: entity.slug, name: entity.name });
      }
    } catch (err) {
      // Desfaz o que ja foi criado (exclusao recuperavel), para nao deixar meia proposta
      for (const c of [...created.values()].reverse()) {
        await this.entityService.remove(c.id, user).catch(() => undefined);
      }
      this.logger.error(`aplicar proposta falhou tenant=${tenantId}: ${(err as Error).message}`);
      throw err;
    }

    const root = normalized.tables.find((t) => !t.parentKey) ?? normalized.tables[0];
    return {
      rootId: created.get(root.key)?.id,
      warnings: normalized.warnings,
      tables: normalized.tables.map((t) => ({ key: t.key, ...created.get(t.key)! })),
    };
  }

  // ── Paineis ──────────────────────────────────────────────────────────

  private async dashboardContext(tenantId: string) {
    const tables = await loadTenantSchema(this.prisma, tenantId);
    if (tables.length === 0) throw new BadRequestException('Crie uma tabela antes de montar um painel.');
    const roles = await this.prisma.customRole.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { rank: 'asc' } });
    return { tables, roles };
  }

  private normalizeDashboardOrFail(raw: unknown, tables: SchemaTable[], roles: Array<{ id: string; name: string }>): NormalizedDashboard {
    try {
      return normalizeDashboard(raw, tables, roles);
    } catch {
      throw new BadRequestException('Não consegui montar o painel com as tabelas desta empresa.');
    }
  }

  async proposeDashboard(dto: AiProposeDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const { tables, roles } = await this.dashboardContext(tenantId);
    const raw = this.parseProposal(dto.currentProposal);
    const current = raw ? this.normalizeDashboardOrFail(raw, tables, roles).proposal : null;
    const context = [
      'TABELAS DA EMPRESA (identificadores entre colchetes; campos: identificador (tipo) "rótulo"):',
      describeSchema(tables, true),
      '', `CARGOS: ${roles.map((r) => r.name).join(', ') || '(nenhum)'}`,
    ];
    const output = await this.ask('dashboard', tenantId, AI_DASHBOARD_SYSTEM_PROMPT, AI_DASHBOARD_JSON_SCHEMA, context, dto, current, tables);
    const n = this.normalizeDashboardOrFail(output, tables, roles);
    return { reply: n.reply, warnings: n.warnings, proposal: n.proposal, dashboard: n.dashboard, roleNames: n.roleNames };
  }

  async applyDashboard(dto: AiApplyDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const { tables, roles } = await this.dashboardContext(tenantId);
    const n = this.normalizeDashboardOrFail(this.parseProposal(dto.proposal), tables, roles);
    const created = await this.dashboardService.create(n.dashboard, user);
    return { id: created.id, name: created.name, warnings: n.warnings };
  }

  // ── PDFs ─────────────────────────────────────────────────────────────

  private normalizePdfOrFail(raw: unknown, tables: SchemaTable[], table?: string): NormalizedPdf {
    try {
      return normalizePdf(raw, tables, table);
    } catch {
      throw new BadRequestException('Escolha a tabela de onde o PDF vai tirar os dados.');
    }
  }

  async proposePdf(dto: AiProposeDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const tables = await loadTenantSchema(this.prisma, tenantId);
    const table = tables.find((t) => t.slug === dto.table);
    if (!table) throw new BadRequestException('Escolha a tabela de onde o PDF vai tirar os dados.');
    const raw = this.parseProposal(dto.currentProposal);
    const current = raw ? this.normalizePdfOrFail(raw, tables, table.slug).proposal : null;
    // So a tabela escolhida, a de cima e as listas dela (o resto nao ajuda o PDF)
    const related = tables.filter((t) => t.slug === table.slug || t.slug === table.parentSlug || t.parentSlug === table.slug);
    const context = [
      `TABELA DO PDF: [${table.slug}] ${table.namePlural}${table.parentSlug ? ` (lista dentro de [${table.parentSlug}]; campos dela com "_parent.")` : ''}`,
      'ESTRUTURA (campos: identificador (tipo) "rótulo"):',
      describeSchema(related, true),
    ];
    const output = await this.ask('pdf', tenantId, AI_PDF_SYSTEM_PROMPT, AI_PDF_JSON_SCHEMA, context, dto, current, tables, table.slug);
    const n = this.normalizePdfOrFail(output, tables, table.slug);
    return { reply: n.reply, warnings: n.warnings, proposal: n.proposal, name: n.name, tableName: n.table.name };
  }

  /** PDF de verdade com dados de exemplo, antes de salvar o modelo. */
  async previewPdf(dto: AiPdfPreviewDto, user: CurrentUser): Promise<Buffer> {
    const tenantId = getEffectiveTenantId(user);
    const tables = await loadTenantSchema(this.prisma, tenantId);
    const raw = this.parseProposal(dto.proposal);
    const n = this.normalizePdfOrFail(raw, tables, typeof raw?.table === 'string' ? raw.table : undefined);
    return this.pdfGenerator.previewDraft(n.table.id, n.content as unknown as PdfTemplateContent, user);
  }

  async applyPdf(dto: AiApplyDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const tables = await loadTenantSchema(this.prisma, tenantId);
    const raw = this.parseProposal(dto.proposal);
    const n = this.normalizePdfOrFail(raw, tables, typeof raw?.table === 'string' ? raw.table : undefined);
    const base = slugify(n.name, '-') || 'modelo';
    const taken = new Set((await this.prisma.pdfTemplate.findMany({ where: { tenantId }, select: { slug: true } })).map((t) => t.slug));
    let slug = base;
    for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
    const created = await this.pdfTemplateService.create(
      {
        name: n.name, slug, description: n.description, sourceEntityId: n.table.id, templateType: 'single',
        content: n.content as unknown as PdfTemplateContent,
      },
      user,
    );
    return { id: created.id, name: created.name, warnings: n.warnings };
  }
}
