/**
 * Script de Migracao: UserRole Enum para CustomRole Only
 *
 * IMPORTANTE: Este script deve ser executado ANTES de aplicar a migracao
 * que remove o campo 'role' do modelo User.
 *
 * Este script migra o sistema de roles do enum UserRole para CustomRole.
 *
 * Passos:
 * 1. Criar tenant "IOS Risk" para PLATFORM_ADMIN
 * 2. Criar role PLATFORM_ADMIN no tenant IOS Risk
 * 3. Para cada tenant existente, criar roles de sistema (ADMIN, MANAGER, USER, VIEWER)
 * 4. Para cada usuario, atribuir customRoleId baseado no campo role atual
 * 5. Verificar que todos usuarios tem customRoleId
 *
 * Executar com: npx ts-node prisma/data-migrations/migrate-to-custom-roles.ts
 *
 * Apos executar este script com sucesso:
 * 1. Executar: pnpm db:migrate (para criar a migracao que remove role)
 * 2. Executar: pnpm db:push (para aplicar as mudancas)
 */

import { PrismaClient, Status } from '@prisma/client';

const prisma = new PrismaClient();

// Configuracao do tenant para PLATFORM_ADMIN
const PLATFORM_TENANT = {
  name: 'IOS Risk',
  slug: 'ios-risk',
};

// Definicao das roles de sistema
interface SystemRoleConfig {
  roleType: string;
  name: string;
  description: string;
  color: string;
  modulePermissions: Record<string, boolean>;
  tenantPermissions?: Record<string, unknown>;
  isDefault?: boolean;
}

const SYSTEM_ROLES: Record<string, SystemRoleConfig> = {
  PLATFORM_ADMIN: {
    roleType: 'PLATFORM_ADMIN',
    name: 'Super Admin',
    description: 'Super administrador com acesso total a plataforma',
    color: '#dc2626',
    modulePermissions: {
      dashboard: true,
      users: true,
      settings: true,
      apis: true,
      pages: true,
      entities: true,
    },
    tenantPermissions: {
      canAccessAllTenants: true,
      allowedTenantIds: [],
    },
  },
  ADMIN: {
    roleType: 'ADMIN',
    name: 'Administrador',
    description: 'Administrador do tenant com acesso completo',
    color: '#7c3aed',
    modulePermissions: {
      dashboard: true,
      users: true,
      settings: true,
      apis: true,
      pages: true,
      entities: true,
    },
  },
  MANAGER: {
    roleType: 'MANAGER',
    name: 'Gerente',
    description: 'Gerente com acesso a dados e equipe',
    color: '#2563eb',
    modulePermissions: {
      dashboard: true,
      users: true,
      settings: false,
      apis: false,
      pages: false,
      entities: false,
    },
  },
  USER: {
    roleType: 'USER',
    name: 'Usuario',
    description: 'Usuario padrao com acesso a dados proprios',
    color: '#059669',
    isDefault: true,
    modulePermissions: {
      dashboard: true,
      users: false,
      settings: false,
      apis: false,
      pages: false,
      entities: true,
    },
  },
  VIEWER: {
    roleType: 'VIEWER',
    name: 'Visualizador',
    description: 'Apenas visualizacao de dados',
    color: '#6b7280',
    modulePermissions: {
      dashboard: true,
      users: false,
      settings: false,
      apis: false,
      pages: false,
      entities: false,
    },
  },
};

/**
 * Cria ou retorna o tenant IOS Risk para PLATFORM_ADMIN
 */
async function getOrCreatePlatformTenant(): Promise<string> {
  let tenant = await prisma.tenant.findUnique({
    where: { slug: PLATFORM_TENANT.slug },
  });

  if (!tenant) {
    console.log(`Criando tenant "${PLATFORM_TENANT.name}"...`);
    tenant = await prisma.tenant.create({
      data: {
        name: PLATFORM_TENANT.name,
        slug: PLATFORM_TENANT.slug,
        status: Status.ACTIVE,
      },
    });
    console.log(`  Tenant criado: ${tenant.id}`);
  } else {
    console.log(`Tenant "${PLATFORM_TENANT.name}" ja existe: ${tenant.id}`);
  }

  return tenant.id;
}

/**
 * Cria uma role de sistema para um tenant
 */
async function createSystemRole(
  tenantId: string,
  config: SystemRoleConfig,
): Promise<string> {
  // Verificar se ja existe
  const existing = await prisma.customRole.findFirst({
    where: {
      tenantId,
      roleType: config.roleType,
      isSystem: true,
    },
  });

  if (existing) {
    console.log(`    Role ${config.roleType} ja existe: ${existing.id}`);
    return existing.id;
  }

  // Criar role
  const role = await prisma.customRole.create({
    data: {
      tenantId,
      name: config.name,
      description: config.description,
      color: config.color,
      roleType: config.roleType,
      isSystem: true,
      isDefault: config.isDefault || false,
      permissions: [],
      modulePermissions: config.modulePermissions,
      tenantPermissions: config.tenantPermissions || {},
    },
  });

  console.log(`    Role ${config.roleType} criada: ${role.id}`);
  return role.id;
}

/**
 * Cria roles de sistema para um tenant
 */
