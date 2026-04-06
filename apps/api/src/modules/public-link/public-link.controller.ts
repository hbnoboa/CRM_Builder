import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types/auth.types';
import { PublicLinkService } from './public-link.service';
import { CreatePublicLinkDto, UpdatePublicLinkDto, QueryPublicLinkDto } from './dto/public-link.dto';

@Controller('public-links')
@ApiTags('Public Links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModulePermission('publicLinks', 'canManage')
export class PublicLinkController {
  constructor(private readonly publicLinkService: PublicLinkService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo link publico' })
  create(@Body() dto: CreatePublicLinkDto, @CurrentUser() user: CurrentUserType) {
    return this.publicLinkService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lista links publicos do tenant' })
  findAll(@Query() query: QueryPublicLinkDto, @CurrentUser() user: CurrentUserType) {
    return this.publicLinkService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um link publico por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.publicLinkService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um link publico' })
  update(@Param('id') id: string, @Body() dto: UpdatePublicLinkDto, @CurrentUser() user: CurrentUserType) {
    return this.publicLinkService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um link publico' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.publicLinkService.remove(id, user);
  }
}
