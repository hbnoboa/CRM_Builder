import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';

export class CreateRecordDto {
  @ApiProperty({ description: 'Dados do registro' })
  @IsObject()
  data: Record<string, any>;
}

export class UpdateRecordDto {
  @ApiProperty({ description: 'Dados do registro' })
  @IsObject()
  data: Record<string, any>;
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryRecordDto {
  @ApiPropertyOptional({ description: 'Página atual' })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Itens por página' })
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Termo de busca' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Campo para ordenação' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: SortOrder, description: 'Direção da ordenação' })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder;

  @ApiPropertyOptional({ description: 'Filtros adicionais em JSON' })
  @IsString()
  @IsOptional()
  filters?: string;
}
