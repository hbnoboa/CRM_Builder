import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsObject,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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

export class SimulationSubEntityConfigDto {
  @ApiProperty({ description: 'Slug do campo sub-entity no parent' })
  @IsString()
  fieldSlug: string;

  @ApiPropertyOptional({ description: 'Quantos registros parent terao sub-itens' })
  @IsNumber()
  @IsOptional()
  recordsWithItems?: number;

  @ApiPropertyOptional({ description: 'Minimo de sub-itens por registro afetado', default: 1 })
  @IsNumber()
  @IsOptional()
  minItemsPerRecord?: number;

  @ApiPropertyOptional({ description: 'Maximo de sub-itens por registro afetado', default: 3 })
  @IsNumber()
  @IsOptional()
  maxItemsPerRecord?: number;
}

export class SimulationConfigDto {
  @ApiPropertyOptional({ description: 'Total de registros a simular (batch)', default: 10 })
  @IsNumber()
  @IsOptional()
  totalRecords?: number;

  @ApiPropertyOptional({ description: 'Distribuicao de sub-entidades' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimulationSubEntityConfigDto)
  @IsOptional()
  subEntityDistribution?: SimulationSubEntityConfigDto[];

  @ApiPropertyOptional({ description: 'Valores fixos para sobrescrever campos' })
  @IsObject()
  @IsOptional()
  fieldOverrides?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Variedade de dados: slug do campo → quantidade de valores distintos. Ex: { "marca": 5 } gera 5 marcas diferentes distribuidas entre os registros' })
  @IsObject()
  @IsOptional()
  fieldVariety?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Combinacoes de valores relacionados. Cada item define valores de campos que devem ir juntos. Ex: [{ marca: "Toyota", modelo: "Corolla" }, { marca: "Ford", modelo: "Ranger" }]. Registros sao distribuidos ciclicamente entre as combinacoes.' })
  @IsArray()
  @IsOptional()
  fieldProfiles?: Record<string, string>[];
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

  @ApiPropertyOptional({ description: 'Configuracao de simulacao para gerar dados mock' })
  @ValidateNested()
  @Type(() => SimulationConfigDto)
  @IsOptional()
  simulation?: SimulationConfigDto;
}
