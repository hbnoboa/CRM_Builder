import { C, field, opts, rows, section } from './layout';
import { cycle, daysAgo } from './samples';
import type { SampleRecord, SolutionSpec } from './types';

/**
 * Modelo "Chamados / Manutencao": ativos (equipamentos e instalacoes) ->
 * chamados (corretiva, preventiva, melhoria) -> apontamentos de horas.
 * Qualquer colaborador abre chamado; a equipe de manutencao atende.
 * Dados de exemplo ficticios.
 */

const STATUS = opts(
  ['aberto', 'Aberto', C.blue],
  ['em_atendimento', 'Em atendimento', C.amber],
  ['aguardando', 'Aguardando material', C.orange],
  ['resolvido', 'Resolvido', C.green],
  ['cancelado', 'Cancelado', C.gray],
);
const PRIORIDADE = opts(['baixa', 'Baixa', C.gray], ['media', 'Média', C.blue], ['alta', 'Alta', C.orange], ['critica', 'Crítica', C.red]);
const CATEGORIA = opts(['corretiva', 'Corretiva', C.red], ['preventiva', 'Preventiva', C.green], ['melhoria', 'Melhoria', C.blue]);
const TIPO_ATIVO = opts(
  ['climatizacao', 'Climatização'], ['eletrica', 'Elétrica'], ['hidraulica', 'Hidráulica'],
  ['elevador', 'Elevador'], ['ti', 'TI e rede'], ['predial', 'Predial / civil'], ['producao', 'Máquina de produção'],
);

const apontamentos = {
  slug: 'apontamentos',
  name: 'Apontamento',
  namePlural: 'Apontamentos',
  description: 'Horas trabalhadas e materiais usados em cada chamado.',
  icon: 'Timer',
  color: C.teal,
  category: 'Manutenção',
  subOf: 'chamados',
  settings: { titleField: 'descricao' },
  fields: rows(
    [
      field('data', 'Data', 'datetime', 4, { required: true }),
      field('tecnico', 'Técnico', 'text', 4, { required: true }),
      field('horas', 'Horas', 'number', 4, { required: true, min: 0, suffix: ' h' }),
    ],
    [field('descricao', 'O que foi feito', 'textarea', 12, { required: true })],
    [field('material', 'Material usado', 'text', 12)],
  ),
};

const chamados = {
  slug: 'chamados',
  name: 'Chamado',
  namePlural: 'Chamados',
  description: 'Pedidos de manutenção com prioridade, prazo (SLA), responsável e solução.',
  icon: 'LifeBuoy',
  color: C.blue,
  category: 'Manutenção',
  subOf: 'ativos',
  settings: { titleField: 'numero', captureLocation: true },
  fields: rows(
    [
      field('numero', 'Nº do chamado', 'text', 3, { required: true, unique: true, placeholder: 'CH-0001' }),
      field('aberto_em', 'Aberto em', 'datetime', 3, { required: true }),
      field('categoria', 'Categoria', 'select', 3, { required: true, options: CATEGORIA }),
      field('prioridade', 'Prioridade', 'select', 3, { required: true, options: PRIORIDADE }),
    ],
    [
      field('status', 'Situação', 'select', 4, { required: true, options: STATUS }),
      field('solicitante', 'Solicitante', 'text', 4, { required: true }),
      field('responsavel', 'Responsável', 'text', 4),
    ],
    [field('descricao', 'Descrição do problema', 'textarea', 12, { required: true })],
    [field('foto', 'Foto', 'image', 6), field('prazo', 'Prazo (SLA)', 'datetime', 3), field('resolvido_em', 'Resolvido em', 'datetime', 3)],
    [section('sec_solucao', 'Solução')],
    [field('solucao', 'O que foi feito', 'textarea', 12)],
    [
      field('horas_total', 'Horas no chamado', 'number', 4, { min: 0, suffix: ' h' }),
      field('custo', 'Custo de material', 'currency', 4, { min: 0 }),
      field('avaliacao', 'Avaliação do solicitante', 'rating', 4),
    ],
    [
      field('apontamentos', 'Apontamentos', 'sub-entity', 12, {
        subEntitySlug: 'apontamentos',
        subEntityDisplayFields: ['data', 'tecnico', 'horas', 'descricao'],
        parentDisplayField: 'numero',
      }),
    ],
  ),
};

