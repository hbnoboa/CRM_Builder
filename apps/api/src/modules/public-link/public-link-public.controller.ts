import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicLinkService } from './public-link.service';
import { PublicRegisterDto, PublicLoginDto } from './dto/public-link.dto';

@Controller('p')
@ApiTags('Public Link - Public')
export class PublicLinkPublicController {
  constructor(private readonly publicLinkService: PublicLinkService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Busca info publica de um link' })
  getBySlug(@Param('slug') slug: string) {
    return this.publicLinkService.getBySlug(slug);
  }

  @Post(':slug/register')
  @ApiOperation({ summary: 'Registro publico via link' })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  register(@Param('slug') slug: string, @Body() dto: PublicRegisterDto) {
    return this.publicLinkService.publicRegister(slug, dto);
  }

  @Post(':slug/login')
  @ApiOperation({ summary: 'Login publico via link' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Param('slug') slug: string, @Body() dto: PublicLoginDto) {
    return this.publicLinkService.publicLogin(slug, dto);
  }
}
