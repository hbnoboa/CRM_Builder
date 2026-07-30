import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { hasPlatformAccess, hasFullTenantAccess } from '../../common/utils/platform-access';
import { DataService } from '../data/data.service';
import { AuditService } from '../audit/audit.service';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import { createBotProvider, BOT_TOOLS, BotLlmProvider } from './bot-provider';
import * as ExcelJS from 'exceljs';

// Filtro de campo (mesmo formato do pipeline de EntityDataQueryService).
type ReportFilter = {
  fieldSlug: string;
  fieldType?: string;
  operator: string;
  value?: unknown;
  value2?: unknown;
};
type ReportColumn = { slug: string; label: string };

/**
 * Chat — fatia 1: canais (grupo por tabela + DM) e mensagens.
 * Visibilidade do canal de grupo = mesma regra de leitura de entidade do RBAC
 * permission-driven (permissions[] com slug exato ou coringa '*'), espelhando o
 * que o PowerSync faz em _visibleToRolesJson. Ver docs/chat-bot-module-spec.md.
 */
@Injectable()
export class ChatService {
  private readonly bot: BotLlmProvider = createBotProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataService: DataService,
    private readonly auditService: AuditService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  /** Permissão de uma ação na entidade (permissions[] slug/'*' + platform). */
  private canEntity(user: CurrentUser, entitySlug: string, action: 'canRead' | 'canCreate' | 'canUpdate'): boolean {
    if (
      hasPlatformAccess(user.customRole?.modulePermissions) ||
      hasFullTenantAccess(user.customRole?.modulePermissions)
    ) {
      return true;
    }
    const perms = user.customRole?.permissions as
      | Array<Record<string, unknown>>
      | undefined;
    if (!Array.isArray(perms)) return false;
    const exact = perms.find((p) => p.entitySlug === entitySlug);
    if (exact) return exact[action] === true;
    const wild = perms.find((p) => p.entitySlug === '*');
    if (wild) return wild[action] === true;
    return false;
  }

  private canReadEntity(user: CurrentUser, entitySlug: string): boolean {
    return this.canEntity(user, entitySlug, 'canRead');
  }

  /** Permissão dedicada de gerir canais/comandos do chat (criar, renomear). */
  private canManageChat(user: CurrentUser): boolean {
    if (
      hasPlatformAccess(user.customRole?.modulePermissions) ||
      hasFullTenantAccess(user.customRole?.modulePermissions)
    ) {
      return true;
    }
    const mp = user.customRole?.modulePermissions as
      | Record<string, Record<string, boolean>>
      | undefined;
    return mp?.chat?.manage === true;
  }

  private assertCanManageChat(user: CurrentUser): void {
    if (!this.canManageChat(user)) {
      throw new ForbiddenException('Sem permissão para criar/gerir canais do chat.');
    }
  }

  /** Chave canônica do par de usuários de um DM (evita canal duplicado). */
  private dmKeyFor(a: string, b: string): string {
    return [a, b].sort().join(':');
  }

  /** Lista canais visíveis: grupos de tabelas que o usuário pode ler + DMs dele. */
  async listChannels(user: CurrentUser) {
    const tenantId = user.tenantId;

    const [entities, groupChannels, recordChannels, dmMemberships] = await Promise.all([
      this.prisma.entity.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, slug: true, name: true, namePlural: true, icon: true, color: true },
      }),
      this.prisma.channel.findMany({
        where: { tenantId, type: 'group' },
      }),
      this.prisma.channel.findMany({
        where: { tenantId, type: 'record' },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.channelMember.findMany({
        where: { userId: user.id, channel: { tenantId, type: 'dm' } },
        include: { channel: { include: { members: true } } },
      }),
    ]);

    const entityById = new Map(entities.map((e) => [e.id, e]));

    const groups = groupChannels
      .filter((c) => {
        const ent = c.entityId ? entityById.get(c.entityId) : null;
        return ent ? this.canReadEntity(user, ent.slug) : false;
      })
      .map((c) => {
        const ent = entityById.get(c.entityId as string)!;
        // Nome do canal: custom (channel.name) ou o nome da tabela (NUNCA a
        // namePlural auto-gerada, que duplica o 's'). Ver feedback do usuário.
        return {
          ...c,
          name: c.name || ent.name,
          entity: { slug: ent.slug, name: ent.name, icon: ent.icon, color: ent.color },
        };
      });

    // Threads de registro: 1º filtro = canRead da tabela; 2º filtro = o usuário
    // precisa ENXERGAR o registro (scope + dataFilters), senão veria o chat de um
    // registro fora do seu filtro (vazamento do nome/existência).
    const candidateThreads = recordChannels
      .filter((c) => {
        const ent = c.entityId ? entityById.get(c.entityId) : null;
        return ent ? this.canReadEntity(user, ent.slug) : false;
      })
      .map((c) => {
        const ent = entityById.get(c.entityId as string)!;
        return {
          ...c,
          name: c.name || `${ent.name} ${(c.recordId || '').slice(-6)}`,
          entity: { slug: ent.slug, name: ent.name, icon: ent.icon, color: ent.color },
        };
      });
    const threads = await this.filterVisibleRecordThreads(user, candidateThreads);

    const dms = dmMemberships.map((m) => m.channel);

