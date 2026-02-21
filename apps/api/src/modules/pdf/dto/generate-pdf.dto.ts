import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateSinglePdfDto {
  @ApiProperty({ description: 'ID do registro para gerar PDF' })
  @IsString()
  recordId: string;

  @ApiPropertyOptional({ description: 'Dados adicionais para sobrescrever' })
  @IsObject()
  @IsOptional()
  overrideData?: Record<string, unknown>;
}

export class GenerateBatchPdfDto {
  @ApiPropertyOptional({ description: 'IDs dos registros para gerar PDFs (modo selecao manual)' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recordIds?: string[];

  @ApiPropertyOptional({ description: 'Se true, gera PDF com todos os registros da entidade', default: false })
  @IsBoolean()
  @IsOptional()
  useAllRecords?: boolean;

  @ApiPropertyOptional({ description: 'Filtros JSON para usar com useAllRecords' })
  @IsString()
  @IsOptional()
  filters?: string;

  @ApiPropertyOptional({ description: 'Busca textual para usar com useAllRecords' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Se true, gera um unico PDF com todos os registros', default: false })
  @IsBoolean()
  @IsOptional()
  mergePdfs?: boolean;
}

export class PreviewPdfDto {
  @ApiPropertyOptional({ description: 'Dados de exemplo para preview' })
  @IsObject()
  @IsOptional()
  sampleData?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'ID do registro para usar como exemplo' })
  @IsString()
  @IsOptional()
  recordId?: string;

  @ApiPropertyOptional({ description: 'Conteudo do template para override (preview em tempo real)' })
  @IsObject()
  @IsOptional()
  content?: Record<string, unknown>;
}
