import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { CreateSitePageDto, PreviewSitePageDto, PublishSitePageDto, TrackingLinkDto, UpdateSiteDto, UpdateSitePageDto } from './dto/site-pages.dto';
import { SitePagesService } from './site-pages.service';

/** Paginas para clientes: mesma permissao e plano dos links publicos. */
@ApiTags('Site Pages')
@ServiceScope('admin')
@RequireFeature('publicLinks')
@Controller('site-pages')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModulePermission('publicLinks', 'canManage')
@ApiBearerAuth()
export class SitePagesController {
  constructor(private readonly service: SitePagesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as paginas para clientes' })
  list(@CurrentUser() user: CurrentUserType) {
    return this.service.list(user);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Previa de blocos ainda nao salvos' })
  preview(@Body() dto: PreviewSitePageDto, @CurrentUser() user: CurrentUserType) {
    return this.service.preview(dto.blocks, dto.title || 'Prévia', user, dto.settings, dto.slug);
  }

  @Get('site')
  @ApiOperation({ summary: 'Site da empresa: aparencia, menu, rodape e pagina inicial' })
  getSite(@CurrentUser() user: CurrentUserType) {
    return this.service.getSite(user);
  }

  @Put('site')
  @ApiOperation({ summary: 'Salva aparencia, menu, rodape e pagina inicial do site' })
  updateSite(@Body() dto: UpdateSiteDto, @CurrentUser() user: CurrentUserType) {
    return this.service.updateSite(user, dto as unknown as Record<string, unknown>);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.get(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma pagina (em branco, formulario ou acompanhamento)' })
  create(@Body() dto: CreateSitePageDto, @CurrentUser() user: CurrentUserType) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSitePageDto, @CurrentUser() user: CurrentUserType) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string, @Body() dto: PublishSitePageDto, @CurrentUser() user: CurrentUserType) {
    return this.service.publish(id, dto.publish, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.remove(id, user);
  }
}

/**
 * Link de acompanhamento de um registro: quem enxerga o registro pode enviar o
 * link ao cliente (nao precisa gerenciar paginas).
 */
@ApiTags('Site Pages')
@RequireFeature('publicLinks')
@Controller('record-tracking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecordTrackingController {
  constructor(private readonly service: SitePagesService) {}

  @Get('available')
  @ApiOperation({ summary: 'Existe pagina de acompanhamento publicada para a tabela?' })
  available(@Query('entitySlug') entitySlug: string, @CurrentUser() user: CurrentUserType) {
    return this.service.hasTrackingPage(String(entitySlug || ''), user);
  }

  @Post('link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link de acompanhamento de um registro (cria se nao existir)' })
  link(@Body() dto: TrackingLinkDto, @CurrentUser() user: CurrentUserType) {
    return this.service.trackingLink(dto, user);
  }
}
