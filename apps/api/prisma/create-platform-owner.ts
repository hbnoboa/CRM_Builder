/**
 * Cria (ou reativa) o primeiro DONO da plataforma — quem entra em /admin.
 * Depois disso, o resto da equipe e criado pelo proprio console.
 *
 * Uso (na pasta apps/api):
 *   PLATFORM_OWNER_EMAIL=voce@empresa.com PLATFORM_OWNER_NAME="Seu Nome" \
 *   PLATFORM_OWNER_PASSWORD='SenhaForte123' pnpm platform:create-owner
 *
 * Dentro da imagem da API (sem ts-node), roda a versao compilada pelo build:
 *   docker exec -e PLATFORM_OWNER_EMAIL=... -e PLATFORM_OWNER_NAME=... \
 *     -e PLATFORM_OWNER_PASSWORD=... crm-api-dev node dist/prisma/create-platform-owner.js
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const email = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
  const name = process.env.PLATFORM_OWNER_NAME?.trim();
  const password = process.env.PLATFORM_OWNER_PASSWORD;

  if (!email || !name || !password) {
    throw new Error('Defina PLATFORM_OWNER_EMAIL, PLATFORM_OWNER_NAME e PLATFORM_OWNER_PASSWORD');
  }
  if (password.length < 10 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    throw new Error('Senha: minimo 10 caracteres, com maiuscula, minuscula e numero');
  }

  const prisma = new PrismaClient();
  try {
    const hashed = await bcrypt.hash(password, 12);
    const staff = await prisma.platformStaff.upsert({
      where: { email },
      update: { name, password: hashed, role: 'OWNER', status: 'ACTIVE', deletedAt: null },
      create: { email, name, password: hashed, role: 'OWNER' },
      select: { id: true, email: true, role: true },
    });
    console.log(`Dono da plataforma pronto: ${staff.email} (${staff.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
