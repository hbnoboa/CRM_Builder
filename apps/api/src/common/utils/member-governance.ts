import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../types';
import { assertCanActOnRank } from './permission-governance';

// Quem gerencia quem dentro da empresa:
// - so se gerencia quem esta num cargo abaixo do seu (rank maior), e so se da cargo abaixo do seu;
// - o dono da empresa (Tenant.ownerId) fica acima de todos: gerencia inclusive os outros
//   administradores, e ninguem alem dele mesmo (ou o console da plataforma) mexe nele;
// - usuario que tambem e membro de OUTRA empresa: esta empresa nao troca e-mail/senha dele,
//   e desativar/excluir atinge so o vinculo com esta empresa.

const actorRank = (currentUser: CurrentUser) => currentUser.customRole?.rank ?? Number.MAX_SAFE_INTEGER;

async function tenantOwnerId(prisma: PrismaService, tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { ownerId: true } });
  return tenant?.ownerId ?? null;
}

/** Cargo desta empresa que o ator pode atribuir. */
export async function assertAssignableRole(
  prisma: PrismaService,
  currentUser: CurrentUser,
  customRoleId: string,
): Promise<void> {
  const role = await prisma.customRole.findFirst({
    where: { id: customRoleId, tenantId: currentUser.tenantId, deletedAt: null },
    select: { rank: true },
  });
  if (!role) throw new BadRequestException('Cargo nao encontrado nesta empresa');
  if ((await tenantOwnerId(prisma, currentUser.tenantId)) === currentUser.id) return;
  assertCanActOnRank(actorRank(currentUser), role.rank);
}

/** Membro desta empresa que o ator pode gerenciar (ou ele mesmo). */
export async function loadManagedMember(prisma: PrismaService, currentUser: CurrentUser, userId: string) {
  const [membership, ownerId, otherTenants] = await Promise.all([
    prisma.userTenantAccess.findFirst({
      where: { userId, tenantId: currentUser.tenantId, deletedAt: null },
      select: { id: true, isPrimary: true, status: true, customRole: { select: { rank: true } } },
    }),
    tenantOwnerId(prisma, currentUser.tenantId),
    prisma.userTenantAccess.count({
      where: { userId, tenantId: { not: currentUser.tenantId }, deletedAt: null },
    }),
  ]);
  if (!membership) throw new NotFoundException('Usuario nao encontrado nesta empresa');

  const isSelf = userId === currentUser.id;
  if (!isSelf && ownerId === userId) {
    throw new ForbiddenException('O dono da empresa so pode ser alterado por ele mesmo');
  }
  if (!isSelf && ownerId !== currentUser.id) {
    assertCanActOnRank(actorRank(currentUser), membership.customRole.rank);
  }
  return { membership, isSelf, isOwner: ownerId === userId, inOtherTenants: otherTenants > 0 };
}
