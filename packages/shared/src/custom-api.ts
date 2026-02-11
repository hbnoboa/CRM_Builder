import { HttpMethod, AuthType, ApiMode, FilterOperator } from './enums';

export interface FixedFilter {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface QueryParam {
  field: string;
  operator: FilterOperator;
  paramName: string;
  defaultValue?: unknown;
  required?: boolean;
}

export interface OrderByConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CustomApi {
  id: string;
  name: string;
  path: string;
  method: HttpMethod;
  description?: string;
  mode?: ApiMode;
  sourceEntityId?: string;
  sourceEntity?: {
    id: string;
    name: string;
    slug: string;
    fields?: unknown[];
  };
  selectedFields?: string[];
  filters?: FixedFilter[];
  queryParams?: QueryParam[];
  orderBy?: OrderByConfig;
  limitRecords?: number;
  logic?: string;
  code?: string;
  auth?: AuthType;
  requestSchema?: unknown;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}
