import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GlobalFilterDto {
  @ApiProperty({ description: 'ID unico do filtro' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Slug do campo a filtrar' })
  @IsString()
  fieldSlug: string;

  @ApiProperty({ description: 'Nome do campo (para exibicao)' })
  @IsString()
  fieldName: string;

  @ApiProperty({ description: 'Tipo do campo (text, number, date, select, boolean, etc)' })
  @IsString()
  fieldType: string;

  @ApiProperty({ description: 'Operador do filtro (equals, contains, gt, lt, between, isEmpty, etc)' })
  @IsString()
  operator: string;

  @ApiPropertyOptional({ description: 'Valor do filtro' })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({ description: 'Segundo valor (para operador between)' })
  @IsOptional()
  value2?: unknown;

  @ApiPropertyOptional({ description: 'Sub-campo (para campos map)' })
  @IsOptional()
  @IsString()
  subField?: string;

  @ApiPropertyOptional({ description: 'ID do usuario que criou o filtro' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Nome do usuario que criou o filtro' })
  @IsOptional()
  @IsString()
  createdByName?: string;

  @ApiPropertyOptional({ description: 'Data de criacao do filtro' })
  @IsOptional()
  @IsString()
  createdAt?: string;
}

export class UpdateGlobalFiltersDto {
  @ApiProperty({ description: 'Array de filtros globais', type: [GlobalFilterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GlobalFilterDto)
  globalFilters: GlobalFilterDto[];
}