async function createSystemRolesForTenant(
  tenantId: string,
  isPlatformTenant: boolean,
): Promise<Map<string, string>> {
  const roleIdMap = new Map<string, string>();

  // Para tenant IOS Risk, criar apenas PLATFORM_ADMIN
  // Para outros tenants, criar ADMIN, MANAGER, USER, VIEWER
  const rolesToCreate = isPlatformTenant
    ? ['PLATFORM_ADMIN']
    : ['ADMIN', 'MANAGER', 'USER', 'VIEWER'];

  for (const roleKey of rolesToCreate) {
    const config = SYSTEM_ROLES[roleKey];
    const roleId = await createSystemRole(tenantId, config);
    roleIdMap.set(roleKey, roleId);
  }

  return roleIdMap;
}

/**
 * Migra usuarios existentes para CustomRole
 */
async function migrateUsers(): Promise<void> {
  // Buscar todos usuarios sem customRoleId
  const users = await prisma.user.findMany({
    where: { customRoleId: null },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
    },
  });

  console.log(`\nMigrando ${users.length} usuarios...`);

  // Cache de roleIds por tenant
  const tenantRoleCache = new Map<string, Map<string, string>>();

  for (const user of users) {
    // Buscar roleId para este tenant e role
    let roleMap = tenantRoleCache.get(user.tenantId);

    if (!roleMap) {
      // Buscar roles do tenant
      const roles = await prisma.customRole.findMany({
        where: {
          tenantId: user.tenantId,
          isSystem: true,
        },
        select: {
          id: true,
          roleType: true,
        },
      });

      roleMap = new Map();
      for (const role of roles) {
        roleMap.set(role.roleType, role.id);
      }
      tenantRoleCache.set(user.tenantId, roleMap);
    }

    // Mapear role enum para roleType
    const roleType = user.role; // PLATFORM_ADMIN, ADMIN, etc
    let targetRoleId = roleMap.get(roleType);

    // Se PLATFORM_ADMIN e nao encontrou no tenant atual, buscar no IOS Risk
    if (!targetRoleId && roleType === 'PLATFORM_ADMIN') {
      const platformTenant = await prisma.tenant.findUnique({
        where: { slug: PLATFORM_TENANT.slug },
      });

      if (platformTenant) {
        const platformAdminRole = await prisma.customRole.findFirst({
          where: {
            tenantId: platformTenant.id,
            roleType: 'PLATFORM_ADMIN',
            isSystem: true,
          },
        });

        if (platformAdminRole) {
          targetRoleId = platformAdminRole.id;

          // Mover usuario para tenant IOS Risk
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tenantId: platformTenant.id,
              customRoleId: targetRoleId,
            },
          });

          console.log(`  Usuario ${user.email} migrado para IOS Risk com PLATFORM_ADMIN`);
          continue;
        }
      }
    }

    if (!targetRoleId) {
      console.error(`  ERRO: Role ${roleType} nao encontrada para tenant ${user.tenantId}`);
      continue;
    }

    // Atualizar usuario
    await prisma.user.update({
      where: { id: user.id },
      data: { customRoleId: targetRoleId },
    });

    console.log(`  Usuario ${user.email} migrado para ${roleType}`);
  }
}

/**
 * Verifica se todos usuarios tem customRoleId
 */
async function verifyMigration(): Promise<boolean> {
  const usersWithoutRole = await prisma.user.count({
    where: { customRoleId: null },
  });

  if (usersWithoutRole > 0) {
    console.error(`\nERRO: ${usersWithoutRole} usuarios ainda sem customRoleId!`);
    return false;
  }

  console.log('\nTodos usuarios migrados com sucesso!');
  return true;
}

/**
 * Funcao principal
 */
async function main() {
  console.log('=====================================================');
  console.log('Migracao: UserRole Enum para CustomRole Only');
  console.log('=====================================================\n');

  try {
    // 1. Criar tenant IOS Risk
    console.log('Passo 1: Criando tenant IOS Risk...');
    const platformTenantId = await getOrCreatePlatformTenant();

    // 2. Criar role PLATFORM_ADMIN no tenant IOS Risk
    console.log('\nPasso 2: Criando role PLATFORM_ADMIN...');
    await createSystemRolesForTenant(platformTenantId, true);

    // 3. Buscar todos os outros tenants
    console.log('\nPasso 3: Criando roles de sistema para outros tenants...');
    const tenants = await prisma.tenant.findMany({
      where: { slug: { not: PLATFORM_TENANT.slug } },
    });

    for (const tenant of tenants) {
      console.log(`  Tenant: ${tenant.name} (${tenant.slug})`);
      await createSystemRolesForTenant(tenant.id, false);
    }

    // 4. Migrar usuarios
    console.log('\nPasso 4: Migrando usuarios...');
    await migrateUsers();

    // 5. Verificar migracao
    console.log('\nPasso 5: Verificando migracao...');
    const success = await verifyMigration();

    if (success) {
      console.log('\n=====================================================');
      console.log('MIGRACAO CONCLUIDA COM SUCESSO!');
      console.log('=====================================================');
      console.log('\nProximos passos:');
      console.log('1. Executar: npx prisma migrate dev --name remove_user_role');
      console.log('2. Alterar customRoleId para NOT NULL no schema');
      console.log('3. Remover campo role e enum UserRole do schema');
      console.log('=====================================================\n');
    } else {
      console.log('\n=====================================================');
      console.log('MIGRACAO FALHOU!');
      console.log('Verifique os erros acima e corrija antes de continuar.');
      console.log('=====================================================\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\nErro durante migracao:', error);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
