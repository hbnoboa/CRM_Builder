const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Buscando tenant Marisa Dilda...');
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Marisa', mode: 'insensitive' } },
  });

  if (!tenant) {
    throw new Error('Tenant Marisa Dilda não encontrado');
  }
  console.log(`✅ Tenant encontrado: ${tenant.name} (${tenant.id})`);

  console.log('\n🔍 Buscando entity Sinistros...');
  const entity = await prisma.entity.findFirst({
    where: {
      tenantId: tenant.id,
      slug: 'sinistros',
    },
  });

  if (!entity) {
    throw new Error('Entity Sinistros não encontrada');
  }
  console.log(`✅ Entity encontrada: ${entity.name} (${entity.slug})`);

  console.log('\n🔍 Buscando dashboard source (iOS Risk - Dashboard Completo)...');
  const sourceDashboard = await prisma.dashboardTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      name: { contains: 'iOS Risk - Dashboard Completo', mode: 'insensitive' },
    },
  });

  if (!sourceDashboard) {
    throw new Error('Dashboard source não encontrado');
  }
  console.log(`✅ Dashboard source: ${sourceDashboard.name}`);

  console.log('\n🔍 Buscando dashboard target (Sinistro - Tabela)...');
  let targetDashboard = await prisma.dashboardTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'Sinistro - Tabela',
    },
  });

  if (!targetDashboard) {
    console.log('⚠️  Dashboard target não encontrado');
    throw new Error('Dashboard "Sinistro - Tabela" não encontrado. Por favor, crie-o primeiro via interface.');
  } else {
    console.log(`✅ Dashboard target: ${targetDashboard.name}`);
  }

  console.log('\n📋 Copiando widgets e tabs do dashboard source...');
  const sourceLayout = sourceDashboard.layout;
  const sourceWidgets = sourceDashboard.widgets;
  const sourceTabs = sourceDashboard.tabs;

  const targetLayout = targetDashboard.layout;
  const targetWidgets = targetDashboard.widgets;
  const targetTabs = targetDashboard.tabs;

  if (!sourceTabs || sourceTabs.length === 0) {
    console.log('⚠️  Dashboard source não tem tabs/widgets para copiar');
    return;
  }

  // Copiar todas as tabs e widgets do source para o target
  const newTabs = sourceTabs.map((tab) => ({
    ...tab,
    id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }));

  const mergedLayout = Array.isArray(targetLayout) ? [...targetLayout, ...sourceLayout] : sourceLayout;
  const mergedWidgets = { ...targetWidgets, ...sourceWidgets };
  const mergedTabs = Array.isArray(targetTabs) ? [...targetTabs, ...newTabs] : newTabs;

  await prisma.dashboardTemplate.update({
    where: { id: targetDashboard.id },
    data: {
      layout: mergedLayout,
      widgets: mergedWidgets,
      tabs: mergedTabs,
    },
  });

  console.log(`✅ ${newTabs.length} tabs copiadas com sucesso!`);
  console.log(`   Total de tabs no dashboard: ${mergedTabs.length}`);
  console.log(`   Total de widgets: ${Object.keys(mergedWidgets).length}`);

  console.log('\n✅ Operação concluída!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
