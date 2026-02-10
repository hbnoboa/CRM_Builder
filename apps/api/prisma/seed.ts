import { PrismaClient, UserRole, Status, Plan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
  await prisma.tenant.deleteMany();
  console.log('Banco limpo.');

  // Criar Platform Tenant + Super Admin
  const platformAdminPassword = await bcrypt.hash('superadmin123', 12);

  const platformTenant = await prisma.tenant.create({
    data: {
      name: 'Platform',
      slug: 'platform',
      plan: Plan.ENTERPRISE,
      status: Status.ACTIVE,
    },
  });

  const platformAdmin = await prisma.user.create({
    data: {
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
