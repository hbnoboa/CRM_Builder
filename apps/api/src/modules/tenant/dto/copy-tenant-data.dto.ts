import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CopyEntitySelection {
  @ApiProperty({ description: 'ID da entidade a copiar' })
  @IsString()
  id: string;

  @ApiPropertyOptional({ description: 'Incluir registros (EntityData)' })
  @IsBoolean()
  @IsOptional()
  includeData?: boolean;
}

export class CopyModulesDto {
  @ApiPropertyOptional({ description: 'IDs dos roles a copiar' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];

  @ApiPropertyOptional({ description: 'Entidades a copiar (com opcao de incluir dados)', type: [CopyEntitySelection] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CopyEntitySelection)
  @IsOptional()
  entities?: CopyEntitySelection[];

  @ApiPropertyOptional({ description: 'IDs dos templates PDF a copiar' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pdfTemplates?: string[];

  @ApiPropertyOptional({ description: 'IDs das automacoes a copiar' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  automations?: string[];

  @ApiPropertyOptional({ description: 'IDs dos webhooks a copiar' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  webhooks?: string[];

  @ApiPropertyOptional({ description: 'IDs das regras de campo a copiar' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fieldRules?: string[];
}

export class CopyTenantDataDto {
  @ApiProperty({ description: 'ID do tenant de origem' })
  @IsString()
  sourceTenantId: string;

  @ApiProperty({ description: 'ID do tenant de destino' })
  @IsString()
  targetTenantId: string;

  @ApiPropertyOptional({ description: 'Estrategia em caso de conflito de slug/nome', enum: ['skip', 'suffix'] })
  @IsEnum(['skip', 'suffix'])
  @IsOptional()
  conflictStrategy?: 'skip' | 'suffix';

  @ApiProperty({ description: 'Modulos e itens a copiar', type: CopyModulesDto })
  @ValidateNested()
  @Type(() => CopyModulesDto)
  modules: CopyModulesDto;
}
