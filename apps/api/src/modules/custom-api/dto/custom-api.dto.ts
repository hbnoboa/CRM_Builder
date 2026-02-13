import { IsString, IsOptional, IsBoolean, IsObject, IsEnum, IsArray, MinLength, Matches, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export enum AuthType {
  NONE = 'NONE',
  API_KEY = 'API_KEY',
  JWT = 'JWT',
  BASIC = 'BASIC',
}

export enum ApiMode {
  VISUAL = 'visual',
  CODE = 'code',
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
}

// Filtro fixo (sempre aplicado)
export class FixedFilterDto {
  @IsString()
  field: string;

  @IsEnum(FilterOperator)
  operator: FilterOperator;

  @IsOptional()
  value?: any; // Valor fixo do filtro
}

// Parametro dinamico da URL
export class QueryParamDto {
  @IsString()
  field: string; // Campo da entidade

  @IsEnum(FilterOperator)
  operator: FilterOperator;

  @IsString()
  paramName: string; // Nome do parametro na URL (?paramName=value)

  @IsOptional()
  defaultValue?: any; // Valor padrao se parametro nao for enviado

  @IsBoolean()
  @IsOptional()
  required?: boolean; // Se o parametro e obrigatorio
}

// Ordenacao
export class OrderByDto {
  @IsString()
  field: string;

  @IsEnum(['asc', 'desc'])
  direction: 'asc' | 'desc';
}

export class CreateCustomApiDto {
  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-\/]+$/, {
    message: 'Path deve conter apenas letras minusculas, numeros, hifens e barras',
  })
  path: string;

  @IsEnum(HttpMethod)
  method: HttpMethod;

  @IsString()
  @IsOptional()
  description?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // Modo da API: visual ou code
  // ═══════════════════════════════════════════════════════════════════════════

  @IsEnum(ApiMode)
  @IsOptional()
  mode?: ApiMode;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODO VISUAL - Configuracao sem codigo
  // ═══════════════════════════════════════════════════════════════════════════

  @IsString()
  @IsOptional()
  sourceEntityId?: string; // ID da entidade fonte dos dados

  @IsArray()
  @IsOptional()
  selectedFields?: string[]; // Campos a retornar

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FixedFilterDto)
  @IsOptional()
  filters?: FixedFilterDto[]; // Filtros fixos

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryParamDto)
  @IsOptional()
  queryParams?: QueryParamDto[]; // Parametros dinamicos

  @ValidateNested()
  @Type(() => OrderByDto)
  @IsOptional()
  orderBy?: OrderByDto; // Ordenacao

  @IsNumber()
  @IsOptional()
  limitRecords?: number; // Limite de registros

  // ═══════════════════════════════════════════════════════════════════════════
  // MODO CODE - JavaScript customizado (avancado)
  // ═══════════════════════════════════════════════════════════════════════════

  @IsString()
  @IsOptional()
  logic?: string; // JavaScript/TypeScript code to execute

  // ═══════════════════════════════════════════════════════════════════════════
  // Configuracoes comuns
  // ═══════════════════════════════════════════════════════════════════════════

  @IsEnum(AuthType)
  @IsOptional()
  auth?: AuthType;

  @IsObject()
  @IsOptional()
  inputSchema?: object;

  @IsObject()
  @IsOptional()
  outputSchema?: object;

  @IsArray()
  @IsOptional()
  allowedRoles?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  rateLimitConfig?: {
    requests: number;
    windowMs: number;
  };
}

export class UpdateCustomApiDto {
  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-\/]+$/, {
    message: 'Path deve conter apenas letras minusculas, numeros, hifens e barras',
  })
  @IsOptional()
  path?: string;

  @IsEnum(HttpMethod)
  @IsOptional()
  method?: HttpMethod;

  @IsString()
  @IsOptional()
  description?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // Modo da API: visual ou code
  // ═══════════════════════════════════════════════════════════════════════════

  @IsEnum(ApiMode)
  @IsOptional()
  mode?: ApiMode;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODO VISUAL
  // ═══════════════════════════════════════════════════════════════════════════

  @IsString()
  @IsOptional()
  sourceEntityId?: string;

  @IsArray()
  @IsOptional()
  selectedFields?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FixedFilterDto)
  @IsOptional()
  filters?: FixedFilterDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryParamDto)
  @IsOptional()
  queryParams?: QueryParamDto[];

  @ValidateNested()
  @Type(() => OrderByDto)
  @IsOptional()
  orderBy?: OrderByDto;

  @IsNumber()
  @IsOptional()
  limitRecords?: number;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODO CODE
  // ═══════════════════════════════════════════════════════════════════════════

  @IsString()
  @IsOptional()
  logic?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // Configuracoes comuns
  // ═══════════════════════════════════════════════════════════════════════════

  @IsEnum(AuthType)
  @IsOptional()
  auth?: AuthType;

  @IsObject()
  @IsOptional()
  inputSchema?: object;

  @IsObject()
  @IsOptional()
  outputSchema?: object;

  @IsArray()
  @IsOptional()
  allowedRoles?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  rateLimitConfig?: {
    requests: number;
    windowMs: number;
  };
}

// Webhook DTOs
export class CreateWebhookDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  url: string;

  @IsString()
  event: string; // e.g., 'entity.created', 'entity.updated', 'entity.deleted'

  @IsString()
  @IsOptional()
  entitySlug?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsString()
  @IsOptional()
  secret?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsOptional()
  filters?: {
    field: string;
    operator: string;
    value: any;
  }[];
}

export class UpdateWebhookDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  event?: string;

  @IsString()
  @IsOptional()
  entitySlug?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsString()
  @IsOptional()
  secret?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsOptional()
  filters?: {
    field: string;
    operator: string;
    value: any;
  }[];
}
