/**
 * Seed: Dashboard de Inspeção Veicular
 *
 * Cria um template de dashboard completo para a entidade "veiculos" com
 * widgets multi-entidade cobrindo veículos e não-conformidades.
 *
 * Uso: DATABASE_URL="..." npx ts-node prisma/seed-dashboard-veiculos.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Encontrar a entidade "veiculos" para descobrir o tenantId
  // Pegar o tenant que tem mais dados
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

  // 2. Buscar todas as roles do tenant para atribuir ao template
  const roles = await prisma.customRole.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });

  const roleIds = roles.map((r) => r.id);
  console.log(`${roles.length} roles encontradas: ${roles.map((r) => r.name).join(', ')}`);

  // ═══════════════════════════════════════════════════════════════════════
  // WIDGETS: 21 widgets cobrindo veiculos + nao-conformidades
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Campos veiculos:   chassi, marca, modelo, navio, viagem, local, situacao(select), concluido(bool)
  // Campos NCs:        peca(zone-diagram), tipo(select), nivel(select), quadrante(select),
  //                    medida(select), local(select)
  // ═══════════════════════════════════════════════════════════════════════

  const widgets: Record<string, object> = {
    // ─────────────────────────────────────────────────────────────────────
    // ROW 0: KPI Cards (y=0, h=4)
    // ─────────────────────────────────────────────────────────────────────

    'kpi-total-veiculos': {
      type: 'kpi-card',
      title: 'Total de Veículos',
      config: {
        aggregation: 'count',
        showComparison: true,
        comparisonPeriod: 30,
      },
    },

    'kpi-total-ncs': {
      type: 'kpi-card',
      title: 'Total de Não-Conformidades',
      config: {
        entitySlugOverride: 'nao-conformidades',
        aggregation: 'count',
        showComparison: true,
        comparisonPeriod: 30,
      },
    },

    'number-veiculos': {
      type: 'number-card',
      title: 'Veículos Cadastrados',
      config: {
        aggregation: 'count',
      },
    },

    'number-ncs': {
      type: 'number-card',
      title: 'NCs Registradas',
      config: {
        entitySlugOverride: 'nao-conformidades',
        aggregation: 'count',
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // ROW 1: Donut Charts - Distribuições Principais (y=4, h=8)
    // ─────────────────────────────────────────────────────────────────────

    'donut-situacao-veiculos': {
      type: 'donut-chart',
      title: 'Situação dos Veículos',
      config: {
        dataSource: 'field-distribution',
        groupByField: 'situacao',
        showLegend: true,
        chartColors: ['#64748b', '#f59e0b', '#3b82f6'],
      },
    },

    'donut-ncs-nivel': {
      type: 'donut-chart',
      title: 'NCs por Nível de Gravidade',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'nivel',
        showLegend: true,
        chartColors: ['#ef4444', '#86efac', '#fcd34d', '#64748b', '#fb923c'],
      },
    },

    'donut-concluido': {
      type: 'donut-chart',
      title: 'Inspeções Concluídas',
      config: {
        dataSource: 'field-distribution',
        groupByField: 'concluido',
        showLegend: true,
        chartColors: ['#22c55e', '#ef4444'],
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // ROW 2: Bar Charts - Análise de NCs (y=12, h=9)
    // ─────────────────────────────────────────────────────────────────────

    'bar-ncs-tipo': {
      type: 'bar-chart',
      title: 'NCs por Tipo de Defeito',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'tipo',
        chartColor: '#3b82f6',
        showLegend: false,
      },
    },

    'pie-ncs-local': {
      type: 'pie-chart',
      title: 'NCs por Local de Ocorrência',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'local',
        showLegend: true,
        chartColors: ['#06b6d4', '#8b5cf6', '#f59e0b', '#64748b', '#ec4899', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#14b8a6'],
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // ROW 3: Column Charts - Veículos por Dimensão (y=21, h=8)
    // ─────────────────────────────────────────────────────────────────────

    'column-veiculos-marca': {
      type: 'column-chart',
      title: 'Veículos por Marca',
      config: {
        dataSource: 'field-distribution',
        groupByField: 'marca',
        chartColor: '#059669',
        showLegend: false,
      },
    },

    'column-veiculos-navio': {
      type: 'column-chart',
      title: 'Veículos por Navio',
      config: {
        dataSource: 'field-distribution',
        groupByField: 'navio',
        chartColor: '#0ea5e9',
        showLegend: false,
      },
    },

    'column-veiculos-modelo': {
      type: 'column-chart',
      title: 'Veículos por Modelo',
      config: {
        dataSource: 'field-distribution',
        groupByField: 'modelo',
        chartColor: '#a855f7',
        showLegend: false,
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // ROW 4: Tendências Temporais (y=29, h=8)
    // ─────────────────────────────────────────────────────────────────────

    'area-veiculos-tempo': {
      type: 'area-chart',
      title: 'Veículos Registrados ao Longo do Tempo',
      config: {
        dataSource: 'records-over-time',
        days: 90,
        chartColor: '#3b82f6',
      },
    },

    'area-ncs-tempo': {
      type: 'area-chart',
      title: 'Não-Conformidades ao Longo do Tempo',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'records-over-time',
        days: 90,
        chartColor: '#ef4444',
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // ROW 5: Quadrante & Medida (y=37, h=8)
    // ─────────────────────────────────────────────────────────────────────

    'column-ncs-quadrante': {
      type: 'column-chart',
      title: 'NCs por Quadrante do Veículo',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'quadrante',
        chartColor: '#f97316',
        showLegend: false,
      },
    },

    'donut-ncs-medida': {
      type: 'donut-chart',
      title: 'NCs por Tamanho do Dano',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'medida',
        showLegend: true,
        chartColors: ['#14b8a6', '#f43f5e', '#a78bfa', '#fbbf24', '#64748b'],
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // ROW 6: Funil & NCs por Peça (y=45, h=10)
    // ─────────────────────────────────────────────────────────────────────

    'funnel-situacao': {
      type: 'funnel-chart',
      title: 'Funil de Situação dos Veículos',
      config: {
        dataSource: 'funnel',
        fieldSlug: 'situacao',
        stages: ['N/A', 'Sujo', 'Molhado'],
      },
    },

    'bar-ncs-peca': {
      type: 'bar-chart',
      title: 'NCs por Peça (Zone Diagram)',
      config: {
        entitySlugOverride: 'nao-conformidades',
        dataSource: 'field-distribution',
        groupByField: 'peca',
        chartColor: '#8b5cf6',
        showLegend: false,
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // ROW 7: Tabelas e Atividade Recente (y=55, h=10)
    // ─────────────────────────────────────────────────────────────────────

    'table-veiculos-recentes': {
      type: 'mini-table',
      title: 'Últimos Veículos Registrados',
      config: {
        limit: 10,
        displayFields: ['chassi', 'marca', 'modelo', 'navio', 'situacao', 'concluido'],
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    },

    'activity-ncs-recentes': {
      type: 'activity-feed',
      title: 'Atividade Recente - Não-Conformidades',
      config: {
        entitySlugOverride: 'nao-conformidades',
        activityLimit: 15,
      },
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LAYOUT: 12 colunas, rowHeight=30px
  // ═══════════════════════════════════════════════════════════════════════

  const layout = [
    // Row 0: KPI Cards (y=0, h=4) → 120px
    { i: 'kpi-total-veiculos', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi-total-ncs', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'number-veiculos', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'number-ncs', x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },

    // Row 1: Donut Charts (y=4, h=8) → 240px
    { i: 'donut-situacao-veiculos', x: 0, y: 4, w: 4, h: 8, minW: 3, minH: 6 },
    { i: 'donut-ncs-nivel', x: 4, y: 4, w: 4, h: 8, minW: 3, minH: 6 },
    { i: 'donut-concluido', x: 8, y: 4, w: 4, h: 8, minW: 3, minH: 6 },

    // Row 2: Bar + Pie (y=12, h=9) → 270px
    { i: 'bar-ncs-tipo', x: 0, y: 12, w: 7, h: 9, minW: 4, minH: 6 },
    { i: 'pie-ncs-local', x: 7, y: 12, w: 5, h: 9, minW: 3, minH: 6 },

    // Row 3: Column Charts (y=21, h=8) → 240px
    { i: 'column-veiculos-marca', x: 0, y: 21, w: 4, h: 8, minW: 3, minH: 6 },
    { i: 'column-veiculos-navio', x: 4, y: 21, w: 4, h: 8, minW: 3, minH: 6 },
    { i: 'column-veiculos-modelo', x: 8, y: 21, w: 4, h: 8, minW: 3, minH: 6 },

    // Row 4: Trends (y=29, h=8) → 240px
    { i: 'area-veiculos-tempo', x: 0, y: 29, w: 6, h: 8, minW: 4, minH: 6 },
    { i: 'area-ncs-tempo', x: 6, y: 29, w: 6, h: 8, minW: 4, minH: 6 },

    // Row 5: Quadrante & Medida (y=37, h=8) → 240px
    { i: 'column-ncs-quadrante', x: 0, y: 37, w: 6, h: 8, minW: 4, minH: 6 },
    { i: 'donut-ncs-medida', x: 6, y: 37, w: 6, h: 8, minW: 3, minH: 6 },

    // Row 6: Funnel & NCs por Peça (y=45, h=10) → 300px
    { i: 'funnel-situacao', x: 0, y: 45, w: 5, h: 10, minW: 4, minH: 8 },
    { i: 'bar-ncs-peca', x: 5, y: 45, w: 7, h: 10, minW: 4, minH: 8 },

    // Row 7: Tables & Activity (y=55, h=10) → 300px
    { i: 'table-veiculos-recentes', x: 0, y: 55, w: 6, h: 10, minW: 4, minH: 8 },
    { i: 'activity-ncs-recentes', x: 6, y: 55, w: 6, h: 10, minW: 4, minH: 8 },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // CRIAR TEMPLATES (1 por tenant que tenha a entidade veiculos)
  // ═══════════════════════════════════════════════════════════════════════

  for (const entity of veiculoEntities) {
    const tid = entity.tenantId;

    // Buscar roles desse tenant
    const tenantRoles = await prisma.customRole.findMany({
      where: { tenantId: tid },
      select: { id: true },
    });

    // Deletar template existente com mesmo nome
    const existing = await prisma.dashboardTemplate.findFirst({
      where: { tenantId: tid, name: 'Inspeção Veicular - Dashboard Completo' },
    });

    if (existing) {
      await prisma.dashboardTemplate.delete({ where: { id: existing.id } });
      console.log(`Template anterior deletado para tenant ${tid}`);
    }

    const template = await prisma.dashboardTemplate.create({
      data: {
        tenantId: tid,
        name: 'Inspeção Veicular - Dashboard Completo',
        description:
          'Dashboard completo de inspeção veicular com 21 widgets: KPIs com comparação de período, distribuições de situação/nível/conclusão, análise de NCs por tipo/peça/local/quadrante/medida, tendências temporais, funil de situação e tabelas de dados recentes.',
        entitySlug: 'veiculos',
        layout,
        widgets,
        roleIds: tenantRoles.map((r) => r.id),
        priority: 10,
        isActive: true,
      },
    });

    console.log(`\nDashboard criado para tenant ${tid}:`);
    console.log(`  ID: ${template.id}`);
    console.log(`  Widgets: ${Object.keys(widgets).length}`);
    console.log(`  Roles: ${tenantRoles.length}`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Dashboard template criado com sucesso!`);
  console.log(`  Total de widgets: ${Object.keys(widgets).length}`);
  console.log(`  Layout items: ${layout.length}`);
  console.log(`  Tenants: ${veiculoEntities.length}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`\nO dashboard aparecerá automaticamente na página de dados de "veiculos".`);
}

main()
  .catch((e) => {
    console.error('Erro ao criar dashboard:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
