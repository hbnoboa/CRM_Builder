import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PlatformStaffRole, Status, TenantLifecycle } from '@prisma/client';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_MESSAGE = 'Senha deve conter pelo menos uma letra maiuscula, uma minuscula e um numero';

// ── Auth ────────────────────────────────────────────────────────────────────

export class PlatformLoginDto {
  @ApiProperty({ example: 'voce@suaempresa.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}

export class PlatformChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(10, { message: 'Senha da equipe deve ter no minimo 10 caracteres' })
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

// ── Staff ───────────────────────────────────────────────────────────────────

export class CreatePlatformStaffDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: PlatformStaffRole })
  @IsEnum(PlatformStaffRole)
  role: PlatformStaffRole;

  @ApiProperty()
  @IsString()
  @MinLength(10, { message: 'Senha da equipe deve ter no minimo 10 caracteres' })
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}

export class UpdatePlatformStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: PlatformStaffRole })
  @IsOptional()
  @IsEnum(PlatformStaffRole)
  role?: PlatformStaffRole;

  @ApiPropertyOptional({ enum: [Status.ACTIVE, Status.INACTIVE] })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @ApiPropertyOptional({ description: 'Nova senha (reset pelo dono)' })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Senha da equipe deve ter no minimo 10 caracteres' })
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password?: string;
}

// ── Plans ───────────────────────────────────────────────────────────────────

export class CreatePlanDto {
  @ApiProperty({ example: 'Profissional' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: 'profissional' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug: letras minusculas, numeros e hifens' })
  @MaxLength(40)
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ example: { maxUsers: 10, maxRecords: 50000 } })
  @IsOptional()
  @IsObject()
  limits?: Record<string, number | null>;

  @ApiPropertyOptional({ example: { chat: true, pdf: true, automations: false } })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  limits?: Record<string, number | null>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

// ── Tenants ─────────────────────────────────────────────────────────────────

export class PlatformQueryTenantsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: TenantLifecycle })
  @IsOptional()
  @IsEnum(TenantLifecycle)
  lifecycle?: TenantLifecycle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PlatformCreateTenantDto {
  @ApiProperty({ example: 'Empresa ABC' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'empresa-abc' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug: letras minusculas, numeros e hifens' })
  @MaxLength(40)
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: TenantLifecycle, default: TenantLifecycle.ACTIVE })
  @IsOptional()
  @IsEnum(TenantLifecycle)
  lifecycle?: TenantLifecycle;

  @ApiPropertyOptional({ description: 'Fim do trial (ISO). Obrigatorio se lifecycle=TRIAL' })
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  adminName: string;

  @ApiProperty()
  @IsEmail({}, { message: 'Email invalido' })
  adminEmail: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  adminPassword: string;
}

export class PlatformUpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  domain?: string | null;
}

export class PlatformTenantLifecycleDto {
  @ApiProperty({ enum: TenantLifecycle })
  @IsEnum(TenantLifecycle)
  lifecycle: TenantLifecycle;

  @ApiPropertyOptional({ description: 'Fim do trial (ISO). Usado com lifecycle=TRIAL' })
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;
}

export class PlatformTenantPlanDto {
  @ApiProperty({ nullable: true, description: 'null = sem plano (tudo liberado, sem limites)' })
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  planId: string | null;
}

export class PlatformTenantFeaturesDto {
  @ApiProperty({
    example: { chat: false, pdf: null },
    description: 'true/false sobrescreve o plano; null remove a sobrescrita',
  })
  @IsObject()
  overrides: Record<string, boolean | null>;
}

export class PlatformQueryAuditDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
