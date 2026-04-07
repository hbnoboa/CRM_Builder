const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Corrigindo widget de tabela do dashboard Sinistro - Tabela...\n');

  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Marisa', mode: 'insensitive' } }
  });

  const dashboard = await prisma.dashboardTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'Sinistro - Tabela'
    }
  });

  console.log('✅ Dashboard encontrado:', dashboard.name);

  // Campos principais para exibir na tabela de sinistros
  const displayFields = [
    'Nº Apólice',
    'Data/Hora do Evento',
    'Corretor',
    'Seguradora',
    'Segurado',
    'Causa',
    'Status',
    'Valor Nota',
    'Prejuízo',
    'Valor Indenizado',
    'Transportadora',
    'Motorista',
    'Placa',
    'Local do Evento'
  ];

  const widgets = dashboard.widgets;

  // Encontrar o widget de tabela
  let tableWidgetId = null;
  for (const [id, widget] of Object.entries(widgets)) {
    if (widget.type === 'data-table' || widget.type === 'table') {
      tableWidgetId = id;
      break;
    }
  }

  if (!tableWidgetId) {
    console.log('❌ Widget de tabela não encontrado!');
    return;
  }

  console.log('✅ Widget de tabela encontrado:', tableWidgetId);

  // Atualizar o widget com displayFields
  widgets[tableWidgetId] = {
    ...widgets[tableWidgetId],
    config: {
      ...widgets[tableWidgetId].config,
      displayFields,
      entitySlug: 'sinistros',
      showSearch: true,
      showFilters: true,
      showExport: true,
      pageSize: 25
    }
  };

  // Atualizar o dashboard
  await prisma.dashboardTemplate.update({
    where: { id: dashboard.id },
    data: { widgets }
  });

  console.log('\n✅ Widget atualizado com sucesso!');
  console.log(`\n📋 Campos visíveis configurados (${displayFields.length}):`);
  displayFields.forEach((field, idx) => {
    console.log(`  ${idx + 1}. ${field}`);
  });

  console.log('\n🎉 Agora a tabela deve mostrar os dados corretamente!');
  console.log('   Recarregue a página do dashboard para ver as mudanças.');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
