import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { PrivacyService } from './privacy.service';

class ConfirmIdentityDto {
  @IsString() @MinLength(1) password: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
}

class CloseCompanyDto extends ConfirmIdentityDto {
  @IsString() @MinLength(1) @MaxLength(200) confirmName: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

class DeleteMeDto extends ConfirmIdentityDto {
  @IsString() confirm: string;
}

/** LGPD: portabilidade e exclusao (da empresa e da propria pessoa). */
@ApiTags('Privacy')
@Controller('privacy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('company')
  @ApiOperation({ summary: 'Situacao: quem pode exportar/encerrar e se ha encerramento agendado' })
  status(@CurrentUser() user: CurrentUserType) {
    return this.privacy.closureStatus(user);
  }

  @Get('company/export')
  @ApiOperation({ summary: 'Baixar todos os dados da empresa (ZIP com JSON e CSV)' })
  async exportCompany(@CurrentUser() user: CurrentUserType, @Res() res: Response) {
    const { filename, zip } = await this.privacy.exportCompany(user);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(zip.length));
    res.end(zip);
  }

  @Post('company/close')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Encerrar a conta da empresa (so o dono; exclusao definitiva apos o prazo)' })
  close(@CurrentUser() user: CurrentUserType, @Body() dto: CloseCompanyDto) {
    return this.privacy.requestClosure(user, dto);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Baixar os meus dados pessoais (JSON)' })
  async exportMe(@CurrentUser() user: CurrentUserType, @Res() res: Response) {
    const data = await this.privacy.exportMe(user);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`);
    res.end(JSON.stringify(data, null, 2));
  }

  @Post('me/delete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Excluir a minha conta (dados pessoais apagados)' })
  deleteMe(@CurrentUser() user: CurrentUserType, @Body() dto: DeleteMeDto) {
    return this.privacy.deleteMe(user, dto);
  }
}
