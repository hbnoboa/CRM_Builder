import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { SubmitSiteFormDto } from './dto/site-pages.dto';
import { SitePagesService } from './site-pages.service';

const UPLOAD = { limits: { fileSize: 10 * 1024 * 1024 } };

/** Paginas para clientes, abertas (sem login). Limites por IP em todas as rotas. */
@ApiTags('Site Pages - Public')
@Controller('site')
@UseGuards(AuthThrottlerGuard)
export class SitePublicController {
  constructor(private readonly service: SitePagesService) {}

  @Get(':tenant/:page')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Pagina publicada (com ?c=token mostra o registro acompanhado)' })
  get(@Param('tenant') tenant: string, @Param('page') page: string, @Query('c') token?: string) {
    return this.service.getPublic(tenant, page, token ? token.slice(0, 64) : undefined);
  }

  @Post(':tenant/:page/forms/:block')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Envia o formulario da pagina (vira registro)' })
  submit(@Param('tenant') tenant: string, @Param('page') page: string, @Param('block') block: string, @Body() dto: SubmitSiteFormDto) {
    return this.service.submitForm(tenant, page, block, dto);
  }

  @Post(':tenant/:page/forms/:block/upload')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', UPLOAD))
  @ApiOperation({ summary: 'Foto/arquivo de um campo do formulario' })
  upload(
    @Param('tenant') tenant: string, @Param('page') page: string, @Param('block') block: string,
    @Query('field') field: string, @UploadedFile() file: Express.Multer.File, @Query('target') target?: string,
  ) {
    return this.service.uploadForForm(tenant, page, block, String(field || ''), file, target);
  }

  @Post(':tenant/:page/track/:token/files')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', UPLOAD))
  @ApiOperation({ summary: 'Cliente envia documento/foto pelo link de acompanhamento' })
  trackUpload(
    @Param('tenant') tenant: string, @Param('page') page: string, @Param('token') token: string,
    @Query('field') field: string, @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadForTracking(tenant, page, token, String(field || ''), file);
  }

  @Get(':tenant/:page/track/:token/pdf')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'PDF do registro acompanhado' })
  async pdf(@Param('tenant') tenant: string, @Param('page') page: string, @Param('token') token: string, @Res() res: Response) {
    const { buffer, fileName } = await this.service.trackingPdf(tenant, page, token);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${fileName.replace(/[^\w.-]/g, '_')}"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }
}
