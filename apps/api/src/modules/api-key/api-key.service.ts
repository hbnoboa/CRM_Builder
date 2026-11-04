import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Status } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { assertAssignableRole } from '../../common/utils/member-governance';
import { AuditService } from '../audit/audit.service';

export const API_KEY_PREFIX = 'crm_';
const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/**
 * Chave de API: integracao externa le/grava registros com o cargo escolhido (sempre
 * abaixo do cargo de quem cria). Cada chave tem um USUARIO TECNICO (isServiceAccount)
 * membro da empresa nesse cargo: toda checagem de permissao do sistema resolve o cargo
 * pelo id do usuario, entao a chave precisa de um usuario proprio — com o id do
 * criador, valeria o cargo dele. Os registros ficam "criados por" esse usuario
 * ("API: <nome>"). Deixa de valer se for revogada, vencer, o criador sair da empresa
 * ou a empresa for suspensa.
 */
@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(currentUser: CurrentUser) {
    return this.prisma.apiKey.findMany({
      where: { tenantId: currentUser.tenantId, revokedAt: null },
      select: {
        id: true, name: true, prefix: true, lastUsedAt: true, expiresAt: true, createdAt: true,
        customRole: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(currentUser: CurrentUser, dto: { name: string; customRoleId: string; expiresInDays?: number | null }) {
    if (currentUser.apiKey) throw new ForbiddenException('Uma chave de API nao cria outras chaves');
    await assertAssignableRole(this.prisma, currentUser, dto.customRoleId);
    const key = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
    const name = dto.name.trim();
    const created = await this.prisma.$transaction(async (tx) => {
      const serviceUser = await tx.user.create({
        data: {
          email: `api-key+${randomBytes(8).toString('hex')}@service.invalid`,
          name: `API: ${name}`,
          // senha inutilizavel: usuario tecnico nunca faz login
          password: await bcrypt.hash(randomBytes(32).toString('hex'), 4),
          status: Status.ACTIVE,
          isServiceAccount: true,
        },
        select: { id: true },
      });
      await tx.userTenantAccess.create({
        data: {
          userId: serviceUser.id,
          tenantId: currentUser.tenantId,
          customRoleId: dto.customRoleId,
          status: Status.ACTIVE,
          isPrimary: true,
          grantedById: currentUser.id,
        },
      });
      return tx.apiKey.create({
        data: {
          tenantId: currentUser.tenantId,
          name,
          prefix: key.slice(0, 12),
          keyHash: hashKey(key),
          customRoleId: dto.customRoleId,
          createdById: currentUser.id,
          serviceUserId: serviceUser.id,
          expiresAt: dto.expiresInDays ? new Date(Date.now() + dto.expiresInDays * 86_400_000) : null,
        },
        select: { id: true, name: true, prefix: true, expiresAt: true },
      });
    });
    this.audit.log(currentUser, {
      action: 'create', resource: 'api_key', resourceId: created.id, newData: { name: created.name },
    }).catch(() => {});
    // A chave pura so existe nesta resposta.
    return { ...created, key };
  }

  async revoke(currentUser: CurrentUser, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, tenantId: currentUser.tenantId, revokedAt: null } });
    if (!key) throw new NotFoundException('Chave nao encontrada');
    await this.prisma.$transaction([
      this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }),
      this.prisma.user.update({ where: { id: key.serviceUserId }, data: { status: Status.INACTIVE } }),
      this.prisma.userTenantAccess.updateMany({ where: { userId: key.serviceUserId }, data: { status: Status.INACTIVE } }),
    ]);
    this.audit.log(currentUser, {
      action: 'delete', resource: 'api_key', resourceId: id, oldData: { name: key.name },
    }).catch(() => {});
    return { success: true };
  }

  /** Usado pelo JwtAuthGuard: chave valida -> mesmo formato do usuario logado. */
  async authenticate(rawKey: string): Promise<CurrentUser> {
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashKey(rawKey) },
      select: {
        id: true, name: true, tenantId: true, revokedAt: true, expiresAt: true, lastUsedAt: true,
        tenant: { select: { status: true } },
        customRole: {
          select: {
            id: true, name: true, isSystem: true, rank: true, deletedAt: true,
            permissions: true, modulePermissions: true, tenantPermissions: true,
          },
        },
        createdBy: {
          select: {
            status: true, deletedAt: true,
            tenantAccess: { where: { deletedAt: null, status: Status.ACTIVE }, select: { tenantId: true } },
          },
        },
        serviceUser: { select: { id: true, email: true, name: true, status: true } },
      },
    });
    const invalid = !key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date()) || key.customRole.deletedAt;
    if (invalid) throw new UnauthorizedException('Chave de API invalida ou revogada');
    const creator = key.createdBy;
    if (key.serviceUser.status !== Status.ACTIVE) throw new UnauthorizedException('Chave de API invalida ou revogada');
    if (creator.status !== Status.ACTIVE || creator.deletedAt || !creator.tenantAccess.some((a) => a.tenantId === key.tenantId)) {
      throw new UnauthorizedException('Chave de API sem dono ativo na empresa');
    }
    if (key.tenant.status !== Status.ACTIVE) {
      throw new ForbiddenException({ code: 'TENANT_SUSPENDED', message: 'Tenant suspenso ou inativo' });
    }

    // lastUsedAt no maximo uma vez por minuto (nao escreve a cada chamada).
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
      this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }

    const { deletedAt: _deleted, ...role } = key.customRole;
    return {
      id: key.serviceUser.id,
      email: key.serviceUser.email,
      name: key.serviceUser.name,
      tenantId: key.tenantId,
      customRoleId: role.id,
      customRole: {
        ...role,
        permissions: role.permissions as unknown[],
        modulePermissions: role.modulePermissions as Record<string, unknown>,
        tenantPermissions: role.tenantPermissions as Record<string, unknown>,
      },
      apiKey: { id: key.id, name: key.name },
    };
  }
}
