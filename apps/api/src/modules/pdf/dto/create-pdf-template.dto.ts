import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsArray,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PdfPageSize, PdfOrientation } from '@prisma/client';
import { PdfTemplateContent, PdfMargins } from '../interfaces/pdf-element.interface';

export class CreatePdfTemplateDto {
  @ApiPropertyOptional({ description: 'Tenant ID (apenas PLATFORM_ADMIN)' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ description: 'Nome do template', example: 'Relatorio de Veiculo' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ description: 'Slug unico', example: 'relatorio-veiculo' })
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug deve conter apenas letras minusculas, numeros e hifens' })
  slug: string;

  @ApiPropertyOptional({ description: 'Descricao do template' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Icone do template (Lucide icon name)' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ enum: PdfPageSize, default: 'A4' })
  @IsEnum(PdfPageSize)
  @IsOptional()
  pageSize?: PdfPageSize;

  @ApiPropertyOptional({ enum: PdfOrientation, default: 'PORTRAIT' })
  @IsEnum(PdfOrientation)
  @IsOptional()
  orientation?: PdfOrientation;

  @ApiPropertyOptional({ description: 'Margens do PDF em pixels' })
  @IsObject()
  @IsOptional()
  margins?: PdfMargins;

  @ApiPropertyOptional({ description: 'Conteudo do template (header, body, footer)' })
  @IsObject()
  @IsOptional()
  content?: PdfTemplateContent;

  @ApiPropertyOptional({ description: 'ID da entidade fonte de dados' })
  @IsString()
  @IsOptional()
  sourceEntityId?: string;

  @ApiPropertyOptional({ description: 'Campos selecionados da entidade' })
  @IsArray()
  @IsOptional()
  selectedFields?: string[];

  @ApiPropertyOptional({ description: 'URL do logo padrao' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Tipo: single ou batch', default: 'single' })
  @IsString()
  @IsOptional()
  templateType?: 'single' | 'batch';
}
