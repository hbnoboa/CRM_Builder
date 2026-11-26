import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { hasFullTenantAccess } from '../../common/utils/platform-access';
import { AiProposeDto } from './ai-builder.dto';
import { AiWorkspaceApplyDto, AiWorkspacePdfPreviewDto, AiWorkspacePreviewDto } from './ai-workspace.dto';
import { AiWorkspaceService } from './ai-workspace.service';

/** Quem monta alguma parte do sistema (tabelas, paineis ou PDFs) usa o construtor. */
function checkBuilder(user: CurrentUserType) {
  if (hasFullTenantAccess(user.customRole?.modulePermissions)) return;
  const mp = (user.customRole?.modulePermissions || {}) as Record<string, Record<string, unknown> | undefined>;
  const can = (m: string) => ['canCreate', 'canUpdate', 'canDelete'].some((a) => mp[m]?.[a] === true);
  if (!can('entities') && !can('dashboard') && !can('templates')) {
    throw new ForbiddenException('Seu cargo não monta tabelas, painéis nem PDFs.');
  }
}

@ApiTags('AI Builder')
@Controller('ai-builder/workspace')
@ServiceScope('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiWorkspaceController {
  constructor(private readonly service: AiWorkspaceService) {}

  @Get()
  @ApiOperation({ summary: 'Construtor: tabelas, paineis e PDFs que existem, no formato do rascunho' })
  state(@CurrentUser() user: CurrentUserType) {
    checkBuilder(user);
    return this.service.state(user);
  }

  @Get('history')
  @ApiOperation({ summary: 'Construtor: o que foi aplicado, por quem e o que foi pedido' })
  history(@CurrentUser() user: CurrentUserType) {
    checkBuilder(user);
    return this.service.history(user);
  }

  @Post('propose')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Conversa: devolve o rascunho atualizado (nada muda)' })
  propose(@Body() dto: AiProposeDto, @CurrentUser() user: CurrentUserType) {
    checkBuilder(user);
    return this.service.propose(dto, user);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Confere um rascunho mexido a mao (sem IA)' })
  preview(@Body() dto: AiWorkspacePreviewDto, @CurrentUser() user: CurrentUserType) {
    checkBuilder(user);
    return this.service.preview(dto.proposal, user);
  }

  @Post('pdf-preview')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'PDF de um rascunho com dados de exemplo' })
  async pdfPreview(@Body() dto: AiWorkspacePdfPreviewDto, @CurrentUser() user: CurrentUserType, @Res() res: Response) {
    checkBuilder(user);
    const buffer = await this.service.previewPdf(dto, user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="previa.pdf"', 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Aplica o rascunho (permissao conferida em cada mudanca) e registra no historico' })
  apply(@Body() dto: AiWorkspaceApplyDto, @CurrentUser() user: CurrentUserType) {
    checkBuilder(user);
    return this.service.apply(dto, user);
  }
}
