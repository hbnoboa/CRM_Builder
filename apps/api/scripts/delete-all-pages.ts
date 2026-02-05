import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllPages() {
  console.log('=== DELETANDO TODAS AS PÁGINAS ===\n');
  
  // Lista todas as páginas antes de deletar
  const pages = await prisma.page.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      tenantId: true,
    },
    orderBy: { title: 'asc' },
  });
  
  console.log(`Total de páginas encontradas: ${pages.length}\n`);
  
  if (pages.length === 0) {
    console.log('Nenhuma página para deletar.');
    return;
  }
  
  console.log('Páginas que serão deletadas:');
  for (const page of pages) {
    console.log(`  - "${page.title}" (slug: ${page.slug})`);
  }
  
  console.log('\n--- Deletando páginas... ---\n');
  
  // Deleta todas as páginas
  const result = await prisma.page.deleteMany({});
  
  console.log(`✅ ${result.count} páginas deletadas com sucesso!`);
}

deleteAllPages()
  .catch((error) => {
    console.error('Erro ao deletar páginas:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
