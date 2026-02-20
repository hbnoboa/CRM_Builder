import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsObject,
  ArrayMinSize,
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
  @ApiProperty({ description: 'IDs dos registros para gerar PDFs' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  recordIds: string[];

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
}
