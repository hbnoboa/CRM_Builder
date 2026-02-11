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

  // Admin inicial
  @ApiProperty({ example: 'admin@empresa.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'Admin da Empresa' })
  @IsString()
  adminName: string;

  @ApiProperty({ example: 'Senha123!' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  adminPassword: string;
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
