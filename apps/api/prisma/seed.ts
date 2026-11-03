import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// O seed NAO cria mais tenant/cargo/usuario "platform" (superadmin@platform.com):
// poder de plataforma nao existe em cargos de tenant. Acesso ao console da
// plataforma (/admin) e criado com `pnpm platform:create-owner` (PlatformStaff OWNER).
// Empresas (tenants) nascem pelo cadastro self-service ou pelo console, que ja
// criam os cargos padrao (common/utils/default-roles.ts).

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

  console.log('\n===================================================');
  console.log('SEED COMPLETO!');
  console.log('===================================================');
  console.log('Acesso ao console da plataforma: pnpm platform:create-owner');
  console.log('Empresas: cadastro self-service (/register) ou console.');
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
