import { IsString, IsOptional, IsEnum, IsEmail, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTenantDto {
  @ApiProperty({ example: 'Empresa ABC' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'empresa-abc' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: 'empresa-abc.crmbuilder.com' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logo?: string;

  // Admin inicial (OPCIONAL - se nao informado, apenas cria o tenant com roles de sistema)
  @ApiPropertyOptional({ example: 'admin@empresa.com', description: 'Email do primeiro usuario admin (opcional)' })
  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @ApiPropertyOptional({ example: 'Admin da Empresa', description: 'Nome do primeiro usuario admin (opcional)' })
  @IsString()
  @IsOptional()
  adminName?: string;

  @ApiPropertyOptional({ example: 'Senha123!', description: 'Senha do primeiro usuario admin (opcional)' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @IsOptional()
  adminPassword?: string;
}

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @ApiPropertyOptional({ enum: Status })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;

  @ApiPropertyOptional()
  @IsOptional()
  settings?: Record<string, any>;
}

export class QueryTenantDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: Status })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
