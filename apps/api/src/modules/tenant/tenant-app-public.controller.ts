import { Controller, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { TenantAppService } from './tenant-app.service';

/**
 * Publico, usado pelo servidor do web para o aplicativo instalavel (PWA): manifesto e
 * icones da empresa. So responde para empresa ativa que ligou a opcao.
 */
@ApiTags('Tenants - App (publico)')
@Controller('public/tenants')
@UseGuards(AuthThrottlerGuard)
export class TenantAppPublicController {
  constructor(private readonly service: TenantAppService) {}

  @Get(':slug/app')
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  async info(@Param('slug') slug: string) {
    const info = await this.service.info(String(slug).slice(0, 100));
    if (!info) throw new NotFoundException('Aplicativo não disponível');
    return info;
  }

  @Get(':slug/app/logo.png')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async logo(@Param('slug') slug: string, @Res() res: Response) {
    const png = await this.service.logoPng(String(slug).slice(0, 100));
    if (!png) throw new NotFoundException('Sem logo');
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.send(png);
  }
}