const ativos = {
  slug: 'ativos',
  name: 'Ativo',
  namePlural: 'Ativos',
  description: 'Equipamentos e instalações atendidos pela manutenção, com criticidade e histórico.',
  icon: 'Cog',
  color: C.orange,
  category: 'Manutenção',
  settings: { titleField: 'nome' },
  fields: rows(
    [
      field('codigo', 'Código', 'text', 3, { required: true, unique: true, placeholder: 'AT-001' }),
      field('nome', 'Nome', 'text', 6, { required: true }),
      field('tipo', 'Tipo', 'select', 3, { required: true, options: TIPO_ATIVO }),
    ],
    [
      field('local', 'Local / setor', 'text', 4, { required: true }),
      field('criticidade', 'Criticidade', 'select', 4, { required: true, options: opts(['baixa', 'Baixa', C.gray], ['media', 'Média', C.amber], ['alta', 'Alta', C.red]) }),
      field('situacao', 'Situação', 'select', 4, {
        required: true,
        options: opts(['operando', 'Operando', C.green], ['parado', 'Parado', C.red], ['em_manutencao', 'Em manutenção', C.amber]),
      }),
    ],
    [
      field('fabricante', 'Fabricante / modelo', 'text', 6),
      field('ultima_preventiva', 'Última preventiva', 'date', 3),
      field('periodicidade', 'Preventiva a cada', 'select', 3, { options: opts(['30', '30 dias'], ['90', '90 dias'], ['180', '6 meses'], ['365', '1 ano']) }),
    ],
    [field('foto', 'Foto / plaqueta', 'image', 12)],
    [
      field('chamados', 'Chamados', 'sub-entity', 12, {
        subEntitySlug: 'chamados',
        subEntityDisplayFields: ['numero', 'aberto_em', 'categoria', 'prioridade', 'status', 'responsavel'],
        parentDisplayField: 'nome',
      }),
    ],
  ),
};

