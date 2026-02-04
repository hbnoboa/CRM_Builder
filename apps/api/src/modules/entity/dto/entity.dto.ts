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
  RELATION = 'relation',
  TEXTAREA = 'textarea',
  URL = 'url',
  PHONE = 'phone',
}

export class FieldDto {
  @ApiProperty({ description: 'Nome do campo' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Label do campo' })
  @IsString()
  label: string;

  @ApiProperty({ enum: FieldType, description: 'Tipo do campo' })
  @IsEnum(FieldType)
  type: FieldType;

  @ApiPropertyOptional({ description: 'Campo obrigatório' })
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Valor padrão' })
  @IsOptional()
  defaultValue?: any;

  @ApiPropertyOptional({ description: 'Opções para campos select' })
  @IsArray()
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional({ description: 'ID da entidade relacionada' })
  @IsString()
  @IsOptional()
  relationEntityId?: string;
}

export class CreateEntityDto {
  @ApiProperty({ description: 'Nome da entidade' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descrição da entidade' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'ID da organizacao' })
  @IsString()
  @IsOptional()
  organizationId?: string;

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

  @ApiPropertyOptional({ description: 'Descrição da entidade' })
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
  @ApiPropertyOptional({ description: 'ID da organizacao' })
  @IsString()
  @IsOptional()
  organizationId?: string;
}
