/**
 * Seed: Dashboard Completo de Sinistros com Follow-Ups
 *
 * Cria um dashboard profissional para a entidade "sinistros" do tenant marisa-dilda
 * com widgets de sub-entidades (Follow-Ups) em formato de lista agrupada e timeline.
 *
 * Uso: DATABASE_URL="..." npx ts-node prisma/seed-dashboard-sinistros-followups.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando seed do dashboard de sinistros com follow-ups...\n');

  // Tenant: marisa-dilda
  const tenantId = 'cmlgw7qy70001wyn7vlwiijcj';

  // 1. Verificar se o tenant existe
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    console.error('❌ Tenant marisa-dilda não encontrado!');
    process.exit(1);
  }

  console.log(`✅ Tenant encontrado: ${tenant.name} (${tenant.slug})`);

  // 2. Verificar se as entidades existem
  const sinistrosEntity = await prisma.entity.findFirst({
    where: { tenantId, slug: 'sinistros' },
    select: { id: true, name: true, slug: true },
  });

  const followupsEntity = await prisma.entity.findFirst({
    where: { tenantId, slug: 'sinistro-followups' },
    select: { id: true, name: true, slug: true },
  });

  if (!sinistrosEntity) {
    console.error('❌ Entidade "sinistros" não encontrada!');
    process.exit(1);
  }

  if (!followupsEntity) {
    console.error('❌ Entidade "sinistro-followups" não encontrada!');
    process.exit(1);
  }

  console.log(`✅ Entidade principal: ${sinistrosEntity.name} (${sinistrosEntity.slug})`);
  console.log(`✅ Sub-entidade: ${followupsEntity.name} (${followupsEntity.slug})`);

  // 3. Buscar todas as roles do tenant
  const roles = await prisma.customRole.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });

  console.log(`✅ ${roles.length} roles encontradas: ${roles.map((r) => r.name).join(', ')}\n`);

  // 4. Deletar dashboard anterior se existir
  const existingDashboard = await prisma.dashboardTemplate.findFirst({
    where: {
      tenantId,
      name: 'Sinistro - Visão Completa com Follow-Ups',
    },
  });

  if (existingDashboard) {
    await prisma.dashboardTemplate.delete({
      where: { id: existingDashboard.id },
    });
    console.log('🗑️  Dashboard anterior deletado\n');
  }

  // 5. Criar dashboard completo
  const dashboardTemplate = await prisma.dashboardTemplate.create({
    data: {
      tenantId,
      name: 'Sinistro - Visão Completa com Follow-Ups',
      description:
        'Dashboard profissional de sinistros com KPIs, gráficos, lista agrupada de follow-ups e timeline de interações',
      entitySlug: 'sinistros',
      layout: [
        // ═══════════════════════════════════════════════════════════
        // ROW 0: KPI Cards (y=0, h=4)
        // ═══════════════════════════════════════════════════════════
        { i: 'kpi-total-sinistros', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
        { i: 'kpi-abertos', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
        { i: 'kpi-valor-total', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
        { i: 'kpi-prazo-medio', x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },

        // ═══════════════════════════════════════════════════════════
        // ROW 1: Charts (y=4, h=8)
        // ═══════════════════════════════════════════════════════════
        { i: 'donut-causa', x: 0, y: 4, w: 4, h: 8, minW: 3, minH: 6 },
        { i: 'donut-classificacao', x: 4, y: 4, w: 4, h: 8, minW: 3, minH: 6 },
        { i: 'bar-transportadora', x: 8, y: 4, w: 4, h: 8, minW: 3, minH: 6 },

        // ═══════════════════════════════════════════════════════════
        // ROW 2: SUB-ENTIDADES - Follow-Ups (y=12, h=12) ✨ NOVOS
        // ═══════════════════════════════════════════════════════════
        { i: 'followups-list', x: 0, y: 12, w: 6, h: 12, minW: 4, minH: 8 },
        { i: 'followups-timeline', x: 6, y: 12, w: 6, h: 12, minW: 4, minH: 8 },

        // ═══════════════════════════════════════════════════════════
        // ROW 3: Tendências e Tabela (y=24, h=10)
        // ═══════════════════════════════════════════════════════════
        { i: 'area-tempo', x: 0, y: 24, w: 6, h: 10, minW: 4, minH: 6 },
        { i: 'table-recentes', x: 6, y: 24, w: 6, h: 10, minW: 4, minH: 6 },
      ],
      widgets: {
        // ═══════════════════════════════════════════════════════════
        // KPI CARDS
        // ═══════════════════════════════════════════════════════════
        'kpi-total-sinistros': {
          type: 'kpi-card',
          title: 'Total de Sinistros',
          config: {
            aggregation: 'count',
            showComparison: true,
            comparisonPeriod: 30,
          },
        },

        'kpi-abertos': {
          type: 'number-card',
          title: 'Sinistros Abertos',
          config: {
            aggregation: 'count',
            filters: [
              {
                fieldSlug: 'status',
                operator: 'not_equals',
                value: 'concluido',
              },
            ],
          },
        },

        'kpi-valor-total': {
          type: 'kpi-card',
          title: 'Valor Total (Prejuízo)',
          config: {
            aggregation: 'sum',
            fieldSlug: 'prejuizo',
            showComparison: true,
            comparisonPeriod: 30,
          },
        },

        'kpi-prazo-medio': {
          type: 'number-card',
          title: 'Prazo Médio (dias)',
          config: {
            aggregation: 'avg',
            fieldSlug: 'tempo_resolucao', // Se existir campo de timer
          },
        },

        // ═══════════════════════════════════════════════════════════
        // CHARTS
        // ═══════════════════════════════════════════════════════════
        'donut-causa': {
          type: 'donut-chart',
          title: 'Sinistros por Causa',
          config: {
            dataSource: 'field-distribution',
            groupByField: 'causa',
            showLegend: true,
            chartColors: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e'],
          },
        },

        'donut-classificacao': {
          type: 'donut-chart',
          title: 'Sinistros por Classificação',
          config: {
            dataSource: 'field-distribution',
            groupByField: 'classificacao',
            showLegend: true,
            chartColors: ['#06b6d4', '#ec4899', '#a855f7', '#f97316', '#14b8a6'],
          },
        },

        'bar-transportadora': {
          type: 'bar-chart',
          title: 'Top 10 Transportadoras',
          config: {
            dataSource: 'field-distribution',
            groupByField: 'transportadora',
            chartColor: '#3b82f6',
            limit: 10,
          },
        },

        // ═══════════════════════════════════════════════════════════
        // ✨ NOVOS WIDGETS DE SUB-ENTIDADES
        // ═══════════════════════════════════════════════════════════
        'followups-list': {
          type: 'sub-entity-list',
          title: 'Follow-Ups por Status',
          config: {
            entitySlug: 'sinistros',
            subEntitySlug: 'sinistro-followups',
            displayFields: ['data_hora', 'tipo_contato', 'status', 'descricao'],
            groupBy: 'status', // Agrupa por status
            limit: 20,
            showParentInfo: false,
          },
        },

        'followups-timeline': {
          type: 'sub-entity-timeline',
          title: 'Histórico de Interações',
          config: {
            subEntitySlug: 'sinistro-followups',
            titleField: 'tipo_contato',
            descriptionField: 'descricao',
            statusField: 'status',
            dateField: 'data_hora',
            limit: 15,
            sortOrder: 'desc',
          },
        },

        // ═══════════════════════════════════════════════════════════
        // TENDÊNCIAS E TABELA
        // ═══════════════════════════════════════════════════════════
        'area-tempo': {
          type: 'area-chart',
          title: 'Sinistros ao Longo do Tempo',
          config: {
            dataSource: 'records-over-time',
            days: 90,
            chartColor: '#3b82f6',
          },
        },

        'table-recentes': {
          type: 'mini-table',
          title: 'Últimos Sinistros Registrados',
          config: {
            limit: 10,
            displayFields: [
              'numero_seguradora',
              'segurado',
              'causa',
              'prejuizo',
              'data_hora_evento',
            ],
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        },
      },
      roleIds: roles.map((r) => r.id),
      priority: 10,
      isActive: true,
    },
  });

  const widgetsObj = dashboardTemplate.widgets as Record<string, unknown>;

  console.log('\n🎉 Dashboard criado com sucesso!\n');
  console.log('═'.repeat(60));
  console.log(`ID: ${dashboardTemplate.id}`);
  console.log(`Nome: ${dashboardTemplate.name}`);
  console.log(`Entidade: ${dashboardTemplate.entitySlug}`);
  console.log(`Widgets: ${Object.keys(widgetsObj).length}`);
  console.log(`  - KPIs: 4`);
  console.log(`  - Charts: 4`);
  console.log(`  - Sub-Entidades: 2 ✨ (Lista + Timeline)`);
  console.log(`Roles: ${roles.length}`);
  console.log('═'.repeat(60));
  console.log('\n✅ Dashboard disponível em: /data?entity=sinistros\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar dashboard:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
