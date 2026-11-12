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
  /** Portal do cliente: a pessoa entra como cliente (ve so o que e dela; sem chat, suporte e plano). */
  clientPortal?: boolean;
  /** Portal do cliente: registro do cliente que a pessoa representa (lista de usuarios). */
  clientRecordId?: string | null;
  /** Equipes na empresa atual (lista de usuarios). */
  teams?: Array<{ id: string; name: string; color: string | null; isLeader: boolean }>;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
