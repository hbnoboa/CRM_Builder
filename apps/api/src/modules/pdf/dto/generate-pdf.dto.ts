import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeneratePdfDto {
  @ApiProperty({ description: 'ID ou slug do template' })
  @IsString()
  templateId: string;

  @ApiPropertyOptional({ description: 'ID do registro da entidade' })
  @IsOptional()
  @IsString()
  recordId?: string;

  @ApiPropertyOptional({ description: 'Dados de entrada adicionais' })
  @IsOptional()
  @IsObject()
  inputData?: Record<string, unknown>;
}

export class GenerateBatchPdfDto {
  @ApiProperty({ description: 'ID ou slug do template' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'IDs dos registros', type: [String] })
  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}

export class GeneratePreviewDto {
  @ApiProperty({ description: 'ID do template' })
  @IsString()
  templateId: string;

  @ApiPropertyOptional({ description: 'Dados de exemplo para preview' })
  @IsOptional()
  @IsObject()
  sampleData?: Record<string, unknown>;
}

export class QueryFilterDto {
  @ApiProperty({ description: 'Slug da entidade' })
  @IsString()
  entitySlug: string;

  @ApiPropertyOptional({ description: 'Filtros a aplicar' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}

export class GenerateWithQueryDto {
  @ApiProperty({ description: 'ID ou slug do template' })
  @IsString()
  templateId: string;

  @ApiPropertyOptional({ description: 'ID do registro (opcional)' })
  @IsOptional()
  @IsString()
  recordId?: string;

  @ApiPropertyOptional({ description: 'Query para agregar dados' })
  @IsOptional()
  query?: QueryFilterDto;
}
