import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsIn, Allow } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RoleType, PermissionScope, ROLE_TYPES } from '@crm-builder/shared';

export { RoleType, PermissionScope, ROLE_TYPES };

const VALID_FILTER_OPERATORS = [
  'equals', 'contains', 'startsWith', 'endsWith',
  'gt', 'gte', 'lt', 'lte', 'between',
  'isEmpty', 'isNotEmpty',
] as const;

export class DataFilterDto {
  @ApiProperty({ example: 'local' })
  @IsString()
  fieldSlug: string;

  @ApiProperty({ example: 'Local' })
  @IsString()
  fieldName: string;

  @ApiProperty({ example: 'text' })
  @IsString()
  fieldType: string;

  @ApiProperty({ example: 'equals', enum: VALID_FILTER_OPERATORS })
  @IsIn([...VALID_FILTER_OPERATORS])
  operator: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  value?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  value2?: unknown;
}

export class FieldPermissionDto {
  @ApiProperty({ example: 'email' })
  @IsString()
  fieldSlug: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  canView: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  canEdit: boolean;
}

export class NotificationRuleDto {
  @ApiProperty({ default: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ default: true })
  @IsBoolean()
  onCreate: boolean;

  @ApiProperty({ default: true })
  @IsBoolean()
  onUpdate: boolean;

  @ApiProperty({ default: true })
  @IsBoolean()
  onDelete: boolean;

  @ApiPropertyOptional({ type: [DataFilterDto], description: 'Condicoes para disparar notificacao' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DataFilterDto)
  @IsOptional()
  conditions?: DataFilterDto[];
}

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

  @ApiPropertyOptional({ type: [FieldPermissionDto], description: 'Permissoes por campo (opcional)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldPermissionDto)
  @IsOptional()
  fieldPermissions?: FieldPermissionDto[];

  @ApiPropertyOptional({ type: [DataFilterDto], description: 'Filtros de dados por role nesta entidade' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DataFilterDto)
  @IsOptional()
  dataFilters?: DataFilterDto[];

  @ApiPropertyOptional({ type: NotificationRuleDto, description: 'Regras de notificacao para esta entidade' })
  @ValidateNested()
  @Type(() => NotificationRuleDto)
  @IsOptional()
  notificationRules?: NotificationRuleDto;

  @IsBoolean() @IsOptional() canExport?: boolean;
  @IsBoolean() @IsOptional() canImport?: boolean;
  @IsBoolean() @IsOptional() canConfigureColumns?: boolean;
}

export class ModulePermissionDto {
  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  canRead?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  canCreate?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  canUpdate?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  canDelete?: boolean;

  // Sub-granular actions
  @IsBoolean() @IsOptional() canActivate?: boolean;
  @IsBoolean() @IsOptional() canTest?: boolean;
  @IsBoolean() @IsOptional() canPublish?: boolean;
  @IsBoolean() @IsOptional() canDuplicate?: boolean;
  @IsBoolean() @IsOptional() canGenerate?: boolean;
  @IsBoolean() @IsOptional() canSuspend?: boolean;
  @IsBoolean() @IsOptional() canAssignRole?: boolean;
  @IsBoolean() @IsOptional() canChangeStatus?: boolean;
  @IsBoolean() @IsOptional() canSetDefault?: boolean;
  @IsBoolean() @IsOptional() canManagePermissions?: boolean;
  @IsBoolean() @IsOptional() canUpdateLayout?: boolean;
  @IsBoolean() @IsOptional() canCreateField?: boolean;
  @IsBoolean() @IsOptional() canDeleteField?: boolean;
  @IsBoolean() @IsOptional() canUpdateField?: boolean;
  @IsBoolean() @IsOptional() canConfigureColumns?: boolean;
  @IsBoolean() @IsOptional() canExport?: boolean;
  @IsBoolean() @IsOptional() canImport?: boolean;
}

export class ModulePermissionsDto {
  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  dashboard?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  users?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  settings?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  apis?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  pages?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  pdfTemplates?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  entities?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  tenants?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  data?: ModulePermissionDto;

  @ApiPropertyOptional({ type: ModulePermissionDto })
  @ValidateNested()
  @Type(() => ModulePermissionDto)
  @IsOptional()
  roles?: ModulePermissionDto;
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
  @ApiPropertyOptional({ description: 'Tenant ID (apenas PLATFORM_ADMIN pode especificar)' })
  @IsString()
  @IsOptional()
  tenantId?: string;

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
