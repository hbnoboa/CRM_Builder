import { FieldType } from './enums';
import { Tenant } from './tenant';

export interface EntityField {
  slug: string;
  name: string;
  label?: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  default?: unknown;
  options?: Array<string | { value: string; label: string; color?: string }>;
  validation?: Record<string, unknown>;
  placeholder?: string;
  helpText?: string;

  // Grid positioning for form layout
  gridRow?: number;
  gridColSpan?: number;
  gridColStart?: number;

  // api-select specific
  apiEndpoint?: string;
  valueField?: string;
  labelField?: string;
  apiFields?: string[];
  autoFillFields?: Array<{
    sourceField: string;
    targetField: string;
  }>;

  // relation specific
  relatedEntityId?: string;
  relatedEntitySlug?: string;
  relatedDisplayField?: string;

  // number/currency specific
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;

  // text specific
  mask?: string;

  // map specific
  mapMode?: 'latlng' | 'address' | 'both';
  mapDefaultCenter?: [number, number];
  mapDefaultZoom?: number;
  mapHeight?: number;

  // sub-entity specific
  subEntityId?: string;
  subEntitySlug?: string;
  subEntityDisplayFields?: string[];
  parentDisplayField?: string; // Campo do pai para identificar o registro (fallback: id)

  // image/file specific
  imageSource?: 'camera' | 'gallery' | 'both';
  multiple?: boolean;
  maxFiles?: number;

  // Auto-fill on field change (for computed fields via custom-api)
  onChangeAutoFill?: Array<{
    targetField: string;      // Campo a ser preenchido
    apiEndpoint?: string;     // Endpoint do custom-api (opcional)
    valueTemplate?: string;   // Template de valor como {{now}} (opcional, usado se nao tiver apiEndpoint)
  }>;

  // zone-diagram specific
  diagramSaveMode?: 'object' | 'text'; // 'text' salva só o valor selecionado como string
  diagramImage?: string;
  diagramZones?: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    optionsSource: 'manual' | 'entity';
    options?: string[];
    sourceEntitySlug?: string;
    sourceFieldSlug?: string;
  }>;
}

export interface EntitySettings {
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  enableAudit?: boolean;
  softDelete?: boolean;
  /** Auto-capture GPS geolocation on every form submit */
  captureLocation?: boolean;
}

export interface Entity {
  id: string;
  tenantId: string;
  tenant?: Tenant;
  name: string;
  namePlural?: string;
  slug: string;
  icon?: string;
  color?: string;
  description?: string;
  fields: EntityField[];
  settings?: EntitySettings;
  isSystem?: boolean;
  _count?: {
    data: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

/** Alias para compatibilidade */
export type Field = EntityField;
