const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Marisa', mode: 'insensitive' } }
  });

  console.log('=== ANÁLISE PROFUNDA - TENANT MARISA DILDA ===\n');

  const entities = ['seguradoras', 'corretores', 'transportadoras', 'reguladoras', 'gerenciadores-risco', 'segurados', 'sinistros', 'sinistro-followups'];

  for (const slug of entities) {
    const entity = await prisma.entity.findFirst({
      where: { tenantId: tenant.id, slug }
    });

    if (!entity) continue;

    const total = await prisma.entityData.count({
      where: { tenantId: tenant.id, entityId: entity.id }
    });

    const records = await prisma.entityData.findMany({
      where: { tenantId: tenant.id, entityId: entity.id },
      take: 3
    });

    console.log(`━━━ ${entity.name.toUpperCase()} ━━━`);
    console.log(`Total de registros: ${total}`);

    if (records.length > 0) {
      const sample = records[0];
      const data = sample.data;
      const keys = Object.keys(data);

      console.log(`Campos no primeiro registro: ${keys.length}`);

      // Verificar campos vazios
      let emptyCount = 0;
      let filledCount = 0;
      const emptyFields = [];
      const filledFields = [];

      for (const key of keys) {
        const value = data[key];
        if (value === '' || value === null || value === undefined || value === '-') {
          emptyCount++;
          emptyFields.push(key);
        } else {
          filledCount++;
          const valueStr = typeof value === 'object'
            ? JSON.stringify(value).substring(0, 50)
            : String(value).substring(0, 50);
          filledFields.push({ field: key, value: valueStr });
        }
      }

      console.log(`  ✅ Campos preenchidos: ${filledCount}`);
      console.log(`  ❌ Campos vazios/nulos: ${emptyCount}`);

      if (filledCount > 0) {
        console.log(`  Exemplos de campos preenchidos (primeiros 5):`);
        filledFields.slice(0, 5).forEach(f => {
          console.log(`    - ${f.field}: ${f.value}`);
        });
      }

      if (emptyCount > 0) {
        console.log(`  Campos vazios: ${emptyFields.slice(0, 10).join(', ')}${emptyFields.length > 10 ? '...' : ''}`);
      }

      console.log('');
    } else {
      console.log('  ⚠️  Nenhum registro encontrado\n');
    }
  }

  // Análise detalhada de 1 sinistro completo
  console.log('\n━━━ ANÁLISE DETALHADA DE 1 SINISTRO ━━━');
  const sinistroEntity = await prisma.entity.findFirst({
    where: { tenantId: tenant.id, slug: 'sinistros' }
  });

  const sinistro = await prisma.entityData.findFirst({
    where: { tenantId: tenant.id, entityId: sinistroEntity.id }
  });

  if (sinistro) {
    console.log('\nTODOS OS CAMPOS E VALORES:');
    const data = sinistro.data;
    const sortedKeys = Object.keys(data).sort();

    sortedKeys.forEach((key, idx) => {
      const value = data[key];
      let displayValue;

      if (value === null || value === undefined) {
        displayValue = '[NULO]';
      } else if (value === '') {
        displayValue = '[VAZIO]';
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      } else {
        displayValue = String(value);
      }

      console.log(`${(idx + 1).toString().padStart(3, ' ')}. ${key.padEnd(30, ' ')} = ${displayValue}`);
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