// ── Dados de exemplo (ficticios) ──────────────────────────────────────────
const ATIVOS: Array<[string, string, string, string, string, string, string]> = [
  ['AT-001', 'Chiller central', 'climatizacao', 'Casa de máquinas', 'alta', 'operando', 'Carrier 30XA'],
  ['AT-002', 'Elevador social', 'elevador', 'Torre A', 'alta', 'operando', 'Atlas Schindler 3300'],
  ['AT-003', 'Quadro geral de baixa tensão', 'eletrica', 'Subsolo', 'alta', 'operando', 'WEG QGBT'],
  ['AT-004', 'Bomba de recalque 1', 'hidraulica', 'Reservatório inferior', 'media', 'em_manutencao', 'Schneider BC-92'],
  ['AT-005', 'Rack de rede — 3º andar', 'ti', 'Sala técnica 3', 'media', 'operando', 'Furukawa 44U'],
  ['AT-006', 'Fachada e marquise', 'predial', 'Entrada principal', 'baixa', 'operando', '—'],
  ['AT-007', 'Compressor de ar', 'producao', 'Linha de montagem', 'alta', 'parado', 'Schulz SRP 3020'],
  ['AT-008', 'Splits — refeitório', 'climatizacao', 'Refeitório', 'baixa', 'operando', 'LG Dual Inverter (4 un.)'],
];
const SOLICITANTES = ['Beatriz Nogueira', 'Henrique Sato', 'Larissa Pinto', 'Otávio Ramos', 'Sônia Barros'];
const TECNICOS = ['Edson Carvalho', 'Fábio Moreira', 'Gisele Andrade'];
const PROBLEMAS: Record<string, Array<[string, string, string]>> = {
  climatizacao: [['corretiva', 'Temperatura acima do normal na área atendida.', 'Limpeza do condensador e ajuste de carga de gás.'], ['preventiva', 'Preventiva trimestral.', 'Troca de filtros e verificação elétrica.']],
  elevador: [['corretiva', 'Porta do 5º andar demorando para fechar.', 'Regulagem do operador de porta.'], ['preventiva', 'Inspeção mensal obrigatória.', 'Inspeção concluída sem pendências.']],
  eletrica: [['corretiva', 'Disjuntor do circuito 12 desarmando.', 'Redistribuição de cargas e troca do disjuntor.'], ['melhoria', 'Instalar medidor de energia por setor.', 'Medidores instalados em 4 circuitos.']],
  hidraulica: [['corretiva', 'Bomba com ruído e vibração.', 'Troca de rolamentos e alinhamento.'], ['corretiva', 'Vazamento no barrilete.', 'Substituição de registro.']],
  ti: [['corretiva', 'Switch reiniciando sozinho.', 'Troca da fonte do switch.'], ['melhoria', 'Organizar cabeamento do rack.', 'Cabeamento identificado e organizado.']],
  predial: [['corretiva', 'Infiltração na marquise após chuva.', 'Impermeabilização da laje.'], ['preventiva', 'Inspeção semestral da fachada.', 'Sem fissuras relevantes.']],
  producao: [['corretiva', 'Compressor desarmando por temperatura.', 'Limpeza do radiador e troca do óleo.'], ['preventiva', 'Troca de elementos filtrantes.', 'Filtros substituídos.']],
};
const STATUS_CICLO = ['resolvido', 'resolvido', 'em_atendimento', 'aberto', 'resolvido', 'aguardando', 'resolvido', 'aberto', 'resolvido', 'cancelado'];
const SLA_HORAS: Record<string, number> = { critica: 4, alta: 8, media: 24, baixa: 72 };

let numeroChamado = 0;
function plusHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function sampleChamados(i: number, tipo: string, criticidade: string): SampleRecord[] {
  const count = 3 + (i % 3);
  return Array.from({ length: count }, (_, j) => {
    const n = i * 5 + j;
    const [categoria, descricao, solucao] = cycle(PROBLEMAS[tipo], j);
    const status = cycle(STATUS_CICLO, n);
    const prioridade = categoria === 'preventiva' ? 'baixa' : criticidade === 'alta' ? cycle(['critica', 'alta'], n) : cycle(['media', 'alta', 'baixa'], n);
    const aberto = daysAgo((i * 4 + j * 7 + j * j) % 30, 7 + (n % 10));
    const sla = SLA_HORAS[prioridade];
    const resolvido = status === 'resolvido';
    // ~1 em 4 resolvidos estoura o prazo (aparece no painel)
    const horasParaResolver = n % 4 === 0 ? sla + 6 : Math.max(1, Math.round(sla * 0.6));
    const tecnico = cycle(TECNICOS, n);
    const apontamentosN = resolvido || status === 'em_atendimento' ? 1 + (n % 2) : 0;
    const horas = Array.from({ length: apontamentosN }, (_, k) => 1 + ((n + k) % 3));
    numeroChamado += 1;
    return {
      data: {
        numero: `CH-${String(2000 + numeroChamado)}`,
        aberto_em: aberto,
        categoria, prioridade, status,
        solicitante: cycle(SOLICITANTES, n),
        ...(status === 'aberto' ? {} : { responsavel: tecnico }),
        descricao,
        prazo: plusHours(aberto, sla),
        ...(resolvido ? {
          resolvido_em: plusHours(aberto, horasParaResolver),
          solucao,
          avaliacao: 3 + (n % 3),
          custo: (n % 3) * 180,
        } : {}),
        horas_total: horas.reduce((a, b) => a + b, 0),
      },
      children: {
        apontamentos: horas.map((h, k) => ({
          data: { data: plusHours(aberto, 1 + k * 3), tecnico, horas: h, descricao: k === 0 ? 'Diagnóstico no local.' : solucao, material: k === 0 ? '' : 'Conforme solução' },
        })),
      },
    };
  });
}

