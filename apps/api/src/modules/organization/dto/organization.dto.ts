import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Nome da organização' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descrição da organização' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Configurações adicionais' })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Nome da organização' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Descrição da organização' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Configurações adicionais' })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}
