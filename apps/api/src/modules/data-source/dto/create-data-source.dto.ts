import { IsString, MinLength, IsOptional, IsObject, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDataSourceDto {
  @ApiProperty({ example: 'Relatorio de Vendas' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'relatorio-vendas' })
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug deve conter apenas letras minusculas, numeros e hifens' })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;
}
