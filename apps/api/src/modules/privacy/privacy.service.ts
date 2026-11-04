import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Prisma, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { hasFullTenantAccess } from '../../common/utils/platform-access';
import { buildZip, toCsv, ZipEntry } from '../../common/utils/zip';
import { verifyTotp } from '../../common/utils/totp';
import { open } from '../../common/utils/secret-box';
import { recordLifecycleEvent } from '../../common/utils/tenant-lifecycle-events';
import { closureOf, TenantClosure } from '../../common/utils/tenant-closure';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { UploadService } from '../upload/upload.service';
import { AuthService } from '../auth/auth.service';

const DAY = 86_400_000;
const EXPORT_COOLDOWN_MS = 2 * 60 * 1000;
const BATCH = 5000;
const AUDIT_EXPORT_LIMIT = 50_000;

/** Modelos com tenantId SEM chave estrangeira: a exclusao definitiva limpa na mao. */
const MODELS_WITHOUT_FK = [
  'auditLog', 'archivedAuditLog', 'webhookExecution', 'actionChainExecution', 'scheduledTaskExecution',
  'apiExecutionLog', 'message', 'channelCommand', 'channel', 'commandTemplate', 'botIdentity', 'visibilityRecompute',
] as const;

const slugSafe = (s: string) => s.replace(/[^a-z0-9-_]/gi, '_');

