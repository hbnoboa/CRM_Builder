import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: 'Nome do papel' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descrição do papel' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Lista de permissões' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Se é um papel do sistema' })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'Nome do papel' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Descrição do papel' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Lista de permissões' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class AssignRoleDto {
  @ApiProperty({ description: 'ID do usuário' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'ID do papel' })
  @IsString()
  roleId: string;
}
