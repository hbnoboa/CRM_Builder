const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Buscar a entidade gerenciadores-risco
  const entity = await prisma.entity.findFirst({
    where: { slug: 'gerenciadores-risco' },
  });

  console.log('=== ENTIDADE ===');
  console.log('Nome:', entity.name);
  console.log('Slug:', entity.slug);
  console.log('Campos:', entity.fields?.length || 0);

  if (entity.fields && Array.isArray(entity.fields)) {
    console.log('\nCampos da entidade:');
    entity.fields.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name} (slug: ${f.slug}, type: ${f.type})`);
    });
  }

  // Buscar um registro de dados
  const record = await prisma.entityData.findFirst({
    where: { entityId: entity.id },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n=== REGISTRO DE DADOS ===');
  console.log('ID:', record.id);
  console.log('TenantID:', record.tenantId);
  console.log('Data type:', typeof record.data);
  console.log('Data keys:', record.data ? Object.keys(record.data) : 'null/undefined');
  console.log('\nData content:');
  console.log(JSON.stringify(record.data, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