/**
 * LGPD: exportar todos os dados da empresa, encerrar a conta (com prazo para
 * desistir e exclusao definitiva depois) e os direitos da propria pessoa
 * (baixar os proprios dados, excluir a propria conta).
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);
  private readonly lastExport = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly upload: UploadService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private graceDays(): number {
    return Math.max(1, parseInt(this.config.get<string>('ACCOUNT_CLOSURE_GRACE_DAYS') || '30', 10));
  }

  private async isOwner(user: CurrentUser): Promise<boolean> {
    const t = await this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { ownerId: true } });
    return t?.ownerId === user.id;
  }

  /** Dono ou acesso total da empresa (nunca alguem "entrando como" pelo console). */
  private async assertCanExport(user: CurrentUser) {
    if (user.impersonatedBy) throw new ForbiddenException('Nao disponivel ao entrar como outra pessoa');
    if (hasFullTenantAccess(user.customRole?.modulePermissions) || (await this.isOwner(user))) return;
    throw new ForbiddenException('Somente o dono ou quem tem acesso total pode exportar todos os dados da empresa');
  }

  /** Confere senha (e o codigo de duas etapas, se ligado) antes de acao sem volta. */
  private async assertIdentity(userId: string, password: string, code?: string) {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true, mfaSecret: true, mfaEnabledAt: true, mfaRecoveryCodes: true },
    });
    if (!(await bcrypt.compare(password ?? '', row.password))) throw new UnauthorizedException('Senha incorreta');
    if (row.mfaEnabledAt && row.mfaSecret) {
      const hashed = createHash('sha256').update((code ?? '').toLowerCase().replace(/\s/g, '')).digest('hex');
      if (!code || !(verifyTotp(open(row.mfaSecret), code) || row.mfaRecoveryCodes.includes(hashed))) {
        throw new UnauthorizedException({ code: 'MFA_CODE_REQUIRED', message: 'Informe o codigo de verificacao em duas etapas' });
      }
    }
  }

  // ── Exportar tudo da empresa ────────────────────────────────────────────

  async exportCompany(user: CurrentUser): Promise<{ filename: string; zip: Buffer }> {
    await this.assertCanExport(user);
    const last = this.lastExport.get(user.tenantId) ?? 0;
    if (Date.now() - last < EXPORT_COOLDOWN_MS) {
      throw new HttpException('Uma exportacao acabou de ser gerada. Aguarde alguns minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.lastExport.set(user.tenantId, Date.now());

    const tenantId = user.tenantId;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true, name: true, slug: true, domain: true, logo: true, settings: true, lifecycle: true,
        createdAt: true, ownerId: true, plan: { select: { name: true } },
      },
    });
    const entries: ZipEntry[] = [];
    const json = (name: string, data: unknown) => entries.push({ name, data: JSON.stringify(data, null, 2) });

    // Pessoas (sem senha nem segredos) — usadas tambem para trocar ids por e-mail.
    const members = await this.prisma.userTenantAccess.findMany({
      where: { tenantId, user: { isServiceAccount: false } },
      select: {
        status: true, createdAt: true, deletedAt: true,
        customRole: { select: { name: true } },
        user: { select: { id: true, name: true, email: true, phone: true, lastLoginAt: true, createdAt: true, mfaEnabledAt: true } },
      },
    });
    const emailOf = new Map(members.map((m) => [m.user.id, m.user.email]));
    const people = members.map((m) => ({
      nome: m.user.name, email: m.user.email, telefone: m.user.phone, cargo: m.customRole.name,
      situacao: m.deletedAt ? 'REMOVIDO' : m.status, dono: m.user.id === tenant.ownerId,
      duasEtapas: !!m.user.mfaEnabledAt, ultimoAcesso: m.user.lastLoginAt, entrouEm: m.createdAt,
    }));
    json('pessoas.json', people);
    entries.push({ name: 'pessoas.csv', data: toCsv(people, Object.keys(people[0] ?? { nome: 1 })) });

    // Estrutura e registros, tabela por tabela (ativos, arquivados e os da lixeira).
    const entities = await this.prisma.entity.findMany({
      where: { tenantId },
      select: { id: true, name: true, namePlural: true, slug: true, description: true, icon: true, color: true, fields: true, settings: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    json('estrutura/tabelas.json', entities);
    const counts: Record<string, number> = {};
    for (const entity of entities) {
      const fields = (Array.isArray(entity.fields) ? entity.fields : []) as Array<{ slug?: string }>;
      const fieldSlugs = fields.map((f) => f.slug).filter((s): s is string => !!s);
      const rows: Array<Record<string, unknown>> = [];
      const push = (r: { id: string; parentRecordId: string | null; data: Prisma.JsonValue; createdAt: Date; updatedAt: Date; createdById: string | null }, extra: Record<string, unknown>) => {
        rows.push({
          id: r.id, registroPai: r.parentRecordId, ...(r.data as Record<string, unknown>),
          criadoEm: r.createdAt, atualizadoEm: r.updatedAt, criadoPor: r.createdById ? emailOf.get(r.createdById) ?? r.createdById : null, ...extra,
        });
      };
      for (let cursor: string | undefined; ;) {
        const batch = await this.prisma.entityData.findMany({
          where: { tenantId, entityId: entity.id }, orderBy: { id: 'asc' }, take: BATCH,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: { id: true, parentRecordId: true, data: true, createdAt: true, updatedAt: true, createdById: true, deletedAt: true },
        });
        for (const r of batch) push(r, { arquivado: false, naLixeiraDesde: r.deletedAt });
        if (batch.length < BATCH) break;
        cursor = batch[batch.length - 1].id;
      }
      for (let cursor: string | undefined; ;) {
        const batch = await this.prisma.archivedEntityData.findMany({
          where: { tenantId, entityId: entity.id }, orderBy: { id: 'asc' }, take: BATCH,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: { id: true, parentRecordId: true, data: true, createdAt: true, updatedAt: true, createdById: true },
        });
        for (const r of batch) push(r, { arquivado: true, naLixeiraDesde: null });
        if (batch.length < BATCH) break;
        cursor = batch[batch.length - 1].id;
      }
      counts[entity.slug] = rows.length;
      const base = `tabelas/${slugSafe(entity.slug)}`;
      json(`${base}.json`, rows);
      entries.push({
        name: `${base}.csv`,
        data: toCsv(rows, ['id', 'registroPai', ...fieldSlugs, 'criadoEm', 'atualizadoEm', 'criadoPor', 'arquivado', 'naLixeiraDesde']),
      });
    }

    // Configuracoes (sem segredos).
    const [roles, pdfTemplates, dashboards, automations, webhooks, publicLinks, apiKeys] = await Promise.all([
      this.prisma.customRole.findMany({ where: { tenantId, deletedAt: null }, select: { name: true, description: true, rank: true, permissions: true, modulePermissions: true, isDefault: true } }),
      this.prisma.pdfTemplate.findMany({ where: { tenantId } }),
      this.prisma.dashboardTemplate.findMany({ where: { tenantId } }),
      this.prisma.entityAutomation.findMany({ where: { tenantId } }),
      this.prisma.webhook.findMany({ where: { tenantId }, select: { name: true, url: true, events: true, entityId: true, status: true, createdAt: true } }),
      this.prisma.publicLink.findMany({ where: { tenantId }, select: { name: true, entityId: true, createdAt: true } }),
      this.prisma.apiKey.findMany({ where: { tenantId }, select: { name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true } }),
    ]);
    json('configuracoes/cargos.json', roles);
    json('configuracoes/modelos-pdf.json', pdfTemplates);
    json('configuracoes/dashboards.json', dashboards);
    json('configuracoes/automacoes.json', automations);
    json('configuracoes/webhooks.json', webhooks);
    json('configuracoes/links-publicos.json', publicLinks);
    json('configuracoes/chaves-de-api.json', apiKeys);

    const files = await this.upload.listTenantFiles(tenantId).catch(() => []);
    entries.push({ name: 'arquivos.csv', data: toCsv(files, ['path', 'bytes']) });

    const auditRows = await this.prisma.auditLog.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' }, take: AUDIT_EXPORT_LIMIT,
      select: { createdAt: true, userId: true, action: true, resource: true, resourceId: true, metadata: true, impersonatedByName: true },
    });
    const audit = auditRows.map((a) => ({ ...a, userId: a.userId ? emailOf.get(a.userId) ?? a.userId : null }));
    entries.push({ name: 'auditoria.csv', data: toCsv(audit, ['createdAt', 'userId', 'action', 'resource', 'resourceId', 'impersonatedByName', 'metadata']) });

    json('empresa.json', {
      nome: tenant.name, endereco: tenant.slug, dominio: tenant.domain, logo: tenant.logo, plano: tenant.plan?.name ?? null,
      situacao: tenant.lifecycle, criadaEm: tenant.createdAt, configuracoes: tenant.settings,
      exportadoEm: new Date(), exportadoPor: user.email, registrosPorTabela: counts,
    });
    entries.unshift({
      name: 'LEIA-ME.txt',
      data: [
        `Exportacao completa de ${tenant.name} — ${new Date().toISOString()}`,
        '',
        'empresa.json                 dados da empresa e quantos registros cada tabela tem',
        'pessoas.json / .csv          equipe (sem senhas)',
        'estrutura/tabelas.json       definicao das tabelas e campos',
        'tabelas/<tabela>.json / .csv registros: ativos, arquivados e os que estao na lixeira',
        'configuracoes/               cargos, modelos de PDF, dashboards, automacoes, webhooks, links e chaves (sem segredos)',
        'arquivos.csv                 arquivos enviados (caminho e tamanho)',
        `auditoria.csv                historico de acoes (ultimas ${AUDIT_EXPORT_LIMIT.toLocaleString('pt-BR')})`,
        '',
        'Os CSV usam ";" como separador e UTF-8 (abrem direto no Excel).',
      ].join('\r\n'),
    });

    this.audit.log(user, { action: 'export', resource: 'tenant', resourceId: tenantId, metadata: { files: entries.length, records: counts } }).catch(() => {});
    const day = new Date().toISOString().slice(0, 10);
    return { filename: `${slugSafe(tenant.slug)}-dados-${day}.zip`, zip: buildZip(entries) };
  }

  // ── Encerrar a conta da empresa ─────────────────────────────────────────

  async closureStatus(user: CurrentUser) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true, ownerId: true, settings: true } });
    return {
      tenantName: tenant.name,
      isOwner: tenant.ownerId === user.id,
      canExport: hasFullTenantAccess(user.customRole?.modulePermissions) || tenant.ownerId === user.id,
      graceDays: this.graceDays(),
      closure: closureOf(tenant.settings),
    };
  }

  async requestClosure(user: CurrentUser, dto: { password: string; code?: string; confirmName: string; reason?: string }) {
    if (user.impersonatedBy) throw new ForbiddenException('Nao disponivel ao entrar como outra pessoa');
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { id: true, name: true, ownerId: true, lifecycle: true, settings: true },
    });
    if (tenant.ownerId !== user.id) throw new ForbiddenException('Somente o dono pode encerrar a conta da empresa');
    if (dto.confirmName.trim().toLowerCase() !== tenant.name.trim().toLowerCase()) {
      throw new BadRequestException({ code: 'CONFIRM_NAME', message: 'Digite o nome da empresa exatamente como aparece' });
    }
    await this.assertIdentity(user.id, dto.password, dto.code);

    const now = new Date();
    const deleteAfter = new Date(now.getTime() + this.graceDays() * DAY);
    const closure: TenantClosure = {
      requestedAt: now.toISOString(), requestedById: user.id, requestedByEmail: user.email,
      reason: dto.reason?.trim().slice(0, 1000) || null, deleteAfter: deleteAfter.toISOString(),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          lifecycle: 'CANCELED',
          status: Status.INACTIVE,
          settings: { ...((tenant.settings ?? {}) as Record<string, unknown>), closure } as unknown as Prisma.InputJsonValue,
        },
      });
      await recordLifecycleEvent(tx, { tenantId: tenant.id, from: tenant.lifecycle, to: 'CANCELED', source: 'owner_closure' });
    });
    this.audit.log(user, { action: 'delete', resource: 'tenant', resourceId: tenant.id, metadata: { closure } }).catch(() => {});

    const date = deleteAfter.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const text = [
      `A conta da empresa ${tenant.name} foi encerrada a seu pedido.`,
      `Os dados serao apagados definitivamente em ${date}.`,
      'Se mudar de ideia ate la, responda este e-mail ou fale com o suporte para reativar.',
    ].join('\n\n');
    this.email.send({ to: user.email, subject: `Conta de ${tenant.name} encerrada`, text, html: text.split('\n\n').map((p) => `<p>${p}</p>`).join('') })
      .catch((e) => this.logger.warn(`E-mail de encerramento nao enviado: ${e}`));
    return { closure };
  }

  /** Todo dia: apaga de vez as empresas encerradas pelo dono cujo prazo acabou. */
  @Cron('0 5 * * *', { name: 'tenant-closure-purge', timeZone: 'America/Sao_Paulo' })
  async purgeClosedTenants(): Promise<void> {
    const candidates = await this.prisma.tenant.findMany({
      where: { lifecycle: 'CANCELED', settings: { path: ['closure', 'deleteAfter'], not: Prisma.AnyNull } },
      select: { id: true, slug: true, settings: true },
    });
    for (const t of candidates) {
      const closure = closureOf(t.settings);
      if (!closure || new Date(closure.deleteAfter).getTime() > Date.now()) continue;
      try {
        await this.deleteTenantForever(t.id);
        this.logger.warn(`[encerramento] empresa ${t.slug} (${t.id}) apagada definitivamente (pedido de ${closure.requestedByEmail} em ${closure.requestedAt})`);
      } catch (e) {
        this.logger.error(`[encerramento] falha ao apagar ${t.slug}: ${e instanceof Error ? e.message : e}`, e instanceof Error ? e.stack : undefined);
      }
    }
  }

  /** Exclusao definitiva: arquivos, tabelas sem FK, a empresa (cascata) e quem so existia nela. */
  async deleteTenantForever(tenantId: string): Promise<void> {
    const memberIds = (await this.prisma.userTenantAccess.findMany({ where: { tenantId }, select: { userId: true } })).map((m) => m.userId);
    const elsewhere = new Set(
      (await this.prisma.userTenantAccess.findMany({
        where: { userId: { in: memberIds }, tenantId: { not: tenantId }, deletedAt: null },
        select: { userId: true },
      })).map((m) => m.userId),
    );
    const exclusive = memberIds.filter((id) => !elsewhere.has(id));

    // Banco primeiro (tudo ou nada); arquivos so depois que os dados ja foram apagados.
    await this.prisma.$transaction(async (tx) => {
      for (const model of MODELS_WITHOUT_FK) {
        const delegate = tx[model] as unknown as { deleteMany(args: { where: { tenantId: string } }): Promise<unknown> };
        await delegate.deleteMany({ where: { tenantId } });
      }
      await tx.tenant.delete({ where: { id: tenantId } });
    }, { timeout: 10 * 60 * 1000 });
    await this.upload.deleteTenantFiles(tenantId).catch((e) =>
      this.logger.error(`[encerramento] dados de ${tenantId} apagados, mas os arquivos nao: ${e instanceof Error ? e.message : e}`),
    );

    // Quem so tinha essa empresa: a conta deixa de existir (anonimizada se algo ainda a referencia).
    for (const userId of exclusive) {
      try {
        await this.prisma.user.delete({ where: { id: userId } });
      } catch {
        await this.anonymize(userId);
      }
    }
  }

  // ── Direitos da propria pessoa ──────────────────────────────────────────

  async exportMe(user: CurrentUser) {
    const [me, memberships, sessions, actions] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { name: true, email: true, phone: true, cpf: true, cnpj: true, avatar: true, status: true, createdAt: true, lastLoginAt: true, mfaEnabledAt: true },
      }),
      this.prisma.userTenantAccess.findMany({
        where: { userId: user.id },
        select: { status: true, createdAt: true, deletedAt: true, tenant: { select: { name: true, slug: true, ownerId: true } }, customRole: { select: { name: true } } },
      }),
      this.prisma.userSession.findMany({
        where: { userId: user.id },
        select: { ip: true, userAgent: true, createdAt: true, lastUsedAt: true, revokedAt: true },
        orderBy: { createdAt: 'desc' }, take: 500,
      }),
      this.prisma.auditLog.findMany({
        where: { userId: user.id },
        select: { createdAt: true, action: true, resource: true, resourceId: true, tenantId: true },
        orderBy: { createdAt: 'desc' }, take: 5000,
      }),
    ]);
    this.audit.log(user, { action: 'export', resource: 'user', resourceId: user.id, metadata: { self: true } }).catch(() => {});
    return {
      geradoEm: new Date(),
      conta: { ...me, duasEtapasDesde: me.mfaEnabledAt, mfaEnabledAt: undefined },
      empresas: memberships.map((m) => ({
        empresa: m.tenant.name, endereco: m.tenant.slug, cargo: m.customRole.name, dono: m.tenant.ownerId === user.id,
        situacao: m.deletedAt ? 'REMOVIDO' : m.status, desde: m.createdAt,
      })),
      acessos: sessions,
      acoes: actions,
    };
  }

  async deleteMe(user: CurrentUser, dto: { password: string; code?: string; confirm: string }) {
    if (user.impersonatedBy) throw new ForbiddenException('Nao disponivel ao entrar como outra pessoa');
    if (dto.confirm?.trim().toUpperCase() !== 'EXCLUIR') {
      throw new BadRequestException({ code: 'CONFIRM_WORD', message: 'Digite EXCLUIR para confirmar' });
    }
    const owned = await this.prisma.tenant.findMany({ where: { ownerId: user.id, deletedAt: null, lifecycle: { not: 'CANCELED' } }, select: { name: true } });
    if (owned.length > 0) {
      throw new BadRequestException({
        code: 'OWNS_TENANT',
        message: `Voce e dono de ${owned.map((t) => t.name).join(', ')}. Passe a propriedade para outra pessoa ou encerre a conta da empresa antes.`,
      });
    }
    await this.assertIdentity(user.id, dto.password, dto.code);

    const email = user.email;
    await this.anonymize(user.id);
    this.audit.log(user, { action: 'delete', resource: 'user', resourceId: user.id, metadata: { self: true } }).catch(() => {});
    const text = 'Sua conta foi excluida a seu pedido. Seus dados pessoais foram apagados.';
    this.email.send({ to: email, subject: 'Conta excluida', text, html: `<p>${text}</p>` }).catch(() => {});
    return { success: true };
  }

  /** Apaga os dados pessoais mantendo o id (registros continuam apontando para "Conta excluida"). */
  private async anonymize(userId: string) {
    const ghost = `excluido+${randomBytes(6).toString('hex')}@deleted.invalid`;
    // Derruba os aparelhos na hora (cache de sessao) antes de apagar o historico.
    await this.auth.revokeSessions(userId).catch(() => {});
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          name: 'Conta excluída', email: ghost, password: await bcrypt.hash(randomBytes(24).toString('hex'), 12),
          avatar: null, cpf: null, cnpj: null, phone: null, status: Status.INACTIVE, deletedAt: new Date(),
          mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: [], resetToken: null, resetTokenExpires: null,
        },
      }),
      this.prisma.userTenantAccess.updateMany({ where: { userId }, data: { status: Status.INACTIVE, deletedAt: new Date() } }),
      this.prisma.userSession.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
  }
}
