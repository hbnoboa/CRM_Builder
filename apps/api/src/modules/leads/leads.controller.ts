import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { Equals, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { SalesLeadStatus } from '@prisma/client';
import type { Request } from 'express';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { clientIp } from '../../common/utils/client-ip';
import { PlatformAuthGuard } from '../platform/platform-jwt.strategy';
import { CurrentStaff, PlatformPermissionGuard, PlatformStaffPrincipal, RequirePlatformPermission } from '../platform/platform-permissions';
import { LeadsService } from './leads.service';

class CreateLeadDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsEmail({}, { message: 'Email invalido' }) @MaxLength(150) email: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MinLength(2) @MaxLength(120) company: string;
  @IsOptional() @IsString() @MaxLength(30) teamSize?: string;
  @IsOptional() @IsString() @MaxLength(60) segment?: string;
  @IsOptional() @IsString() @MaxLength(60) interest?: string;
  @IsOptional() @IsString() @MaxLength(3000) message?: string;
  @IsOptional() @IsString() @MaxLength(120) source?: string;
  /** Concordou em ser contatado (LGPD). */
  @Equals(true, { message: 'E preciso autorizar o contato' }) consent: boolean;
  /** Armadilha para robos: campo invisivel que pessoas deixam vazio. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

class ListLeadsDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

class UpdateLeadDto {
  @IsOptional() @IsEnum(SalesLeadStatus) status?: SalesLeadStatus;
  @IsOptional() @IsString() @MaxLength(3000) notes?: string;
}

/** Formulario publico "Falar com especialista". */
@ApiTags('Leads')
@Controller('public/contact')
export class LeadsPublicController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Pedido de contato comercial (publico)' })
  async create(@Body() dto: CreateLeadDto, @Req() req: Request) {
    // Robo preencheu o campo escondido: responde ok e nao guarda nada
    if (dto.website) return { ok: true };
    const { consent: _consent, website: _website, ...input } = dto;
    return this.leads.create(input, clientIp(req)?.replace(/^::ffff:/i, ''));
  }
}

/** Console: contatos comerciais. */
@ApiTags('Platform')
@ServiceScope('admin')
@Controller('platform/leads')
@UseGuards(PlatformAuthGuard, PlatformPermissionGuard)
@ApiBearerAuth()
export class LeadsConsoleController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePlatformPermission('support.read')
  list(@Query() query: ListLeadsDto) {
    return this.leads.list(query);
  }

  @Get('counts')
  @RequirePlatformPermission('support.read')
  counts() {
    return this.leads.counts();
  }

  @Patch(':id')
  @RequirePlatformPermission('support.reply')
  update(@CurrentStaff() staff: PlatformStaffPrincipal, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(staff, id, dto);
  }
}
