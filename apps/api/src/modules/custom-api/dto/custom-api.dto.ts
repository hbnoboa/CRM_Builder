import { IsString, IsOptional, IsBoolean, IsObject, IsEnum, IsArray, MinLength, Matches } from 'class-validator';

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

export class CreateCustomApiDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-\/]+$/, {
    message: 'Path deve conter apenas letras minúsculas, números, hífens e barras',
  })
  path: string;

  @IsEnum(HttpMethod)
  method: HttpMethod;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AuthType)
  @IsOptional()
  auth?: AuthType;

  @IsObject()
  @IsOptional()
  inputSchema?: object;

  @IsObject()
  @IsOptional()
  outputSchema?: object;

  @IsString()
  @IsOptional()
  logic?: string; // JavaScript/TypeScript code to execute

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
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-\/]+$/, {
    message: 'Path deve conter apenas letras minúsculas, números, hífens e barras',
  })
  @IsOptional()
  path?: string;

  @IsEnum(HttpMethod)
  @IsOptional()
  method?: HttpMethod;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AuthType)
  @IsOptional()
  auth?: AuthType;

  @IsObject()
  @IsOptional()
  inputSchema?: object;

  @IsObject()
  @IsOptional()
  outputSchema?: object;

  @IsString()
  @IsOptional()
  logic?: string;

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
