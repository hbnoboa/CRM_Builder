import { Status } from './enums';
import { Tenant } from './tenant';
import { CustomRole } from './custom-role';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  customRoleId: string;
  customRole: CustomRole;
  status: Status;
  tenantId: string;
  tenant?: Tenant;
  permissions?: string[];
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
