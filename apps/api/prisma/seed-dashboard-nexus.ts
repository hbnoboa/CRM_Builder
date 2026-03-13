/**
 * Seed: Dashboard Nexus — Inspeção Veicular (Completo)
 *
 * Template único com 26 widgets cobrindo todas as seções do layout Nexus:
 *   1. Registros (data-table completa com CRUD)
 *   2. Visão Geral (KPIs + KPI ratio + tendência com referenceLines + tabela)
 *   3. Operação (stacked-bar modelo×marca + donut marca + situação + tipos dano)
 *   4. Não-Conformidades (heatmap peça×tipo + responsabilidade + treemap peças)
 *   5. Ficha Veículo (tabelas detalhadas + atividade + galeria imagens)
 *
 * Uso: DATABASE_URL="..." npx ts-node prisma/seed-dashboard-nexus.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Encontrar a entidade "veiculos" para descobrir os tenants
  const veiculoEntities = await prisma.entity.findMany({
    where: { slug: 'veiculos' },
    select: { id: true, tenantId: true, slug: true },
  });

  if (veiculoEntities.length === 0) {
    console.error('Entidade "veiculos" nao encontrada.');
    process.exit(1);
  }

  // Para cada tenant, contar registros e pegar o com mais dados
  let bestTenant = veiculoEntities[0];
  let bestCount = 0;
  for (const entity of veiculoEntities) {
    const count = await prisma.entityData.count({ where: { entityId: entity.id } });
    if (count > bestCount) {
      bestCount = count;
      bestTenant = entity;
    }
  }

  const tenantId = bestTenant.tenantId;
  console.log(`Tenant encontrado: ${tenantId} (${bestCount} veiculos)`);

  // ═══════════════════════════════════════════════════════════════════════
  // WIDGETS: 25 widgets — layout Nexus single-page
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Campos veiculos:   chassi, marca, modelo, navio, viagem, local,
  //                    situacao(select), concluido(bool), fotos(file)
  // Campos NCs:        peca, tipo(select), nivel(select), quadrante(select),
  //                    medida(select), local(select)
  //
  // Novos widgets: grouped-bar, zone-diagram, image-gallery
  // Novos configs: referenceLines (line-tendencia), ratioMode (kpi-ratio-nc)
  // ═══════════════════════════════════════════════════════════════════════

  const widgets: Record<string, object> = {
    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 1: VISÃO GERAL — KPIs (y=0)
    // ─────────────────────────────────────────────────────────────────────

    'kpi-veiculos': {
      type: 'kpi-card',
      title: 'Veículos',
      config: {
        aggregation: 'count',
        showComparison: true,
        comparisonPeriod: 30,
      },
    },

    'kpi-ncs': {
      type: 'kpi-card',
      title: 'Não-Conformidades',
      config: {
        entitySlugOverride: 'nao-conformidades',
        aggregation: 'count',
        showComparison: true,
        comparisonPeriod: 30,
      },
    },

    'number-ncs': {
      type: 'number-card',
      title: 'Total NCs',
      config: {
        entitySlugOverride: 'nao-conformidades',
        aggregation: 'count',
      },
    },

    'kpi-variacao': {
      type: 'kpi-card',
      title: 'Variação Semanal',
      config: {
        aggregation: 'count',
        showComparison: true,
        comparisonPeriod: 7,
      },
    },

    'kpi-ratio-nc': {
      type: 'kpi-card',
      title: '% NC / Veículo',
      config: {
        entitySlugOverride: 'nao-conformidades',
        fieldSlug: 'count',
        aggregation: 'count',
        ratioFieldSlug: 'count',
        ratioMode: 'percentage',
        ratioEntitySlug: 'veiculos',
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 2: OPERAÇÃO — Modelo × Marca + Proporção + Situação (y=3)
    // ─────────────────────────────────────────────────────────────────────

    'stacked-modelo-marca': {
      type: 'stacked-bar-chart',
      title: 'Veículos por Modelo × Marca',
      config: {
        groupByField: 'modelo',
        columnField: 'marca',
        limit: 10,
        chartColors: ['#1C69D4', '#FF5722', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'],
      },
    },

    'donut-marca': {
      type: 'donut-chart',
      title: 'Proporção por Marca',
      config: {
        dataSource: 'field-distribution',
        groupByField: 'marca',
        showLegend: true,
        chartColors: ['#1C69D4', '#FF5722', '#10B981', '#F59E0B', '#8B5CF6'],
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 3: Situação + Tipos de Dano + Tendência (y=11)
    // ─────────────────────────────────────────────────────────────────────

    'bar-situacao': {
      type: 'bar-chart',
      title: 'Situação dos Veículos',
      config: {
        dataSource: 'field-distribution',
        groupByField: 'situacao',
        chartColor: '#10B981',
      },
    },

    'bar-tipo-dano': {
      type: 'bar-chart',
      title: 'Top Tipos de Dano',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'tipo',
        chartColor: '#3B82F6',
      },
    },

    'line-tendencia': {
      type: 'line-chart',
      title: 'Tendência de Registros',
      config: {
        dataSource: 'records-over-time',
        days: 90,
        chartColor: '#3B82F6',
        thresholds: { warn: 5, danger: 7 },
        referenceLines: [
          { value: 50, label: 'Meta mensal', color: '#EF4444', strokeDasharray: '5 5' },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 4: NÃO-CONFORMIDADES — Heatmap + Responsabilidade (y=18)
    // ─────────────────────────────────────────────────────────────────────

    'bar-local-nc': {
      type: 'bar-chart',
      title: 'Responsabilidade pelo Dano',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'local',
        chartColor: '#EF4444',
      },
    },

    'heatmap-peca-tipo': {
      type: 'heatmap-chart',
      title: 'Heatmap: Peça × Tipo de Dano',
      config: {
        entitySlugOverride: 'nao-conformidades',
        rowField: 'peca',
        columnField: 'tipo',
        showValues: true,
        colorScale: ['#132033', '#0A7AFF'],
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 5: Tamanho + Gravidade + Treemap Peças (y=26)
    // ─────────────────────────────────────────────────────────────────────

    'column-medida': {
      type: 'column-chart',
      title: 'Por Tamanho do Dano',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'medida',
        chartColor: '#0A7AFF',
      },
    },

    'bar-nivel': {
      type: 'bar-chart',
      title: 'Por Nível de Gravidade',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'nivel',
        chartColors: ['#EF5350', '#FFA726', '#FFEE58', '#66BB6A', '#5A7A94'],
      },
    },

    'treemap-peca': {
      type: 'treemap-chart',
      title: 'Peças Mais Afetadas',
      config: {
        entitySlugOverride: 'nao-conformidades',
        groupByField: 'peca',
        chartColors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'],
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 6: COMPARATIVO — Stacked viagem + Scatter + Donut nível (y=33)
    // ─────────────────────────────────────────────────────────────────────

    'grouped-viagem-marca': {
      type: 'grouped-bar-chart',
      title: 'Comparativo por Operação × Marca',
      config: {
        groupByField: 'viagem',
        columnField: 'marca',
        limit: 10,
        chartColors: ['#1C69D4', '#FF5722', '#10B981', '#F59E0B'],
      },
    },

    'scatter-quadrante-nivel': {
      type: 'scatter-chart',
      title: 'Dispersão: Quadrante × Nível',
      config: {
        entitySlugOverride: 'nao-conformidades',
        rowField: 'quadrante',
        columnField: 'nivel',
        chartColors: ['#0A7AFF'],
      },
    },

    'donut-nivel': {
      type: 'donut-chart',
      title: 'NCs por Gravidade',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'nivel',
        showLegend: true,
        chartColors: ['#EF5350', '#FFA726', '#FFEE58', '#66BB6A', '#5A7A94'],
      },
    },

    'resumo-ncs': {
      type: 'stat-list',
      title: 'Resumo NCs',
      config: {
        entitySlugOverride: 'nao-conformidades',
        groupByField: 'nivel',
        listStyle: 'colored',
        showTotal: true,
        chartColors: ['#EF5350', '#FFA726', '#FFEE58', '#66BB6A', '#5A7A94'],
      },
    },

    'zone-quadrante': {
      type: 'zone-diagram',
      title: 'Mapa de Quadrantes NC',
      config: {
        entitySlugOverride: 'nao-conformidades',
        zoneField: 'quadrante',
        zoneLabels: {
          'q1': 'Frente Esq', 'q2': 'Frente Centro', 'q3': 'Frente Dir',
          'q4': 'Meio Esq', 'q5': 'Meio Centro', 'q6': 'Meio Dir',
          'q7': 'Tras Esq', 'q8': 'Tras Centro', 'q9': 'Tras Dir',
        },
      },
    },

    'gallery-fotos': {
      type: 'image-gallery',
      title: 'Fotos',
      config: {
        imageFields: ['fotos', 'foto_perfil', 'foto_chassi'],
        childEntitySlug: 'nao-conformidades',
        childImageFields: ['fotos'],
        galleryColumns: 3,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 0: Tabela Completa (aba Registros)
    // ─────────────────────────────────────────────────────────────────────

    'data-table-veiculos': {
      type: 'data-table',
      title: 'Veículos',
      config: {
        displayFields: ['chassi', 'marca', 'modelo', 'navio', 'viagem', 'local', 'situacao', 'concluido'],
        pageSize: 25,
        allowCreate: true,
        allowEdit: true,
        allowDelete: true,
        allowExport: true,
        allowImport: true,
        allowBatchSelect: true,
        defaultSortField: 'createdAt',
        defaultSortOrder: 'desc',
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 7: Navio + Tabela Veículos (y=44)
    // ─────────────────────────────────────────────────────────────────────

    'column-navio': {
      type: 'column-chart',
      title: 'Veículos por Navio',
      config: {
        dataSource: 'field-distribution',
        groupByField: 'navio',
        chartColor: '#0EA5E9',
      },
    },

    'table-veiculos': {
      type: 'mini-table',
      title: 'Últimos Veículos Registrados',
      config: {
        limit: 10,
        displayFields: ['chassi', 'marca', 'modelo', 'navio', 'viagem', 'situacao', 'concluido'],
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEÇÃO 8: Tabela NCs + Atividade Recente (y=48)
    // ─────────────────────────────────────────────────────────────────────

    'table-ncs': {
      type: 'mini-table',
      title: 'Não-Conformidades Detalhadas',
      config: {
        entitySlugOverride: 'nao-conformidades',
        limit: 10,
        displayFields: ['peca', 'tipo', 'nivel', 'medida', 'quadrante', 'local'],
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    },

    'activity-ncs': {
      type: 'activity-feed',
      title: 'Atividade Recente — NCs',
      config: {
        entitySlugOverride: 'nao-conformidades',
        activityLimit: 15,
      },
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LAYOUT: 12 colunas, rowHeight=30px
  // ═══════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════
  // TABS: 5 abas — Registros (tabela) + 4 abas de dashboard
  // ═══════════════════════════════════════════════════════════════════════
  const tabs = [
    {
      id: 'registros',
      label: '1. Registros',
      widgetIds: ['data-table-veiculos'],
    },
    {
      id: 'visao-geral',
      label: '2. Visão Geral',
      widgetIds: ['kpi-veiculos', 'kpi-ncs', 'number-ncs', 'kpi-variacao', 'kpi-ratio-nc', 'line-tendencia', 'column-navio', 'table-veiculos'],
    },
    {
      id: 'operacao',
      label: '3. Operação',
      widgetIds: ['stacked-modelo-marca', 'donut-marca', 'bar-situacao', 'bar-tipo-dano'],
    },
    {
      id: 'nao-conformidades',
      label: '4. Não-Conformidades',
      widgetIds: ['bar-local-nc', 'heatmap-peca-tipo', 'column-medida', 'bar-nivel', 'treemap-peca'],
    },
    {
      id: 'ficha-veiculo',
      label: '5. Ficha Veículo',
      widgetIds: ['table-ncs', 'activity-ncs', 'zone-quadrante', 'gallery-fotos', 'resumo-ncs'],
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // LAYOUT: 12 colunas, rowHeight=30px — y relativo ao inicio de cada tab
  // ═══════════════════════════════════════════════════════════════════════

  const layout = [
    // ── Tab 1: Registros ──
    { i: 'data-table-veiculos', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 6 },

    // ── Tab 2: Visão Geral ──
    // KPIs (y=0, h=3)
    { i: 'kpi-veiculos', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: 'kpi-ncs', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: 'number-ncs', x: 6, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
    { i: 'kpi-variacao', x: 8, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
    { i: 'kpi-ratio-nc', x: 10, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
    // Tendência + Navio (y=3, h=7)
    { i: 'line-tendencia', x: 0, y: 3, w: 8, h: 7, minW: 3, minH: 3 },
    { i: 'column-navio', x: 8, y: 3, w: 4, h: 7, minW: 3, minH: 3 },
    // Tabela veículos (y=10, h=8)
    { i: 'table-veiculos', x: 0, y: 10, w: 12, h: 8, minW: 4, minH: 4 },

    // ── Tab 3: Operação ──
    // Stacked modelo×marca + Donut marca (y=0, h=8)
    { i: 'stacked-modelo-marca', x: 0, y: 0, w: 8, h: 8, minW: 4, minH: 3 },
    { i: 'donut-marca', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 3 },
    // Situação + Tipos dano (y=8, h=7)
    { i: 'bar-situacao', x: 0, y: 8, w: 6, h: 7, minW: 3, minH: 3 },
    { i: 'bar-tipo-dano', x: 6, y: 8, w: 6, h: 7, minW: 3, minH: 3 },

    // ── Tab 4: Não-Conformidades ──
    // Responsabilidade + Heatmap (y=0, h=8)
    { i: 'bar-local-nc', x: 0, y: 0, w: 4, h: 8, minW: 3, minH: 3 },
    { i: 'heatmap-peca-tipo', x: 4, y: 0, w: 8, h: 8, minW: 4, minH: 4 },
    // Tamanho + Gravidade + Treemap (y=8, h=7)
    { i: 'column-medida', x: 0, y: 8, w: 4, h: 7, minW: 3, minH: 3 },
    { i: 'bar-nivel', x: 4, y: 8, w: 4, h: 7, minW: 3, minH: 3 },
    { i: 'treemap-peca', x: 8, y: 8, w: 4, h: 7, minW: 3, minH: 3 },

    // ── Tab 5: Ficha Veículo ──
    // Gallery + Resumo NCs + Zone (y=0, h=7)
    { i: 'gallery-fotos', x: 0, y: 0, w: 5, h: 7, minW: 3, minH: 3 },
    { i: 'resumo-ncs', x: 5, y: 0, w: 3, h: 7, minW: 2, minH: 3 },
    { i: 'zone-quadrante', x: 8, y: 0, w: 4, h: 7, minW: 3, minH: 3 },
    // Tabela NCs + Atividade (y=7, h=8)
    { i: 'table-ncs', x: 0, y: 7, w: 8, h: 8, minW: 4, minH: 4 },
    { i: 'activity-ncs', x: 8, y: 7, w: 4, h: 8, minW: 3, minH: 4 },

    // ── Widgets sem tab (Comparativo — mantidos no layout para uso futuro) ──
    { i: 'grouped-viagem-marca', x: 0, y: 0, w: 4, h: 7, minW: 4, minH: 3 },
    { i: 'scatter-quadrante-nivel', x: 4, y: 0, w: 4, h: 7, minW: 4, minH: 3 },
    { i: 'donut-nivel', x: 8, y: 0, w: 4, h: 7, minW: 3, minH: 3 },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // CRIAR TEMPLATE (1 por tenant que tenha a entidade veiculos)
  // ═══════════════════════════════════════════════════════════════════════

  const TEMPLATE_NAME = 'Nexus — Inspeção Veicular Completo';

  for (const entity of veiculoEntities) {
    const tid = entity.tenantId;

    // Buscar roles desse tenant
    const tenantRoles = await prisma.customRole.findMany({
      where: { tenantId: tid },
      select: { id: true },
    });

    // Deletar template existente com mesmo nome
    const existing = await prisma.dashboardTemplate.findFirst({
      where: { tenantId: tid, name: TEMPLATE_NAME },
    });

    if (existing) {
      await prisma.dashboardTemplate.delete({ where: { id: existing.id } });
      console.log(`Template anterior deletado para tenant ${tid}`);
    }

    const template = await prisma.dashboardTemplate.create({
      data: {
        tenantId: tid,
        name: TEMPLATE_NAME,
        description:
          'Dashboard Nexus completo com 25 widgets: KPIs comparativos, KPI ratio NC/veículo, barras empilhadas modelo×marca, barras agrupadas viagem×marca, heatmap peça×tipo, treemap peças, scatter quadrante×nível, diagrama de zonas, galeria de fotos, donut marca/gravidade, barras situação/tipo/local/nível/medida, tendência com linha de referência, tabelas e atividade.',
        entitySlug: 'veiculos',
        layout,
        widgets,
        tabs,
        roleIds: tenantRoles.map((r) => r.id),
        priority: 20,
        isActive: true,
      },
    });

    console.log(`\nDashboard criado para tenant ${tid}:`);
    console.log(`  ID: ${template.id}`);
    console.log(`  Widgets: ${Object.keys(widgets).length}`);
    console.log(`  Layout items: ${layout.length}`);
    console.log(`  Roles: ${tenantRoles.length}`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('Dashboard Nexus criado com sucesso!');
  console.log(`  Widgets: ${Object.keys(widgets).length}`);
  console.log(`  Layout: ${layout.length} itens`);
  console.log(`  Tenants: ${veiculoEntities.length}`);
  console.log(`${'═'.repeat(60)}`);
  console.log('\nO dashboard aparecera na pagina de dados de "veiculos".');
  console.log('Tambem pode ser acessado em /dashboard-templates/{id}');
}

main()
  .catch((e) => {
    console.error('Erro ao criar dashboard:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
