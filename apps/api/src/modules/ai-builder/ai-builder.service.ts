import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { EntityService, type FieldDefinition } from '../entity/entity.service';
import { AI_PROPOSAL_JSON_SCHEMA, AI_SYSTEM_PROMPT, type AiProposal } from './ai-builder.schema';
import { AiApplyDto, AiProposeDto } from './ai-builder.dto';
import { createAiBuilderProvider, type AiBuilderProvider } from './ai-providers';
import { creationOrder, normalizeProposal, slugify, type ExistingTable, type NormalizedProposal } from './ai-proposal-normalizer';

const MAX_PROPOSAL_BYTES = 100_000;

type FieldJson = { slug?: string; label?: string; name?: string; type?: string };

@Injectable()
export class AiBuilderService {
  private readonly logger = new Logger(AiBuilderService.name);
  private readonly provider: AiBuilderProvider | null = createAiBuilderProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly entityService: EntityService,
  ) {}

  status() {
    return { enabled: !!this.provider, provider: this.provider?.name ?? null };
  }

  /** Estrutura das tabelas da empresa (nomes e campos, nunca registros). */
  private async existingTables(tenantId: string): Promise<ExistingTable[]> {
    const rows = await this.prisma.entity.findMany({
      where: { tenantId },
      select: { id: true, slug: true, name: true, fields: true, settings: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return rows.map((e) => {
      const fields = (Array.isArray(e.fields) ? e.fields : []) as FieldJson[];
      const settings = (e.settings || {}) as { titleField?: string };
      return {
        id: e.id,
        slug: e.slug,
        name: e.name,
        titleField: settings.titleField ?? fields.find((f) => f.type === 'text')?.slug,
        fieldLabels: fields.filter((f) => f.type !== 'section-title').map((f) => String(f.label || f.name || f.slug)),
      };
    });
  }

  private buildPrompt(existing: ExistingTable[], current: AiProposal | null, messages: AiProposeDto['messages']): string {
    const lines: string[] = ['TABELAS QUE JÁ EXISTEM NESTA EMPRESA (para ligar a uma delas, use o identificador entre colchetes em "relatedTable"):'];
    if (existing.length === 0) lines.push('(nenhuma)');
    for (const e of existing.slice(0, 60)) lines.push(`- [${e.slug}] ${e.name}: ${e.fieldLabels.slice(0, 15).join(', ')}`);
    lines.push('', 'PROPOSTA ATUAL:', current ? JSON.stringify(current) : '(ainda não há; monte a primeira)');
    lines.push('', 'CONVERSA:');
    for (const m of messages) lines.push(`${m.role === 'user' ? 'Pessoa' : 'Assistente'}: ${m.content}`);
    lines.push('', 'Devolva a proposta completa e atualizada.');
    return lines.join('\n');
  }

  private parseProposal(raw: Record<string, unknown> | undefined): AiProposal | null {
    if (!raw) return null;
    if (JSON.stringify(raw).length > MAX_PROPOSAL_BYTES) throw new BadRequestException('A proposta ficou grande demais.');
    return raw as unknown as AiProposal;
  }

  private present(n: NormalizedProposal, existing: ExistingTable[]) {
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
    if (!this.provider) throw new ServiceUnavailableException('O assistente não está ligado neste ambiente.');
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'user') throw new BadRequestException('A última mensagem precisa ser da pessoa.');

    const tenantId = getEffectiveTenantId(user);
    const existing = await this.existingTables(tenantId);
    // A proposta atual vem do navegador: so a versao corrigida segue para a IA
    const raw = this.parseProposal(dto.currentProposal);
    const current = raw ? normalizeProposal(raw, existing).proposal : null;
    const started = Date.now();
    const result = await this.provider.propose({
      system: AI_SYSTEM_PROMPT,
      prompt: this.buildPrompt(existing, current, dto.messages),
      schema: AI_PROPOSAL_JSON_SCHEMA,
      lastMessage: last.content,
      current,
    });
    // So metadados no log (nada do que a pessoa escreveu)
    this.logger.log(
      `proposta tenant=${tenantId} provider=${this.provider.name} ms=${result.durationMs ?? Date.now() - started}` +
        (result.costUsd !== undefined ? ` custo=$${result.costUsd.toFixed(4)}` : ''),
    );
    return this.present(normalizeProposal(result.output, existing), existing);
  }

  /** Cria as tabelas da proposta (revalidada aqui; nada do cliente e confiado). */
  async apply(dto: AiApplyDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const existing = await this.existingTables(tenantId);
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
}