    return { groups, threads, dms };
  }

  /**
   * Mantém só os threads cujo REGISTRO o usuário enxerga (scope + dataFilters).
   * Agrupa por tabela e usa findAll com recordIds (1 query por tabela) para reaplicar
   * o pipeline de visibilidade do registro.
   */
  private async filterVisibleRecordThreads<
    T extends { recordId?: string | null; entity?: { slug: string } },
  >(user: CurrentUser, threads: T[]): Promise<T[]> {
    const byEntity = new Map<string, T[]>();
    for (const t of threads) {
      const slug = t.entity?.slug;
      if (!slug || !t.recordId) continue;
      const list = byEntity.get(slug) || [];
      list.push(t);
      byEntity.set(slug, list);
    }
    const out: T[] = [];
    for (const [slug, list] of Array.from(byEntity.entries())) {
      const ids = list.map((t) => t.recordId as string);
      const res = (await this.dataService
        .findAll(
          slug,
          {
            recordIds: JSON.stringify(ids),
            limit: ids.length,
            includeChildren: 'true',
          } as unknown as Record<string, unknown>,
          user,
        )
        .catch(() => ({ data: [] }))) as unknown as { data?: Array<{ id: string }> };
      const visible = new Set((res.data || []).map((r) => r.id));
      for (const t of list) if (visible.has(t.recordId as string)) out.push(t);
    }
    return out;
  }

  /** Abre (ou cria sob demanda) o canal de grupo de uma tabela. Exige canRead. */
  async openGroupChannel(user: CurrentUser, entitySlug: string) {
    const tenantId = user.tenantId;
    const entity = await this.prisma.entity.findFirst({
      where: { tenantId, slug: entitySlug, deletedAt: null },
      select: { id: true, slug: true, name: true, namePlural: true },
    });
    if (!entity) throw new NotFoundException('Tabela não encontrada');
    if (!this.canReadEntity(user, entity.slug)) {
      throw new ForbiddenException('Sem permissão para esta tabela');
    }

    // find+create manual (não há mais @@unique simples; a unicidade é via índice
    // parcial WHERE recordId IS NULL). Em corrida, o índice rejeita o 2º insert.
    const existing = await this.prisma.channel.findFirst({
      where: { tenantId, entityId: entity.id, recordId: null, type: 'group' },
    });
    if (existing) return existing;
    // Só quem gerencia o chat CRIA o canal (qualquer um que lê a tabela abre o existente).
    this.assertCanManageChat(user);
    try {
      return await this.prisma.channel.create({
        data: {
          tenantId,
          type: 'group',
          entityId: entity.id,
          // Default = nome da tabela (não a namePlural auto-pluralizada).
          name: entity.name,
          createdById: user.id,
        },
      });
    } catch {
      const again = await this.prisma.channel.findFirst({
        where: { tenantId, entityId: entity.id, recordId: null, type: 'group' },
      });
      if (again) return again;
      throw new ForbiddenException('Não foi possível abrir o canal.');
    }
  }

  /**
   * Abre/garante o thread de chat de um REGISTRO específico (ex.: uma operação).
   * Visibilidade: quem tem canRead da tabela e enxerga o registro (findAll aplica
   * scope/dataFilters). O nome do thread = valor de exibição do registro.
   */
  async openRecordChannel(
    user: CurrentUser,
    entitySlug: string,
    recordId: string,
    commandIds?: string[],
  ) {
    const tenantId = user.tenantId;
    const entity = await this.prisma.entity.findFirst({
      where: { tenantId, slug: entitySlug, deletedAt: null },
      select: { id: true, slug: true, name: true, fields: true },
    });
    if (!entity) throw new NotFoundException('Tabela não encontrada');
    if (!this.canReadEntity(user, entity.slug)) {
      throw new ForbiddenException('Sem permissão para esta tabela');
    }

    // Confirma que o usuário ENXERGA esse registro (canRead + scope + dataFilters).
    const rec = (await this.dataService.findOne(entitySlug, recordId, user)) as unknown as {
      id: string;
      data?: Record<string, unknown>;
    } | null;
    if (!rec) throw new NotFoundException('Registro não encontrado ou sem acesso');

    const fields = (entity.fields as Array<{ slug: string; type: string }>) || [];
    const keyField = fields.find((f) => ['text', 'select'].includes(f.type))?.slug;
    const label =
      (keyField && rec.data?.[keyField] != null ? String(rec.data[keyField]) : null) ||
      `${entity.name} ${recordId.slice(-6)}`;

    const existing = await this.prisma.channel.findFirst({
      where: { tenantId, recordId, type: 'record' },
    });
    if (existing) return existing; // já existe: NÃO mexe nos comandos (seletor é só na criação)
    let created: { id: string };
    try {
      created = await this.prisma.channel.create({
        data: {
          tenantId,
          type: 'record',
          entityId: entity.id,
          recordId,
          name: label,
          createdById: user.id,
        },
      });
    } catch {
      const again = await this.prisma.channel.findFirst({
        where: { tenantId, recordId, type: 'record' },
      });
      if (again) return again;
      throw new ForbiddenException('Não foi possível abrir o chat do registro.');
    }
    // Anexa os comandos escolhidos NA CRIAÇÃO (some/all). Se não vier lista, o chat
    // fica sem anexos e cai no fallback (todos) — retrocompatível.
    if (Array.isArray(commandIds) && commandIds.length > 0) {
      await this.setChannelCommands(user, created.id, commandIds);
    }
    return this.prisma.channel.findUnique({ where: { id: created.id } });
  }

  /** Metadados p/ decidir o fluxo no front: existe? quais comandos anexados? */
  async recordChannelMeta(user: CurrentUser, entitySlug: string, recordId: string) {
    const entity = await this.prisma.entity.findFirst({
      where: { tenantId: user.tenantId, slug: entitySlug, deletedAt: null },
      select: { slug: true },
    });
    if (!entity || !this.canReadEntity(user, entity.slug)) {
      return { exists: false, channelId: null, commandIds: [] as string[] };
    }
    const channel = await this.prisma.channel.findFirst({
      where: { tenantId: user.tenantId, recordId, type: 'record' },
      select: { id: true },
    });
    if (!channel) return { exists: false, channelId: null, commandIds: [] as string[] };
    const links = await this.prisma.channelCommand.findMany({
      where: { channelId: channel.id },
      select: { commandTemplateId: true },
    });
    return {
      exists: true,
      channelId: channel.id,
      commandIds: links.map((l) => l.commandTemplateId),
    };
  }

  /** Substitui o conjunto de comandos anexados a um canal (gerenciar/criar). */
  async setChannelCommands(user: CurrentUser, channelId: string, commandIds: string[]) {
    await this.assertAccess(user, channelId);
    // Só aceita comandos do próprio tenant.
    const valid = await this.prisma.commandTemplate.findMany({
      where: { tenantId: user.tenantId, id: { in: commandIds } },
      select: { id: true },
    });
    const validIds = new Set(valid.map((v) => v.id));
    const keep = commandIds.filter((id) => validIds.has(id));
    await this.prisma.$transaction([
      this.prisma.channelCommand.deleteMany({ where: { channelId } }),
      ...(keep.length
        ? [
            this.prisma.channelCommand.createMany({
              data: keep.map((commandTemplateId) => ({
                tenantId: user.tenantId,
                channelId,
                commandTemplateId,
              })),
            }),
          ]
        : []),
    ]);
    return { channelId, commandIds: keep };
  }

  /** Abre (ou encontra) uma DM entre o usuário atual e outro usuário do tenant. */
  async openDm(user: CurrentUser, otherUserId: string) {
    const tenantId = user.tenantId;
    if (otherUserId === user.id) {
      throw new ForbiddenException('Não é possível abrir DM consigo mesmo');
    }
    // O outro usuário precisa ser membro do mesmo tenant.
    const otherAccess = await this.prisma.userTenantAccess.findFirst({
      where: { userId: otherUserId, tenantId, status: 'ACTIVE', deletedAt: null },
      select: { userId: true },
    });
    if (!otherAccess) throw new NotFoundException('Usuário não está neste tenant');

    // Anti-duplicado: DM identificado pela chave canônica do par (dmKey).
    const dmKey = this.dmKeyFor(user.id, otherUserId);
    const existing = await this.prisma.channel.findFirst({
      where: { tenantId, type: 'dm', dmKey },
    });
    if (existing) return existing;
    this.assertCanManageChat(user);

    try {
      return await this.prisma.channel.create({
        data: {
          tenantId,
          type: 'dm',
          dmKey,
          createdById: user.id,
          members: {
            create: [
              { userId: user.id, role: 'member' },
              { userId: otherUserId, role: 'member' },
            ],
          },
        },
      });
    } catch {
      // Corrida: o índice único (tenantId, dmKey) rejeita o 2º insert — devolve o existente.
      const again = await this.prisma.channel.findFirst({
        where: { tenantId, type: 'dm', dmKey },
      });
      if (again) return again;
      throw new ForbiddenException('Não foi possível abrir a conversa.');
    }
  }

  /** Renomeia um canal. Permitido para o criador do canal OU quem gerencia o chat. */
  async renameChannel(user: CurrentUser, channelId: string, name: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, tenantId: true, createdById: true, type: true },
    });
    if (!channel || channel.tenantId !== user.tenantId) {
      throw new NotFoundException('Canal não encontrado');
    }
    if (channel.createdById !== user.id && !this.canManageChat(user)) {
      throw new ForbiddenException('Sem permissão para renomear este canal.');
    }
    const clean = (name || '').trim().slice(0, 120);
    if (!clean) throw new BadRequestException('Informe um nome.');
    return this.prisma.channel.update({
      where: { id: channelId },
      data: { name: clean },
      select: { id: true, name: true, type: true },
    });
  }

  /** Garante que o usuário pode ver/postar no canal; devolve o canal. */
  private async assertAccess(user: CurrentUser, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true },
    });
    if (!channel || channel.tenantId !== user.tenantId) {
      throw new NotFoundException('Canal não encontrado');
    }

    if (channel.type === 'group' || channel.type === 'record') {
      // Grupo e thread de registro: acesso = canRead da tabela dona.
      const entity = channel.entityId
        ? await this.prisma.entity.findUnique({
            where: { id: channel.entityId },
            select: { slug: true },
          })
        : null;
      if (!entity || !this.canReadEntity(user, entity.slug)) {
        throw new ForbiddenException('Sem acesso a este canal');
      }
      // Thread de registro: além de canRead da tabela, o usuário precisa ENXERGAR
      // o registro (scope + dataFilters). Sem isso, um cargo restrito (ex.: Inspetor)
      // veria o chat de um registro fora do seu filtro. findOne aplica o filtro.
      if (channel.type === 'record' && channel.recordId) {
        const rec = await this.dataService
          .findOne(entity.slug, channel.recordId, user)
          .catch(() => null);
        if (!rec) throw new ForbiddenException('Sem acesso a este registro');
      }
    } else {
      // dm
      const isMember = channel.members.some((m) => m.userId === user.id);
      if (!isMember) throw new ForbiddenException('Sem acesso a este canal');
    }
    return channel;
  }

  async getMessages(user: CurrentUser, channelId: string, limit = 50) {
    await this.assertAccess(user, channelId);
    const messages = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return messages.reverse(); // ordem cronológica
  }

  async postMessage(user: CurrentUser, channelId: string, content: string) {
    await this.assertAccess(user, channelId);
    const text = (content || '').trim();
    if (!text) throw new ForbiddenException('Mensagem vazia');
    return this.prisma.message.create({
      data: {
        tenantId: user.tenantId,
        channelId,
        senderId: user.id,
        type: 'text',
        content: text,
      },
    });
  }

  // ── Trilho A: comandos-formulário ──────────────────────────────────────────

  /** Lista comandos disponíveis (filtra pelo que o usuário pode executar). */
  async listCommands(
    user: CurrentUser,
    opts: { channelId?: string; entitySlug?: string } = {},
  ) {
    let attachedIds: string[] | null = null;
    let fallbackEntitySlug = opts.entitySlug;

    // Canal informado: se tem comandos ANEXADOS, mostra só esses. Senão, fallback:
    // grupo → comandos da tabela; thread → todos.
    if (opts.channelId) {
      const channel = await this.prisma.channel.findFirst({
        where: { id: opts.channelId, tenantId: user.tenantId },
        select: { entityId: true, type: true },
      });
      const links = await this.prisma.channelCommand.findMany({
        where: { channelId: opts.channelId },
        select: { commandTemplateId: true },
      });
      if (links.length > 0) {
        attachedIds = links.map((l) => l.commandTemplateId);
      } else if (channel?.type === 'group' && channel.entityId) {
        const ent = await this.prisma.entity.findUnique({
          where: { id: channel.entityId },
          select: { slug: true },
        });
        fallbackEntitySlug = ent?.slug ?? undefined;
      }
    }

    // Visibilidade por cargo: allowlist vazia = todos; senão só cargos listados.
    // Quem gerencia o chat vê todos (para gerir/anexar). canCreate segue como piso.
    const seesAll = this.canManageChat(user);
    const roleId = user.customRoleId || '';
    const templates = await this.prisma.commandTemplate.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...(attachedIds
          ? { id: { in: attachedIds } }
          : fallbackEntitySlug
            ? { targetEntitySlug: fallbackEntitySlug }
            : {}),
        ...(seesAll
          ? {}
          : {
              OR: [
                { visibleToRoleIds: { isEmpty: true } },
                { visibleToRoleIds: { has: roleId } },
              ],
            }),
      },
      orderBy: { slug: 'asc' },
    });
    return templates.filter((t) => {
      if (!t.targetEntitySlug) return true;
      if (t.actionType === 'create_record') return this.canEntity(user, t.targetEntitySlug, 'canCreate');
      if (t.actionType === 'update_record') return this.canEntity(user, t.targetEntitySlug, 'canUpdate');
      if (t.actionType === 'query') return this.canReadEntity(user, t.targetEntitySlug);
      return true;
    });
  }

  /** Autocomplete de registros (pai): reusa findAll → canRead + filtros/scope. */
  async searchRecords(
    user: CurrentUser,
    entitySlug: string,
    q: string,
    limit = 8,
    scopeParentId?: string,
  ) {
    // findAll já força canRead + scope + dataFilters do cargo → a busca SÓ retorna
    // o que o usuário pode ver. scopeParentId restringe aos filhos de um registro
    // (ex.: no chat de uma operação, só os veículos DAQUELA operação). Sem ele,
    // includeChildren:'true' evita o filtro parentRecordId=null (sub-entidades).
    const query: Record<string, unknown> = scopeParentId
      ? { search: q, limit, parentRecordId: scopeParentId }
      : { search: q, limit, includeChildren: 'true' };
    const res = (await this.dataService.findAll(
      entitySlug,
      query as unknown as Record<string, unknown>,
      user,
    )) as unknown as { data?: Array<{ id: string; data: Record<string, unknown> }> };
    return (res.data || []).map((r) => ({ id: r.id, data: r.data }));
  }

  /** Valores distintos já usados num campo (autocomplete de texto). */
  async fieldSuggestions(user: CurrentUser, entitySlug: string, field: string, q: string, limit = 8) {
    if (!this.canReadEntity(user, entitySlug)) {
      throw new ForbiddenException('Sem acesso a esta tabela');
    }
    const entity = await this.prisma.entity.findFirst({
      where: { tenantId: user.tenantId, slug: entitySlug, deletedAt: null },
      select: { id: true },
    });
    if (!entity) return [];
    const rows = (await this.prisma.$queryRaw`
      SELECT DISTINCT data->>${field} AS v
      FROM "EntityData"
      WHERE "tenantId" = ${user.tenantId} AND "entityId" = ${entity.id} AND "deletedAt" IS NULL
        AND data->>${field} ILIKE ${'%' + q + '%'}
      LIMIT ${limit}`) as Array<{ v: string | null }>;
    return rows.map((r) => r.v).filter((v): v is string => !!v);
  }

  /** Executa um comando-formulário: cria o registro (as_user) e posta o card.
   *  Suporta hierarquia: `parentRecordId` (ligar ao pai) ou `parent` (criar pai novo). */
  async executeCommand(
    user: CurrentUser,
    channelId: string,
    slug: string,
    input: {
      values: Record<string, unknown>;
      recordId?: string;
      parentRecordId?: string;
      parent?: { entitySlug: string; values: Record<string, unknown> };
      parentUpdate?: Record<string, unknown>;
    },
  ) {
    await this.assertAccess(user, channelId);
    const tpl = await this.prisma.commandTemplate.findUnique({
      where: { tenantId_slug: { tenantId: user.tenantId, slug } },
    });
    if (!tpl || !tpl.isActive) throw new NotFoundException('Comando não encontrado');
    if (!tpl.targetEntitySlug) throw new ForbiddenException('Comando sem tabela alvo');
    // update_record: edita um registro existente (form pré-preenchido). Ver executeUpdateRecord.
    if (tpl.actionType === 'update_record') {
      return this.executeUpdateRecord(user, channelId, tpl, input);
    }
    if (tpl.actionType !== 'create_record') {
      throw new ForbiddenException(`actionType não suportado no formulário: ${tpl.actionType}`);
    }

    const values = input.values || {};
    const cfg = (tpl.actionConfig || {}) as { parentEntitySlug?: string };
    const parentUpdate = input.parentUpdate || {};

    // Pai NOVO: cria primeiro (precisa do id pro filho), já com as fotos do veículo.
    let parentRecordId = input.parentRecordId;
    if (input.parent?.entitySlug) {
      const parentRec = (await this.dataService.create(
        input.parent.entitySlug,
        { data: { ...(input.parent.values || {}), ...parentUpdate } },
        user,
      )) as { id?: string };
      parentRecordId = parentRec?.id;
    }

    // Cria a avaria PRIMEIRO (canCreate + pipeline). Se falhar (validação), o pai
    // existente não é tocado — evita estado parcial.
    const record = (await this.dataService.create(
      tpl.targetEntitySlug,
      { data: values as Record<string, unknown>, parentRecordId },
      user,
    )) as { id?: string };

    // Pai EXISTENTE: só depois do filho ok, atualiza os campos (ex.: fotos) — checa canUpdate.
    if (!input.parent?.entitySlug && parentRecordId && cfg.parentEntitySlug && Object.keys(parentUpdate).length > 0) {
      await this.dataService.update(cfg.parentEntitySlug, parentRecordId, { data: parentUpdate }, user);
    }

    const summary = Object.entries(values)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    const message = await this.prisma.message.create({
      data: {
        tenantId: user.tenantId,
        channelId,
        senderId: user.id,
        type: 'form_submission',
        content: `/${tpl.slug} — ${summary}`,
        meta: {
          templateSlug: tpl.slug,
          entitySlug: tpl.targetEntitySlug,
          values: values as object,
          recordId: record?.id,
          parentRecordId: parentRecordId ?? null,
        },
      },
    });
    return { message, recordId: record?.id, parentRecordId: parentRecordId ?? null };
  }

  /** update_record: edita um registro EXISTENTE (form pré-preenchido). O usuário
   *  seleciona o registro (front busca+enxerga) e envia os valores editados. */
  private async executeUpdateRecord(
    user: CurrentUser,
    channelId: string,
    tpl: { slug: string; targetEntitySlug: string | null },
    input: { recordId?: string; values: Record<string, unknown> },
  ) {
    if (!input.recordId) throw new BadRequestException('Selecione o registro a editar.');
    const entitySlug = tpl.targetEntitySlug as string;
    // Confirma que o usuário ENXERGA o registro (canRead + scope) antes de editar.
    const before = await this.dataService.findOne(entitySlug, input.recordId, user).catch(() => null);
    if (!before) throw new NotFoundException('Registro não encontrado ou sem acesso');
    // update faz merge dos campos; checa canUpdate + pipeline.
    await this.dataService.update(
      entitySlug,
      input.recordId,
      { data: (input.values || {}) as Record<string, unknown> },
      user,
    );
    const summary = Object.entries(input.values || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    const message = await this.prisma.message.create({
      data: {
        tenantId: user.tenantId,
        channelId,
        senderId: user.id,
        type: 'form_submission',
        content: `/${tpl.slug} — ${summary}`,
        meta: {
          templateSlug: tpl.slug,
          entitySlug,
          values: (input.values || {}) as object,
          recordId: input.recordId,
          edited: true,
        },
      },
    });
    return { message, recordId: input.recordId };
  }

  // ── query/report: consulta com filtros → card no chat OU relatório (xlsx/json/pdf) ──

  private formatCell(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    if (Array.isArray(v)) return v.map((x) => this.formatCell(x)).join(', ');
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      // Select/relation guardam { label, value } — mostra o label legível.
      if ('label' in o || 'value' in o) return String(o.label ?? o.value ?? '');
      return JSON.stringify(v);
    }
    return String(v);
  }

  /** Executa um comando de consulta/relatório: findAll com filtros (respeita
   *  permissões/scope) → card no chat (JSON de linhas) OU arquivo (xlsx/json/pdf,
   *  base64 pro front baixar). Ver actionType='query'. */
  async runQuery(
    user: CurrentUser,
    channelId: string,
    slug: string,
    input: { filters?: ReportFilter[]; format: 'card' | 'json' | 'xlsx' | 'pdf'; limit?: number },
  ) {
    await this.assertAccess(user, channelId);
    const tpl = await this.prisma.commandTemplate.findUnique({
      where: { tenantId_slug: { tenantId: user.tenantId, slug } },
    });
    if (!tpl || !tpl.isActive) throw new NotFoundException('Comando não encontrado');
    if (tpl.actionType !== 'query') throw new ForbiddenException('Este comando não é de consulta.');
    const entitySlug = tpl.targetEntitySlug;
    if (!entitySlug) throw new ForbiddenException('Comando sem tabela alvo');
    if (!this.canReadEntity(user, entitySlug)) throw new ForbiddenException('Sem acesso a esta tabela');

    const cfg = (tpl.actionConfig || {}) as { columns?: string[]; formats?: string[]; pdfTemplateId?: string };
    const format = input.format || 'card';
    if (Array.isArray(cfg.formats) && cfg.formats.length > 0 && !cfg.formats.includes(format)) {
      throw new ForbiddenException(`Formato ${format} não habilitado neste comando.`);
    }

    const entity = await this.prisma.entity.findFirst({
      where: { tenantId: user.tenantId, slug: entitySlug, deletedAt: null },
      select: { name: true, fields: true },
    });
    const fieldDefs = ((entity?.fields || []) as Array<{ slug: string; label?: string; name?: string; type?: string }>)
      .filter((f) => !['image', 'sub-entity', 'file'].includes(f.type || ''));
    const chosen = cfg.columns?.length ? cfg.columns : fieldDefs.map((f) => f.slug);
    const cols: ReportColumn[] = chosen.map((s) => ({
      slug: s,
      label: fieldDefs.find((f) => f.slug === s)?.label || fieldDefs.find((f) => f.slug === s)?.name || s,
    }));

    const filters = (input.filters || []).filter((f) => f && f.fieldSlug && f.operator);
    const isFile = format !== 'card';
    const query: Record<string, unknown> = {
      ...(filters.length ? { filters: JSON.stringify(filters) } : {}),
      includeChildren: 'true',
      // Arquivo: teto de 5000 linhas por relatório (_skipMaxLimit ignora o cap de página).
      ...(isFile ? { limit: 5000, _skipMaxLimit: true } : { limit: Math.min(input.limit || 20, 50) }),
    };
    const res = (await this.dataService.findAll(
      entitySlug,
      query as unknown as Record<string, unknown>,
      user,
    )) as unknown as {
      data?: Array<{ id: string; data: Record<string, unknown> }>;
      meta?: { total?: number };
      total?: number;
    };
    const data = res.data || [];
    const total = res.meta?.total ?? res.total ?? data.length;
    const tableRows = data.map((r) => cols.map((c) => this.formatCell(r.data?.[c.slug])));

    if (format === 'card') {
      const message = await this.prisma.message.create({
        data: {
          tenantId: user.tenantId, channelId, senderId: user.id, type: 'query_result',
          content: `/${tpl.slug} — ${total} resultado(s)`,
          meta: {
            templateSlug: tpl.slug, entitySlug, total,
            columns: cols as object, rows: tableRows.slice(0, 20) as object,
          } as Prisma.InputJsonValue,
        },
      });
      return { message, columns: cols, rows: tableRows.slice(0, 20), total };
    }

    const title = entity?.name || entitySlug;
    let buffer: Buffer;
    let contentType: string;
    let ext: string;
    if (format === 'json') {
      buffer = Buffer.from(JSON.stringify(data.map((r) => ({ id: r.id, ...r.data })), null, 2));
      contentType = 'application/json'; ext = 'json';
    } else if (format === 'xlsx') {
      buffer = await this.generateXlsx(title, cols, tableRows);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; ext = 'xlsx';
    } else {
      // PDF: se o comando aponta um Template PDF desenhado, gera em lote (1 doc por
      // registro, mesclado) com esse template; senão, cai na tabela simples.
      if (cfg.pdfTemplateId) {
        const ids = data.map((r) => r.id).slice(0, 300); // teto p/ template
        const gen = await this.pdfGenerator.generateBatch(cfg.pdfTemplateId, ids, user, true, user.tenantId);
        buffer = gen.buffer;
      } else {
        buffer = await this.generateTablePdf(title, `${total} registro(s)`, cols, tableRows);
      }
      contentType = 'application/pdf'; ext = 'pdf';
    }
    const filename = `${tpl.slug}-${total}.${ext}`;
    const message = await this.prisma.message.create({
      data: {
        tenantId: user.tenantId, channelId, senderId: user.id, type: 'report',
        content: `Relatório /${tpl.slug} — ${format.toUpperCase()} (${total} registro(s))`,
        meta: { templateSlug: tpl.slug, entitySlug, total, format, filename } as Prisma.InputJsonValue,
      },
    });
    return { message, total, file: { base64: buffer.toString('base64'), contentType, filename } };
  }

  private async generateXlsx(title: string, cols: ReportColumn[], rows: string[][]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet((title || 'Relatório').slice(0, 30));
    ws.addRow(cols.map((c) => c.label));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => { col.width = 22; });
    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private async generateTablePdf(
    title: string, subtitle: string, cols: ReportColumn[], rows: string[][],
  ): Promise<Buffer> {
    // Gerador tabular limpo (pdfkit-table), independente dos templates desenhados.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit-table');
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(title);
    if (subtitle) doc.moveDown(0.15).font('Helvetica').fontSize(9).fillColor('#6b7280').text(subtitle);
    doc.moveDown(0.6);
    await doc.table(
      { headers: cols.map((c) => c.label), rows },
      {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827'),
        prepareRow: () => doc.font('Helvetica').fontSize(8).fillColor('#374151'),
      },
    );
    doc.end();
    return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  }

  // ── Fatia 3: bot read-only (toolbelt fechado, as_user) ─────────────────────

  /** Pergunta ao bot. O provider decide a ferramenta; a execução roda COM as
   *  permissões do usuário (as_user) — read-only nesta fatia. Posta a pergunta
   *  e a resposta no canal. */
  async askBot(user: CurrentUser, channelId: string, rawMessage: string) {
    const channel = await this.assertAccess(user, channelId);
    const message = rawMessage.replace(/^@bot\s*/i, '').trim();

    // Posta a pergunta do usuário (transparência no feed).
    await this.prisma.message.create({
      data: { tenantId: user.tenantId, channelId, senderId: user.id, type: 'command', content: rawMessage },
    });

    const channelEntity = channel.entityId
      ? await this.prisma.entity.findUnique({ where: { id: channel.entityId }, select: { slug: true } })
      : null;

    let reply: string;
    let tool: string | null = null;
    let pendingAction: Record<string, unknown> | null = null;

    // Confirmação de uma ação elevada pendente ("sim").
    if (/^(sim|confirmar|confirmo|confirma|pode|ok)\b/i.test(message)) {
      reply = await this.confirmPending(user, channelId);
    } else {
      const decision = await this.bot.decide({
        message,
        tools: BOT_TOOLS,
        context: { channelEntitySlug: channelEntity?.slug ?? null },
      });
      if ('abstain' in decision) {
        reply = decision.reason;
      } else {
        tool = decision.tool;
        // É um comando elevado (as_bot) cadastrado? (ex.: reabrir_veiculo)
        const tpl = await this.prisma.commandTemplate.findFirst({
          where: { tenantId: user.tenantId, slug: decision.tool, execMode: 'as_bot', isActive: true },
        });
        if (tpl) {
          const res = await this.handleElevated(user, tpl, decision.args);
          reply = res.reply;
          pendingAction = res.pendingAction ?? null;
        } else {
          reply = await this.runBotTool(user, decision.tool, decision.args, channelEntity?.slug ?? null);
        }
      }
    }

    const botMsg = await this.prisma.message.create({
      data: {
        tenantId: user.tenantId,
        channelId,
        senderId: null, // bot
        type: 'bot',
        content: reply,
        meta: {
          requestedById: user.id,
          request: rawMessage,
          ...(tool ? { tool } : {}),
          ...(pendingAction ? { pendingAction } : {}),
        } as Prisma.InputJsonValue,
      },
    });
    return { reply: botMsg };
  }

  /** CurrentUser sintético do bot (teto). Permissões são carregadas por userId no DB. */
  private async getBotUser(tenantId: string): Promise<CurrentUser | null> {
    const bot = await this.prisma.botIdentity.findUnique({ where: { tenantId } });
    if (!bot || !bot.isActive) return null;
    const role = await this.prisma.customRole.findUnique({
      where: { id: bot.customRoleId },
      select: { id: true, modulePermissions: true, permissions: true },
    });
    return { id: bot.userId, tenantId, customRoleId: bot.customRoleId, customRole: role } as unknown as CurrentUser;
  }

  /** Avalia uma ação elevada: checa quem pode pedir + teto; confirma ou executa. */
  private async handleElevated(
    user: CurrentUser,
    tpl: { slug: string; targetEntitySlug: string | null; actionConfig: unknown; elevation: unknown },
    args: Record<string, unknown>,
  ): Promise<{ reply: string; pendingAction?: Record<string, unknown> }> {
    const elev = (tpl.elevation || {}) as { requesterRoles?: string[]; requireConfirmation?: boolean };
    if (elev.requesterRoles?.length && !elev.requesterRoles.includes(user.customRoleId || '')) {
      return { reply: 'Você não tem permissão para pedir esta ação.' };
    }
    const botUser = await this.getBotUser(user.tenantId);
    if (!botUser) return { reply: 'O bot não está configurado neste tenant.' };

    const cfg = (tpl.actionConfig || {}) as { field: string; value: unknown; searchField?: string };
    const chassi = (args.chassi as string) || '';
    if (!chassi) return { reply: 'Qual veículo? Informe o chassi.' };

    // Resolve o registro buscando COMO O BOT (teto vê tudo).
    const found = (await this.dataService.findAll(
      tpl.targetEntitySlug as string,
      { search: chassi, includeChildren: 'true', limit: 1 } as unknown as Record<string, unknown>,
      botUser,
    )) as unknown as { data?: Array<{ id: string; data: Record<string, unknown> }> };
    const rec = found.data?.[0];
    if (!rec) return { reply: `Veículo "${chassi}" não encontrado.` };

    const label = String(rec.data?.[cfg.searchField || 'chassi'] ?? rec.id);
    const pending = {
      slug: tpl.slug, entitySlug: tpl.targetEntitySlug, recordId: rec.id,
      field: cfg.field, value: cfg.value, requestedById: user.id, label, done: false,
    };
    if (elev.requireConfirmation) {
      return {
        reply: `Confirmar reabrir o veículo "${label}" (${cfg.field}: ${rec.data?.[cfg.field]} → ${cfg.value})? Responda "sim".`,
        pendingAction: pending,
      };
    }
    return { reply: await this.executeElevated(user, pending) };
  }

  /** Acha a ação pendente mais recente no canal e executa (só quem pediu confirma). */
  private async confirmPending(user: CurrentUser, channelId: string): Promise<string> {
    const recent = await this.prisma.message.findMany({
      where: { channelId, type: 'bot' }, orderBy: { createdAt: 'desc' }, take: 10,
    });
    const msg = recent.find((m) => {
      const p = (m.meta as { pendingAction?: { done?: boolean } } | null)?.pendingAction;
      return p && !p.done;
    });
    if (!msg) return 'Não há ação pendente para confirmar.';
    const pending = (msg.meta as { pendingAction: Record<string, unknown> }).pendingAction;
    if (pending.requestedById !== user.id) return 'Apenas quem pediu pode confirmar esta ação.';
    const result = await this.executeElevated(user, pending);
    await this.prisma.message.update({
      where: { id: msg.id },
      data: { meta: { ...(msg.meta as object), pendingAction: { ...pending, done: true } } },
    });
    return result;
  }

  /** Executa a ação COMO O BOT (teto): update grava updatedById=bot + audit com requestedById. */
  private async executeElevated(user: CurrentUser, pending: Record<string, unknown>): Promise<string> {
    const botUser = await this.getBotUser(user.tenantId);
    if (!botUser) return 'O bot não está configurado neste tenant.';
    const entitySlug = pending.entitySlug as string;
    const recordId = pending.recordId as string;
    const field = pending.field as string;
    const value = pending.value;

    const before = await this.prisma.entityData.findUnique({ where: { id: recordId }, select: { data: true } });
    const beforeVal = (before?.data as Record<string, unknown> | null)?.[field];

    // update faz merge; grava updatedById = bot; checa o teto do bot (canUpdate).
    await this.dataService.update(
      entitySlug, recordId,
      { data: { [field]: value } } as unknown as { data: Record<string, unknown> },
      botUser,
    );

    await this.auditService.log(botUser, {
      action: 'update',
      resource: 'entity_data',
      resourceId: recordId,
      oldData: { [field]: beforeVal },
      newData: { [field]: value },
      metadata: { performedByBot: true, requestedById: user.id, command: pending.slug },
    });

    return `Pronto ✅ Reabri o veículo "${pending.label as string}": ${field} ${String(beforeVal)} → ${String(value)}.\n(feito pelo bot, a pedido de você — registrado no histórico)`;
  }

  /** Executores das ferramentas read-only. Tudo via DataService (canRead + filtros). */
  private async runBotTool(
    user: CurrentUser,
    tool: string,
    args: Record<string, unknown>,
    defaultEntitySlug: string | null,
  ): Promise<string> {
    const entitySlug = (args.entitySlug as string) || defaultEntitySlug || '';
    if (!entitySlug) return 'De qual tabela? (veículos, avarias, operações)';
    if (!this.canReadEntity(user, entitySlug)) return `Você não tem acesso à tabela "${entitySlug}".`;

    const entity = await this.prisma.entity.findFirst({
      where: { tenantId: user.tenantId, slug: entitySlug, deletedAt: null },
      select: { name: true, fields: true },
    });
    const label = entity?.name || entitySlug; // nome limpo (evita namePlural auto-gerada)

    const runFind = async (extra: Record<string, unknown>) =>
      (await this.dataService.findAll(
        entitySlug,
        { includeChildren: 'true', ...extra } as unknown as Record<string, unknown>,
        user,
      )) as unknown as { data?: Array<{ data: Record<string, unknown> }>; meta?: { total?: number }; total?: number };

    if (tool === 'contar_registros') {
      const res = await runFind({ limit: 1 });
      const total = res.meta?.total ?? res.total ?? (res.data?.length || 0);
      return `Você pode ver ${total} registro(s) em "${label}".`;
    }

    if (tool === 'listar_registros') {
      const res = await runFind({ limit: 5, search: (args.q as string) || '' });
      const rows = res.data || [];
      if (rows.length === 0) return `Nenhum registro em ${label.toLowerCase()}.`;
      const fields = (entity?.fields as Array<{ slug: string; type: string }>) || [];
      const keyField = fields.find((f) => ['text', 'select'].includes(f.type))?.slug;
      const items = rows
        .map((r) => '• ' + (keyField ? String(r.data?.[keyField] ?? '—') : Object.values(r.data || {})[0] ?? '—'))
        .join('\n');
      const total = res.meta?.total ?? res.total ?? rows.length;
      return `${label} (${total}):\n${items}`;
    }

    return 'Ferramenta não suportada.';
  }

  // ── Fatia 5: builder de comandos (admin gerencia pela UI) ──────────────────

  /** Quem pode gerenciar comandos: platform, ou quem edita estrutura/permissões. */
  private assertCanManageCommands(user: CurrentUser): void {
    if (
      hasPlatformAccess(user.customRole?.modulePermissions) ||
      hasFullTenantAccess(user.customRole?.modulePermissions)
    ) {
      return;
    }
    const mp = user.customRole?.modulePermissions as
      | Record<string, Record<string, boolean>>
      | undefined;
    if (mp?.entities?.canUpdate === true || mp?.roles?.canManagePermissions === true) return;
    throw new ForbiddenException('Sem permissão para gerenciar comandos.');
  }

  async listManageCommands(user: CurrentUser) {
    this.assertCanManageCommands(user);
    return this.prisma.commandTemplate.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { slug: 'asc' },
    });
  }

  async createCommand(user: CurrentUser, dto: Record<string, unknown>) {
    this.assertCanManageCommands(user);
    const slug = String(dto.slug || '').replace(/^\//, '').trim();
    if (!slug) throw new BadRequestException('Informe o nome do comando (slug).');
    const exists = await this.prisma.commandTemplate.findUnique({
      where: { tenantId_slug: { tenantId: user.tenantId, slug } },
    });
    if (exists) throw new ConflictException('Já existe um comando com esse nome.');
    return this.prisma.commandTemplate.create({
      data: {
        tenantId: user.tenantId,
        slug,
        description: (dto.description as string) || null,
        targetEntitySlug: (dto.targetEntitySlug as string) || null,
        actionType: (dto.actionType as string) || 'create_record',
        actionConfig: (dto.actionConfig as object) || {},
        execMode: (dto.execMode as string) || 'as_user',
        elevation: (dto.elevation as object) ?? undefined,
        visibleToRoleIds: Array.isArray(dto.visibleToRoleIds)
          ? (dto.visibleToRoleIds as string[])
          : [],
        isActive: dto.isActive === undefined ? true : !!dto.isActive,
      },
    });
  }

  async updateCommand(user: CurrentUser, id: string, dto: Record<string, unknown>) {
    this.assertCanManageCommands(user);
    const cmd = await this.prisma.commandTemplate.findUnique({ where: { id } });
    if (!cmd || cmd.tenantId !== user.tenantId) {
      throw new NotFoundException('Comando não encontrado');
    }
    const data: Record<string, unknown> = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.targetEntitySlug !== undefined) data.targetEntitySlug = dto.targetEntitySlug;
    if (dto.actionType !== undefined) data.actionType = dto.actionType;
    if (dto.actionConfig !== undefined) data.actionConfig = dto.actionConfig;
    if (dto.execMode !== undefined) data.execMode = dto.execMode;
    if (dto.elevation !== undefined) data.elevation = dto.elevation;
    if (dto.visibleToRoleIds !== undefined) {
      data.visibleToRoleIds = Array.isArray(dto.visibleToRoleIds) ? dto.visibleToRoleIds : [];
    }
    if (dto.isActive !== undefined) data.isActive = !!dto.isActive;
    return this.prisma.commandTemplate.update({ where: { id }, data });
  }

  async deleteCommand(user: CurrentUser, id: string) {
    this.assertCanManageCommands(user);
    const cmd = await this.prisma.commandTemplate.findUnique({ where: { id } });
    if (!cmd || cmd.tenantId !== user.tenantId) {
      throw new NotFoundException('Comando não encontrado');
    }
    await this.prisma.commandTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
