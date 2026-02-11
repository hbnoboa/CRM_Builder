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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityService, QueryEntityDto } from './entity.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Entities')
@Controller('entities')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EntityController {
  constructor(private readonly entityService: EntityService) {}

  @Post()
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Criar entidade' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.entityService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar entidades do tenant' })
  async findAll(@Query() query: QueryEntityDto, @CurrentUser() user: any) {
    return this.entityService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar entidade por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.entityService.findOne(id, user);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Buscar entidade por slug' })
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: any,
  ) {
    return this.entityService.findBySlug(slug, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Atualizar entidade' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.entityService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Excluir entidade' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.entityService.remove(id, user);
  }
}