export const chamadosManutencao: SolutionSpec = {
  slug: 'chamados-manutencao',
  tenantName: 'Modelo — Chamados e manutenção',
  brandColor: '#0d9488',
  entities: [apontamentos, chamados, ativos],
  roles: [
    {
      name: 'Solicitante',
      description: 'Abre chamados (pelo app ou chat) e acompanha os próprios pedidos.',
      color: C.gray,
      permissions: [
        { entitySlug: 'ativos', canRead: true, canCreate: false, canUpdate: false, canDelete: false, scope: 'all' },
        { entitySlug: 'chamados', canRead: true, canCreate: true, canUpdate: false, canDelete: false, scope: 'own' },
      ],
      modulePermissions: { dashboard: { canRead: true }, data: { canRead: true, canCreate: true } },
    },
    {
      name: 'Técnico de manutenção',
      description: 'Atende os chamados, registra horas, material e a solução.',
      color: C.teal,
      permissions: [
        { entitySlug: 'ativos', canRead: true, canCreate: false, canUpdate: true, canDelete: false, scope: 'all' },
        { entitySlug: 'chamados', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'all' },
        { entitySlug: 'apontamentos', canRead: true, canCreate: true, canUpdate: true, canDelete: true, scope: 'own' },
      ],
      modulePermissions: { dashboard: { canRead: true }, data: { canRead: true, canCreate: true, canUpdate: true }, templates: { canRead: true, canGenerate: true } },
    },
  ],
  dashboards: [
    {
      name: 'Central de chamados',
      description: 'Fila, prazos, chamados por categoria e ativos mais problemáticos.',
      entitySlug: 'ativos',
      roles: ['Administrador', 'Técnico de manutenção', 'Gerente'],
      priority: 20,
      tabs: [
        {
          id: 'visao-geral',
          label: 'Visão geral',
          rows: [
            [
              { id: 'kpi-chamados', type: 'kpi-card', title: 'Chamados', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'chamados' } },
              { id: 'kpi-horas', type: 'kpi-card', title: 'Horas apontadas', w: 3, h: 3, config: { fieldSlug: 'horas', aggregation: 'sum', entitySlugOverride: 'apontamentos' } },
              { id: 'kpi-custo', type: 'kpi-card', title: 'Custo de material', w: 3, h: 3, config: { fieldSlug: 'custo', aggregation: 'sum', entitySlugOverride: 'chamados' } },
              { id: 'kpi-avaliacao', type: 'kpi-card', title: 'Avaliação média', w: 3, h: 3, config: { fieldSlug: 'avaliacao', aggregation: 'avg', entitySlugOverride: 'chamados' } },
            ],
            [
              { id: 'line-chamados', type: 'line-chart', title: 'Chamados abertos por dia', w: 8, h: 7, config: { days: 30, chartColor: '#0d9488', dataSource: 'records-over-time', dateField: 'aberto_em', entitySlugOverride: 'chamados' } },
              { id: 'donut-status', type: 'donut-chart', title: 'Situação', w: 4, h: 7, config: { dataSource: 'field-distribution', groupByField: 'status', showLegend: true, entitySlugOverride: 'chamados' } },
            ],
            [
              { id: 'donut-categoria', type: 'donut-chart', title: 'Por categoria', w: 4, h: 7, config: { dataSource: 'field-distribution', groupByField: 'categoria', showLegend: true, entitySlugOverride: 'chamados' } },
              { id: 'stat-prioridade', type: 'stat-list', title: 'Por prioridade', w: 4, h: 7, config: { listStyle: 'colored', showTotal: true, groupByField: 'prioridade', entitySlugOverride: 'chamados' } },
              { id: 'bar-responsavel', type: 'bar-chart', title: 'Por responsável', w: 4, h: 7, config: { dataSource: 'field-distribution', groupByField: 'responsavel', chartColors: ['#0d9488'], entitySlugOverride: 'chamados' } },
            ],
          ],
        },
        {
          id: 'fila',
          label: 'Fila',
          rows: [
            [
              { id: 'kanban-chamados', type: 'kanban-board', title: 'Chamados por situação', w: 12, h: 12, config: { groupByField: 'status', cardTitleField: 'numero', cardSubtitleFields: ['descricao', 'responsavel'], cardBadgeField: 'prioridade', columnOrder: ['aberto', 'em_atendimento', 'aguardando', 'resolvido'], limit: 100, entitySlugOverride: 'chamados' } },
            ],
            [
              { id: 'mt-prazo', type: 'mini-table', title: 'Prazos (SLA)', w: 12, h: 8, config: { limit: 10, sortBy: 'prazo', sortOrder: 'desc', displayFields: ['numero', 'prioridade', 'status', 'prazo', 'responsavel'], entitySlugOverride: 'chamados' } },
            ],
          ],
        },
        {
          id: 'ativos',
          label: 'Ativos',
          rows: [
            [
              { id: 'bar-tipo', type: 'bar-chart', title: 'Ativos por tipo', w: 6, h: 7, config: { dataSource: 'field-distribution', groupByField: 'tipo', chartColors: ['#ea580c'], entitySlugOverride: 'ativos' } },
              { id: 'stat-situacao', type: 'stat-list', title: 'Situação dos ativos', w: 6, h: 7, config: { listStyle: 'colored', showTotal: true, groupByField: 'situacao', entitySlugOverride: 'ativos' } },
            ],
            [
              { id: 'dt-ativos', type: 'data-table', title: 'Ativos', w: 12, h: 10, config: { pageSize: 25, allowEdit: true, allowCreate: true, allowDelete: true, allowExport: true, allowImport: true, allowBatchSelect: true, displayFields: ['codigo', 'nome', 'tipo', 'local', 'criticidade', 'situacao'], defaultSortField: 'codigo', defaultSortOrder: 'asc', entitySlugOverride: 'ativos' } },
            ],
          ],
        },
      ],
    },
    {
      name: 'Meus chamados',
      description: 'Chamados abertos por quem pediu.',
      entitySlug: 'ativos',
      roles: ['Solicitante'],
      priority: 10,
      tabs: [
        {
          id: 'meus',
          label: 'Meus chamados',
          rows: [
            [
              { id: 'kpi-meus', type: 'kpi-card', title: 'Meus chamados', w: 12, h: 3, config: { aggregation: 'count', entitySlugOverride: 'chamados' } },
            ],
            [
              { id: 'mt-meus', type: 'mini-table', title: 'Acompanhamento', w: 12, h: 10, config: { limit: 20, sortBy: 'aberto_em', sortOrder: 'desc', displayFields: ['numero', 'aberto_em', 'descricao', 'status', 'responsavel'], entitySlugOverride: 'chamados' } },
            ],
          ],
        },
      ],
    },
  ],
  pdfs: [
    {
      name: 'Relatório de atendimento',
      slug: 'relatorio-atendimento',
      description: 'Chamado com ativo, prazos, solução, horas apontadas e avaliação.',
      entitySlug: 'chamados',
      templateType: 'single',
      content: {
        header: { title: { text: 'Relatório de atendimento {{numero}}', bold: true, fontSize: 14 }, showOnAllPages: true },
        body: [
          { id: 'ativo', type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Ativo:', binding: '{{_parent.codigo}} — {{_parent.nome}}', labelBold: true },
            { label: 'Local:', binding: '{{_parent.local}}', labelBold: true },
          ] },
          { id: 'div-0', type: 'divider', marginTop: 6, marginBottom: 6 },
          { id: 'chamado', type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Aberto em:', binding: '{{aberto_em}}', labelBold: true, format: 'datetime' },
            { label: 'Prazo (SLA):', binding: '{{prazo}}', labelBold: true, format: 'datetime' },
            { label: 'Categoria:', binding: '{{categoria}}', labelBold: true },
            { label: 'Prioridade:', binding: '{{prioridade}}', labelBold: true },
            { label: 'Solicitante:', binding: '{{solicitante}}', labelBold: true },
            { label: 'Responsável:', binding: '{{responsavel}}', labelBold: true },
            { label: 'Situação:', binding: '{{status}}', labelBold: true },
            { label: 'Resolvido em:', binding: '{{resolvido_em}}', labelBold: true, format: 'datetime' },
          ] },
          { id: 'problema', type: 'text', content: 'Problema: {{descricao}}', fontSize: 10, marginTop: 8 },
          { id: 'solucao', type: 'text', content: 'Solução: {{solucao}}', fontSize: 10, marginTop: 4 },
          { id: 'titulo-apont', type: 'text', content: 'Apontamentos', fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
          { id: 'tabela-apont', type: 'table', dataSource: 'apontamentos', showHeader: true, emptyMessage: 'Nenhum apontamento',
            headerStyle: { bold: true, fontSize: 8 }, cellStyle: { fontSize: 8 },
            columns: [
              { field: 'data', header: 'Data', width: 90, align: 'center', format: 'datetime' },
              { field: 'tecnico', header: 'Técnico', width: 100, align: 'left' },
              { field: 'horas', header: 'Horas', width: 50, align: 'center' },
              { field: 'descricao', header: 'O que foi feito', width: 220, align: 'left' },
            ] },
          { id: 'totais', type: 'field-group', layout: 'grid', columns: 3, marginTop: 8, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Horas:', binding: '{{horas_total}}', labelBold: true },
            { label: 'Material:', binding: '{{custo}}', labelBold: true, format: 'currency' },
            { label: 'Avaliação:', binding: '{{avaliacao}}', labelBold: true },
          ] },
          { id: 'foto', type: 'image-grid', columns: 2, marginTop: 12, imageWidth: 180, imageHeight: 120, showCaptions: true,
            dataSource: '_sem_filhos', imageFields: ['foto'],
            parentImageFields: ['foto'], captionFields: ['FOTO DO PROBLEMA'], captionFontSize: 7 },
        ],
        footer: { position: 'right', showPageNumbers: true },
        settings: { fileNamePattern: '{numero}' },
      },
    },
  ],
  commands: [
    {
      slug: 'chamado',
      description: 'Abrir um chamado de manutenção',
      icon: 'LifeBuoy',
      targetEntitySlug: 'chamados',
      actionType: 'create_record',
      actionConfig: {
        parentEntitySlug: 'ativos',
        parentSearchField: 'nome',
        formFields: [
          { slug: 'numero', source: 'target' }, { slug: 'categoria', source: 'target' }, { slug: 'prioridade', source: 'target' },
          { slug: 'solicitante', source: 'target' }, { slug: 'descricao', source: 'target' },
        ],
        fixedValues: [{ fieldSlug: 'status', value: 'aberto' }],
      },
    },
    {
      slug: 'abertos',
      description: 'Ver chamados abertos',
      icon: 'ListTodo',
      targetEntitySlug: 'chamados',
      actionType: 'query',
      actionConfig: {
        filters: [{ field: 'status', operator: 'equals', value: 'aberto' }],
        displayFields: ['numero', 'prioridade', 'descricao', 'solicitante'],
        formats: ['card', 'xlsx'],
      },
    },
  ],
  samples: {
    ativos: ATIVOS.map(([codigo, nome, tipo, local, criticidade, situacao, fabricante], i) => ({
      data: {
        codigo, nome, tipo, local, criticidade, situacao, fabricante,
        periodicidade: cycle(['30', '90', '180'], i),
        ultima_preventiva: daysAgo(10 + i * 6).slice(0, 10),
      },
      children: { chamados: sampleChamados(i, tipo, criticidade) },
    })),
  },
};
