import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDashboardTemplateDto {
  @ApiProperty({ example: 'Dashboard Vendas' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Dashboard para acompanhamento de vendas' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'clientes' })
  @IsOptional()
  @IsString()
  entitySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  layout?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  widgets?: unknown;

  @ApiPropertyOptional({ example: ['clrole123', 'clrole456'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  tabs?: unknown;
}

export class UpdateDashboardTemplateDto {
  @ApiPropertyOptional({ example: 'Dashboard Vendas v2' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entitySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  layout?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  widgets?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  tabs?: unknown;
}
