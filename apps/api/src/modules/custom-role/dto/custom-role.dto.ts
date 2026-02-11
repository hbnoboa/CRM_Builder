import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RoleType, PermissionScope, ROLE_TYPES } from '@crm-builder/shared';

export { RoleType, PermissionScope, ROLE_TYPES };

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

  @ApiPropertyOptional({
    enum: ['all', 'own'],
    default: 'all',
    description: 'Escopo de visibilidade: all = todos os registros, own = apenas proprios registros'
  })
  @IsString()
  @IsOptional()
  scope?: PermissionScope;
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

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  tenants?: boolean;
}

export class TenantPermissionsDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Se true, pode acessar todos os tenants (apenas PLATFORM_ADMIN)'
  })
  @IsBoolean()
  @IsOptional()
  canAccessAllTenants?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Lista de IDs de tenants permitidos (se canAccessAllTenants = false)'
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedTenantIds?: string[];
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

  @ApiPropertyOptional({
    enum: ROLE_TYPES,
    default: 'CUSTOM',
    description: 'Tipo da role: PLATFORM_ADMIN, ADMIN, MANAGER, USER, VIEWER, CUSTOM'
  })
  @IsString()
  @IsIn(ROLE_TYPES)
  @IsOptional()
  roleType?: RoleType;

  @ApiPropertyOptional({
    default: false,
    description: 'Se true, e uma role de sistema (nome e roleType protegidos)'
  })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;

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

  @ApiPropertyOptional({
    type: TenantPermissionsDto,
    description: 'Permissoes de tenant (apenas para PLATFORM_ADMIN)'
  })
  @ValidateNested()
  @Type(() => TenantPermissionsDto)
  @IsOptional()
  tenantPermissions?: TenantPermissionsDto;

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

  @ApiPropertyOptional({ description: 'Tenant ID para cross-tenant browsing (PLATFORM_ADMIN)' })
  @IsString()
  @IsOptional()
  tenantId?: string;
}
