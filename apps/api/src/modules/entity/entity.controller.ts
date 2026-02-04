import {
  Controller,
  Get,
  Post,
  Patch,
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

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Criar entidade' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    // Se organizationId nao foi fornecido, usar do usuario
    if (!dto.organizationId && user.organizationId) {
      dto.organizationId = user.organizationId;
    }
    return this.entityService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar entidades da organizacao' })
  async findAll(@Query() query: QueryEntityDto & { organizationId?: string }, @CurrentUser() user: any) {
    // Se organizationId nao foi fornecido, usar do usuario
    const organizationId = query.organizationId || user.organizationId;
    if (!organizationId) {
      throw new BadRequestException('organizationId e obrigatorio');
    }
    return this.entityService.findAll(organizationId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar entidade por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.entityService.findOne(id, user);
  }

  @Get('organization/:organizationId/slug/:slug')
  @ApiOperation({ summary: 'Buscar entidade por slug' })
  async findBySlug(
    @Param('organizationId') organizationId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: any,
  ) {
    return this.entityService.findBySlug(organizationId, slug, user);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Buscar entidade por slug (usa organizacao do usuario)' })
  async findBySlugAuto(
    @Param('slug') slug: string,
    @CurrentUser() user: any,
  ) {
    if (!user.organizationId) {
      throw new BadRequestException('Usuario nao possui organizacao');
    }
    return this.entityService.findBySlug(user.organizationId, slug, user);
  }

  @Patch(':id')
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
