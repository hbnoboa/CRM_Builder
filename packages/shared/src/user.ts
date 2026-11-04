import { Status } from './enums';
import { Tenant } from './tenant';
import { CustomRole } from './custom-role';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  customRoleId: string;
  customRole: CustomRole;
  status: Status;
  tenantId: string;
  tenant?: Tenant;
  permissions?: string[];
  /** Equipes na empresa atual (lista de usuarios). */
  teams?: Array<{ id: string; name: string; color: string | null; isLeader: boolean }>;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
