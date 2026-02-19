import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePdfTemplateDto {
  @ApiProperty({ example: 'Relatorio de Avarias' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'relatorio-avarias' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug deve conter apenas letras minusculas, numeros e hifens',
  })
  slug: string;

  @ApiPropertyOptional({ example: 'Template para relatorio de avarias de veiculos' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'file-text' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 'relatorio' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ example: 'vehicles' })
  @IsOptional()
  @IsString()
  entitySlug?: string;

  @ApiPropertyOptional({ description: 'Configuracoes base do PDF (width, height, padding)' })
  @IsOptional()
  @IsObject()
  basePdf?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Array de elementos posicionados' })
  @IsOptional()
  @IsArray()
  schemas?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Configuracoes gerais (pageSize, orientation, margins)' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
