const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Marisa', mode: 'insensitive' } }
  });

  // Buscar entity sem include (fields é JSON, não relation)
  const entity = await prisma.entity.findFirst({
    where: { tenantId: tenant.id, slug: 'seguradoras' }
  });

  console.log('=== ENTITY SEGURADORA ===');
  console.log('Campos definidos no schema da entity (entity.fields):');
  const fields = entity.fields;
  if (Array.isArray(fields)) {
    fields.forEach((f, idx) => {
      console.log(`  ${idx + 1}. "${f.name}" (${f.type})`);
    });
  }

  // Buscar um registro
  const record = await prisma.entityData.findFirst({
    where: { tenantId: tenant.id, entityId: entity.id }
  });

  console.log('\nCampos salvos no registro (Object.keys):');
  const dataKeys = Object.keys(record.data);
  dataKeys.forEach((key, idx) => {
    console.log(`  ${idx + 1}. "${key}"`);
  });

  console.log('\n⚠️ COMPARAÇÃO (Schema vs Dados):');
  if (Array.isArray(fields)) {
    fields.forEach(f => {
      const exists = dataKeys.includes(f.name);
      const status = exists ? '✅' : '❌';
      console.log(`  ${status} Schema: "${f.name}" -> ${exists ? `Dados: "${record.data[f.name]}"` : 'MISSING'}`);
    });
  }

  console.log('\n📋 Dados extras (não no schema):');
  dataKeys.forEach(key => {
    const inSchema = Array.isArray(fields) && fields.some(f => f.name === key);
    if (!inSchema) {
      console.log(`  ⚠️  "${key}" = ${record.data[key]}`);
    }
  });
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
