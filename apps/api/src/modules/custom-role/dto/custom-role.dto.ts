import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class EntityPermissionDto {
  @ApiProperty({ example: 'clientes' })
  @IsString()
  entitySlug: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  canCreate?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  canRead?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  canUpdate?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  canDelete?: boolean;
}

export class ModulePermissionsDto {
  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  dashboard?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  users?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  settings?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  apis?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  pages?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  entities?: boolean;
}

export class CreateCustomRoleDto {
  @ApiProperty({ example: 'Vendedor' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Acesso aos dados de vendas e clientes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '#6366f1' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ type: [EntityPermissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntityPermissionDto)
  permissions: EntityPermissionDto[];

  @ApiPropertyOptional({ type: ModulePermissionsDto })
  @ValidateNested()
  @Type(() => ModulePermissionsDto)
  @IsOptional()
  modulePermissions?: ModulePermissionsDto;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateCustomRoleDto extends PartialType(CreateCustomRoleDto) {}

export class QueryCustomRoleDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor para paginacao' })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
