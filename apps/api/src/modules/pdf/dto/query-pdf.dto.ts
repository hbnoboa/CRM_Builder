import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PdfGenerationStatus } from '@prisma/client';

export class QueryPdfTemplateDto {
  @ApiPropertyOptional({ description: 'Tenant ID (PLATFORM_ADMIN cross-tenant)' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Busca por nome' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por entidade fonte' })
  @IsString()
  @IsOptional()
  sourceEntityId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo (single/batch)' })
  @IsString()
  @IsOptional()
  templateType?: 'single' | 'batch';

  @ApiPropertyOptional({ description: 'Filtrar apenas publicados' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Limite de resultados', default: 20 })
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Cursor para paginacao' })
  @IsString()
  @IsOptional()
  cursor?: string;
}

export class QueryPdfGenerationDto {
  @ApiPropertyOptional({ description: 'Tenant ID (PLATFORM_ADMIN cross-tenant)' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por template' })
  @IsString()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional({ enum: PdfGenerationStatus, description: 'Filtrar por status' })
  @IsEnum(PdfGenerationStatus)
  @IsOptional()
  status?: PdfGenerationStatus;

  @ApiPropertyOptional({ description: 'Limite de resultados', default: 20 })
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Cursor para paginacao' })
  @IsString()
  @IsOptional()
  cursor?: string;
}
