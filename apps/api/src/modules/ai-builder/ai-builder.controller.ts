import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { AiApplyDto, AiPdfPreviewDto, AiProposeDto } from './ai-builder.dto';
import { AiBuilderService } from './ai-builder.service';

@ApiTags('AI Builder')
@Controller('ai-builder')
@ServiceScope('admin')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiBearerAuth()
export class AiBuilderController {
  constructor(private readonly service: AiBuilderService) {}

  @Get('status')
  @ApiOperation({ summary: 'O assistente de criacao esta ligado?' })
  status() {
    return this.service.status();
  }

  @Post('propose')
  @HttpCode(HttpStatus.OK)
  @RequireModulePermission('entities', 'canCreate')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Conversa: devolve a proposta de tabelas atualizada (nada e criado)' })
  propose(@Body() dto: AiProposeDto, @CurrentUser() user: CurrentUserType) {
    return this.service.propose(dto, user);
  }

  @Post('apply')
  @RequireModulePermission('entities', 'canCreate')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Cria as tabelas da proposta' })
  apply(@Body() dto: AiApplyDto, @CurrentUser() user: CurrentUserType) {
    return this.service.apply(dto, user);
  }

  // Paineis: mesma permissao de criar painel na tela de Paineis
  @Post('dashboards/propose')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Conversa: devolve o painel proposto (nada e criado)' })
  proposeDashboard(@Body() dto: AiProposeDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'dashboard', 'canCreate');
    return this.service.proposeDashboard(dto, user);
  }

  @Post('dashboards/apply')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Cria o painel proposto' })
  applyDashboard(@Body() dto: AiApplyDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'dashboard', 'canCreate');
    return this.service.applyDashboard(dto, user);
  }

  @Post('pdfs/propose')
  @HttpCode(HttpStatus.OK)
  @RequireModulePermission('templates', 'canCreate', 'pdfTemplates')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Conversa: devolve o modelo de PDF proposto (nada e criado)' })
  proposePdf(@Body() dto: AiProposeDto, @CurrentUser() user: CurrentUserType) {
    return this.service.proposePdf(dto, user);
  }

  @Post('pdfs/preview')
  @HttpCode(HttpStatus.OK)
  @RequireModulePermission('templates', 'canCreate', 'pdfTemplates')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'PDF da proposta com dados de exemplo' })
  async previewPdf(@Body() dto: AiPdfPreviewDto, @CurrentUser() user: CurrentUserType, @Res() res: Response) {
    const buffer = await this.service.previewPdf(dto, user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="previa.pdf"', 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Post('pdfs/apply')
  @RequireModulePermission('templates', 'canCreate', 'pdfTemplates')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Cria o modelo de PDF proposto' })
  applyPdf(@Body() dto: AiApplyDto, @CurrentUser() user: CurrentUserType) {
    return this.service.applyPdf(dto, user);
  }
}
