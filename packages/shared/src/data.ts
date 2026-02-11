import { Tenant } from './tenant';

export interface EntityData {
  id: string;
  entityId: string;
  tenantId: string;
  tenant?: Tenant;
  data: Record<string, unknown>;
  createdById: string;
  updatedById: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}
