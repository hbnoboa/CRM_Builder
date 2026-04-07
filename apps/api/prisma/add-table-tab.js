const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Buscando tenant Marisa Dilda...');
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Marisa', mode: 'insensitive' } },
  });

  if (!tenant) {
    throw new Error('Tenant não encontrado');
  }
  console.log(`✅ Tenant: ${tenant.name}`);

  console.log('\n🔍 Buscando dashboard Sinistro - Tabela...');
  const dashboard = await prisma.dashboardTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'Sinistro - Tabela',
    },
  });

  if (!dashboard) {
    throw new Error('Dashboard não encontrado');
  }
  console.log(`✅ Dashboard: ${dashboard.name}`);

  const currentTabs = dashboard.tabs || [];
  const currentWidgets = dashboard.widgets || {};
  const currentLayout = dashboard.layout || [];

  // Criar widget de tabela
  const tableWidgetId = `widget-table-${Date.now()}`;
  const tableWidget = {
    type: 'table',
    title: 'Tabela de Sinistros',
    config: {
      entitySlug: 'sinistros',
      showSearch: true,
      showFilters: true,
      showExport: true,
      pageSize: 25,
    },
  };

  // Criar tab de tabela
  const tableTabId = `tab-table-${Date.now()}`;
  const tableTab = {
    id: tableTabId,
    label: 'Tabela',
    icon: 'Table',
    widgetIds: [tableWidgetId],
  };

  // Adicionar widget ao layout (primeira posição)
  const tableLayoutItem = {
    i: tableWidgetId,
    x: 0,
    y: 0,
    w: 12,
    h: 8,
    minW: 6,
    minH: 4,
  };

  // Montar novos arrays com tab de tabela como primeira
  const newTabs = [tableTab, ...currentTabs];
  const newWidgets = {
    [tableWidgetId]: tableWidget,
    ...currentWidgets,
  };
  const newLayout = [tableLayoutItem, ...currentLayout];

  // Atualizar dashboard
  await prisma.dashboardTemplate.update({
    where: { id: dashboard.id },
    data: {
      tabs: newTabs,
      widgets: newWidgets,
      layout: newLayout,
    },
  });

  console.log('\n✅ Tab de tabela adicionada como primeira aba!');
  console.log(`   Total de tabs: ${newTabs.length}`);
  console.log(`   Total de widgets: ${Object.keys(newWidgets).length}`);
  console.log('\n📋 Tabs do dashboard:');
  newTabs.forEach((tab, idx) => {
    console.log(`   ${idx + 1}. ${tab.label} (${tab.widgetIds.length} widgets)`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
