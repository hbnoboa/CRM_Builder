import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityService, QueryEntityDto } from './entity.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Entities')
@Controller('entities')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EntityController {
  constructor(
    private readonly entityService: EntityService,
    private readonly prisma: PrismaService,
  ) {}

  // Helper to get workspace from organization
  private async getWorkspaceId(organizationId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { organizationId },
      select: { id: true },
    });
    if (!workspace) {
      throw new BadRequestException('Nenhum workspace encontrado para esta organização');
    }
    return workspace.id;
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Criar entidade' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    // If workspaceId is not provided, get it from user's organization
    if (!dto.workspaceId && user.organizationId) {
      dto.workspaceId = await this.getWorkspaceId(user.organizationId);
    }
    return this.entityService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar entidades do workspace' })
  async findAll(@Query() query: QueryEntityDto & { workspaceId?: string }, @CurrentUser() user: any) {
    // If workspaceId is not provided, get it from user's organization
    let workspaceId = query.workspaceId;
    if (!workspaceId && user.organizationId) {
      workspaceId = await this.getWorkspaceId(user.organizationId);
    }
    if (!workspaceId) {
      throw new BadRequestException('workspaceId é obrigatório');
    }
    return this.entityService.findAll(workspaceId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar entidade por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.entityService.findOne(id, user);
  }

  @Get('workspace/:workspaceId/slug/:slug')
  @ApiOperation({ summary: 'Buscar entidade por slug' })
  async findBySlug(
    @Param('workspaceId') workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: any,
  ) {
    return this.entityService.findBySlug(workspaceId, slug, user);
  }

  // Alias for convenience
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Buscar entidade por slug (usa workspace do usuário)' })
  async findBySlugAuto(
    @Param('slug') slug: string,
    @CurrentUser() user: any,
  ) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.entityService.findBySlug(workspaceId, slug, user);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Atualizar entidade' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.entityService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Excluir entidade' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.entityService.remove(id, user);
  }
}
