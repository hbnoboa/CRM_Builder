import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Lista curta da equipe (id e nome) para escolher "Pessoa da equipe" nos
 * formularios. Qualquer membro ve so a propria empresa; sem e-mail nem cargo.
 * Compartilhada entre os ambientes (sem @ServiceScope): o operacional tambem usa.
 */
@ApiTags('Users')
@Controller('team-directory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TeamDirectoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Membros ativos da empresa (id e nome)' })
  async list(@CurrentUser() user: CurrentUserType) {
    // Portal do cliente: a lista da equipe nao e mostrada a clientes
    if (user.clientRecordId) return [];
    const rows = await this.prisma.userTenantAccess.findMany({
      where: {
        tenantId: getEffectiveTenantId(user),
        status: Status.ACTIVE,
        deletedAt: null,
        user: { isServiceAccount: false, deletedAt: null },
      },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
      take: 500,
    });
    return rows.map((r) => ({ id: r.user.id, name: r.user.name }));
  }
}
