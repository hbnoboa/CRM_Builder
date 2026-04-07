const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('=== TESTE DE RESPOSTA DA API ===\n');

  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Marisa', mode: 'insensitive' } }
  });

  // Testar cada entity como a API retornaria
  const entities = [
    { slug: 'seguradoras', limit: 2 },
    { slug: 'corretores', limit: 2 },
    { slug: 'sinistros', limit: 1 }
  ];

  for (const { slug, limit } of entities) {
    const entity = await prisma.entity.findFirst({
      where: { tenantId: tenant.id, slug }
    });

    if (!entity) continue;

    const records = await prisma.entityData.findMany({
      where: { tenantId: tenant.id, entityId: entity.id },
      take: limit
    });

    console.log(`━━━ ${entity.name.toUpperCase()} ━━━`);
    console.log(`Total: ${await prisma.entityData.count({ where: { tenantId: tenant.id, entityId: entity.id } })}`);
    console.log(`\nResposta simulada da API (como JSON):\n`);

    const apiResponse = {
      data: records.map(r => ({
        id: r.id,
        ...r.data,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      })),
      meta: {
        total: await prisma.entityData.count({ where: { tenantId: tenant.id, entityId: entity.id } }),
        page: 1,
        limit
      }
    };

    console.log(JSON.stringify(apiResponse, null, 2));
    console.log('\n');
  }

  // Verificar se há algum problema de encoding ou caracteres especiais
  console.log('━━━ TESTE DE ENCODING ━━━');
  const seguradora = await prisma.entityData.findFirst({
    where: {
      tenantId: tenant.id,
      entity: { slug: 'seguradoras' }
    }
  });

  console.log('\nValores RAW (sem JSON.stringify):');
  const data = seguradora.data;
  for (const [key, value] of Object.entries(data)) {
    console.log(`${key}: ${value}`);
    console.log(`  - Tipo: ${typeof value}`);
    console.log(`  - Length: ${typeof value === 'string' ? value.length : 'N/A'}`);
    console.log(`  - É vazio: ${value === '' ? 'SIM' : 'NÃO'}`);
    console.log(`  - É null: ${value === null ? 'SIM' : 'NÃO'}`);
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
