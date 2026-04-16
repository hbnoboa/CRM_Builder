import { PrismaClient, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// CRUD module permission helpers
const FULL = { canRead: true, canCreate: true, canUpdate: true, canDelete: true };
const READ_ONLY = { canRead: true, canCreate: false, canUpdate: false, canDelete: false };
const NONE = { canRead: false, canCreate: false, canUpdate: false, canDelete: false };

// Helpers para permissoes de modulo especificas
const PDF_READ_GENERATE = { canRead: true, canCreate: false, canUpdate: false, canDelete: false, canGenerate: true };

// Configuracao APENAS de PLATFORM_ADMIN
// Todos os outros roles devem ser criados via interface (customizados)
const PLATFORM_ADMIN_CONFIG = {
  name: 'Super Admin',
  description: 'Super administrador com acesso total a plataforma',
  color: '#dc2626',
  roleType: 'PLATFORM_ADMIN',
  isSystem: true,
  // PLATFORM_ADMIN tem acesso a TODOS os modulos
  modulePermissions: {
    dashboard: FULL,
    users: FULL,
    settings: FULL,
    entities: FULL,
    tenants: FULL,
    data: FULL,
    roles: FULL,
    automations: {
      ...FULL,
      canExecute: true,
      // Sub-permissões para automações
      webhooks: FULL,
      actionChains: FULL,
      entityAutomation: FULL,
    },
    templates: {
      ...FULL,
      canGenerate: true,
      // Sub-permissões para templates
      pdfTemplates: FULL,
      emailTemplates: FULL,
    },
    logs: {
      ...READ_ONLY,
      // Sub-permissões para logs
      auditLogs: READ_ONLY,
      executionLogs: READ_ONLY,
    },
    notifications: FULL,
    publicLinks: FULL,
    archive: FULL,
  },
  tenantPermissions: { canAccessAllTenants: true },
};

async function main() {
  console.log('Iniciando seed...');

  // Limpar banco antes de popular
  console.log('Limpando banco de dados...');
  await prisma.entityData.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customRole.deleteMany();
  await prisma.tenant.deleteMany();
  console.log('Banco limpo.');

  // Criar Platform Tenant
  const platformTenant = await prisma.tenant.create({
    data: {
      name: 'Platform',
      slug: 'platform',
      status: Status.ACTIVE,
    },
  });

  console.log('Tenant Platform criado.');

  // Criar role PLATFORM_ADMIN para o Platform tenant
  const platformAdminRole = await prisma.customRole.create({
    data: {
      tenantId: platformTenant.id,
      name: PLATFORM_ADMIN_CONFIG.name,
      description: PLATFORM_ADMIN_CONFIG.description,
      color: PLATFORM_ADMIN_CONFIG.color,
      roleType: 'PLATFORM_ADMIN',
      isSystem: true,
      isDefault: false,
      permissions: [],
      modulePermissions: PLATFORM_ADMIN_CONFIG.modulePermissions,
      tenantPermissions: PLATFORM_ADMIN_CONFIG.tenantPermissions,
    },
  });

  console.log('Role PLATFORM_ADMIN criada.');
  console.log('IMPORTANTE: Nenhuma outra role pre-definida foi criada.');
  console.log('Crie roles customizadas via interface para outros usuarios.');

  // Criar Platform Admin user
  const platformAdminPassword = await bcrypt.hash('superadmin123', 12);

  const platformAdmin = await prisma.user.create({
    data: {
      tenantId: platformTenant.id,
      email: 'superadmin@platform.com',
      password: platformAdminPassword,
      name: 'Super Admin',
      customRoleId: platformAdminRole.id,
      status: Status.ACTIVE,
    },
  });

  console.log('Platform Admin criado:', platformAdmin.email);

  console.log('\n===================================================');
  console.log('SEED COMPLETO!');
  console.log('===================================================');
  console.log('Credenciais padroes foram configuradas.');
  console.log('Consulte a documentacao para detalhes de acesso.');
  console.log('===================================================\n');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
