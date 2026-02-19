import { IsOptional, IsArray, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ExecuteDataSourceDto {
  @ApiPropertyOptional({ description: 'Filtros adicionais em tempo de execucao' })
  @IsOptional()
  @IsArray()
  runtimeFilters?: Array<{
    field: string;
    fieldType?: string;
    operator: string;
    value?: unknown;
    value2?: unknown;
  }>;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
