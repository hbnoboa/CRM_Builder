import { PrismaClient, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// CRUD module permission helpers
const FULL = { canRead: true, canCreate: true, canUpdate: true, canDelete: true };
const READ_ONLY = { canRead: true, canCreate: false, canUpdate: false, canDelete: false };
const NONE = { canRead: false, canCreate: false, canUpdate: false, canDelete: false };

// Configuracao de roles de sistema
const SYSTEM_ROLES = {
  PLATFORM_ADMIN: {
    name: 'Super Admin',
    description: 'Super administrador com acesso total a plataforma',
    color: '#dc2626',
    roleType: 'PLATFORM_ADMIN',
    isSystem: true,
    modulePermissions: { dashboard: FULL, users: FULL, settings: FULL, apis: FULL, pages: FULL, entities: FULL, tenants: FULL },
    tenantPermissions: { canAccessAllTenants: true },
  },
  ADMIN: {
    name: 'Administrador',
    description: 'Administrador do tenant com acesso completo',
    color: '#7c3aed',
    roleType: 'ADMIN',
    isSystem: true,
    modulePermissions: { dashboard: FULL, users: FULL, settings: FULL, apis: FULL, pages: FULL, entities: FULL, tenants: NONE },
  },
  MANAGER: {
    name: 'Gerente',
    description: 'Gerente com acesso a dados e equipe',
    color: '#2563eb',
    roleType: 'MANAGER',
    isSystem: true,
    modulePermissions: { dashboard: READ_ONLY, users: READ_ONLY, settings: NONE, apis: NONE, pages: NONE, entities: NONE, tenants: NONE },
  },
  USER: {
    name: 'Usuario',
    description: 'Usuario padrao com acesso a dados proprios',
    color: '#059669',
    roleType: 'USER',
    isSystem: true,
    isDefault: true,
    modulePermissions: { dashboard: READ_ONLY, users: NONE, settings: NONE, apis: NONE, pages: NONE, entities: { canRead: true, canCreate: true, canUpdate: true, canDelete: false }, tenants: NONE },
  },
  VIEWER: {
    name: 'Visualizador',
    description: 'Apenas visualizacao de dados',
    color: '#6b7280',
    roleType: 'VIEWER',
    isSystem: true,
    modulePermissions: { dashboard: READ_ONLY, users: NONE, settings: NONE, apis: NONE, pages: NONE, entities: NONE, tenants: NONE },
  },
};

async function createSystemRolesForTenant(tenantId: string, excludePlatformAdmin = true) {
  const roles: Record<string, string> = {};

  for (const [roleType, config] of Object.entries(SYSTEM_ROLES)) {
    // Pular PLATFORM_ADMIN para tenants normais
    if (excludePlatformAdmin && roleType === 'PLATFORM_ADMIN') continue;

    const role = await prisma.customRole.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: config.name,
        },
      },
      update: {},
      create: {
        tenantId,
        name: config.name,
        description: config.description,
        color: config.color,
        roleType: config.roleType,
        isSystem: true,
        isDefault: (config as { isDefault?: boolean }).isDefault || false,
        permissions: [],
        modulePermissions: config.modulePermissions,
        tenantPermissions: (config as { tenantPermissions?: object }).tenantPermissions || {},
      },
    });

    roles[roleType] = role.id;
  }

  return roles;
}

async function main() {
  console.log('Iniciando seed...');

  // Limpar banco antes de popular
  console.log('Limpando banco de dados...');
  await prisma.entityData.deleteMany();
  await prisma.customEndpoint.deleteMany();
  await prisma.page.deleteMany();
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
      name: SYSTEM_ROLES.PLATFORM_ADMIN.name,
      description: SYSTEM_ROLES.PLATFORM_ADMIN.description,
      color: SYSTEM_ROLES.PLATFORM_ADMIN.color,
      roleType: 'PLATFORM_ADMIN',
      isSystem: true,
      isDefault: false,
      permissions: [],
      modulePermissions: SYSTEM_ROLES.PLATFORM_ADMIN.modulePermissions,
      tenantPermissions: SYSTEM_ROLES.PLATFORM_ADMIN.tenantPermissions,
    },
  });

  console.log('Role PLATFORM_ADMIN criada.');

  // Criar tambem as outras roles de sistema para o Platform tenant
  await createSystemRolesForTenant(platformTenant.id, true);
  console.log('Roles de sistema criadas para Platform tenant.');

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
  console.log('\nCredenciais:');
  console.log('');
  console.log('SUPER ADMIN:');
  console.log('   Email: superadmin@platform.com');
  console.log('   Senha: superadmin123');
  console.log('');
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
