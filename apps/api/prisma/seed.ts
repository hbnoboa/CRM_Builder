import { PrismaClient, UserRole, Status, Plan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Criar Platform Admin (Super Admin)
  const platformAdminPassword = await bcrypt.hash('superadmin123', 12);

  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    update: {},
    create: {
      name: 'Platform',
      slug: 'platform',
      plan: Plan.ENTERPRISE,
      status: Status.ACTIVE,
    },
  });

  const platformAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: platformTenant.id,
        email: 'superadmin@platform.com',
      },
    },
    update: {},
    create: {
      tenantId: platformTenant.id,
      email: 'superadmin@platform.com',
      password: platformAdminPassword,
      name: 'Super Admin',
      role: UserRole.PLATFORM_ADMIN,
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
