import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  EMAIL = 'email',
  DATE = 'date',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  API_SELECT = 'api-select',
  RELATION = 'relation',
  TEXTAREA = 'textarea',
  URL = 'url',
  PHONE = 'phone',
  DATETIME = 'datetime',
  MULTISELECT = 'multiselect',
  FILE = 'file',
  IMAGE = 'image',
  JSON = 'json',
}

export class AutoFillFieldDto {
  @ApiProperty({ description: 'Campo fonte da API' })
  @IsString()
  sourceField: string;

  @ApiProperty({ description: 'Campo destino nesta entidade' })
  @IsString()
  targetField: string;
}

export class FieldDto {
  @ApiProperty({ description: 'Slug/identificador do campo' })
  @IsString()
  slug: string;

  @ApiProperty({ description: 'Nome do campo' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Label do campo' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ enum: FieldType, description: 'Tipo do campo' })
  @IsEnum(FieldType)
  type: FieldType;

  @ApiPropertyOptional({ description: 'Campo obrigatorio' })
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Campo unico' })
  @IsBoolean()
  @IsOptional()
  unique?: boolean;

  @ApiPropertyOptional({ description: 'Valor padrao' })
  @IsOptional()
  defaultValue?: any;

  @ApiPropertyOptional({ description: 'Opcoes para campos select' })
  @IsArray()
  @IsOptional()
  options?: string[] | { value: string; label: string; color?: string }[];

  @ApiPropertyOptional({ description: 'ID da entidade relacionada' })
  @IsString()
  @IsOptional()
  relationEntityId?: string;

  // Campos especificos para api-select
  @ApiPropertyOptional({ description: 'Endpoint da Custom API (ex: /corretores)' })
  @IsString()
  @IsOptional()
  apiEndpoint?: string;

  @ApiPropertyOptional({ description: 'Campo para usar como valor (default: id)' })
  @IsString()
  @IsOptional()
  valueField?: string;

  @ApiPropertyOptional({ description: 'Campo para usar como label (default: name)' })
  @IsString()
  @IsOptional()
  labelField?: string;

  @ApiPropertyOptional({ description: 'Campos para auto-preenchimento', type: [AutoFillFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutoFillFieldDto)
  @IsOptional()
  autoFillFields?: AutoFillFieldDto[];
}

export class CreateEntityDto {
  @ApiProperty({ description: 'Nome da entidade' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descricao da entidade' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Campos da entidade', type: [FieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  @IsOptional()
  fields?: FieldDto[];
}

export class UpdateEntityDto {
  @ApiPropertyOptional({ description: 'Nome da entidade' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Descricao da entidade' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Campos da entidade', type: [FieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  @IsOptional()
  fields?: FieldDto[];
}

export class QueryEntityDto {
  @ApiPropertyOptional({ description: 'Termo de busca' })
  @IsString()
  @IsOptional()
  search?: string;
}
