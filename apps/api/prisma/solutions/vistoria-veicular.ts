import { C, field, opts, rows, section } from './layout';
import { PRAZO_ESPALHADO, cycle, dateAhead, daysAgo } from './samples';
import type { SampleRecord, SolutionSpec } from './types';

/**
 * Modelo "Vistoria veicular": frota -> vistorias (checklist, fotos, assinatura)
 * -> nao conformidades. Vistoriador usa o app (offline); gestor ve o painel.
 * Dados de exemplo ficticios.
 */

const RESULTADO = opts(
  ['aprovado', 'Aprovado', C.green],
  ['ressalvas', 'Aprovado com ressalvas', C.amber],
  ['reprovado', 'Reprovado', C.red],
);
const GRAVIDADE = opts(['baixa', 'Baixa', C.gray], ['media', 'Média', C.amber], ['alta', 'Alta', C.orange], ['critica', 'Crítica', C.red]);
const ITEM_NC = opts(
  ['pneus', 'Pneus'], ['freios', 'Freios'], ['iluminacao', 'Iluminação'], ['carroceria', 'Carroceria'],
  ['documentacao', 'Documentação'], ['seguranca', 'Itens de segurança'], ['motor', 'Motor / vazamentos'], ['outros', 'Outros'],
);

const naoConformidades = {
  slug: 'nao-conformidades',
  name: 'Não conformidade',
  namePlural: 'Não conformidades',
  description: 'Problemas encontrados na vistoria, com gravidade, foto e prazo de correção.',
  icon: 'AlertTriangle',
  color: C.red,
  category: 'Frota',
  subOf: 'vistorias',
  settings: { titleField: 'descricao', statusField: 'resolvida', doneValues: ['true'], deadlineField: 'prazo' },
  fields: rows(
    [
      field('item', 'Item', 'select', 6, { required: true, options: ITEM_NC }),
      field('gravidade', 'Gravidade', 'select', 6, { required: true, options: GRAVIDADE }),
    ],
    [field('descricao', 'O que foi encontrado', 'textarea', 12, { required: true, placeholder: 'Ex.: pneu dianteiro esquerdo com desgaste irregular' })],
    [
      field('foto', 'Foto', 'image', 6),
      field('prazo', 'Prazo para corrigir', 'date', 3),
      field('resolvida', 'Resolvida', 'boolean', 3, { default: false }),
    ],
  ),
};

const vistorias = {
  slug: 'vistorias',
  name: 'Vistoria',
  namePlural: 'Vistorias',
  description: 'Checklist do veículo com fotos, quilometragem e assinatura do motorista.',
  icon: 'ClipboardCheck',
  color: C.blue,
  category: 'Frota',
  subOf: 'veiculos',
  settings: { titleField: 'data', captureLocation: true },
  fields: rows(
    [
      field('data', 'Data e hora', 'datetime', 4, { required: true }),
      field('tipo', 'Tipo de vistoria', 'select', 4, {
        required: true,
        options: opts(['saida', 'Saída'], ['retorno', 'Retorno'], ['periodica', 'Periódica'], ['sinistro', 'Pós-sinistro']),
      }),
      field('motorista', 'Motorista', 'text', 4, { placeholder: 'Nome do motorista' }),
    ],
    [
      field('km', 'Quilometragem', 'number', 4, { required: true, suffix: ' km', min: 0 }),
      field('combustivel', 'Combustível', 'select', 4, {
        options: opts(['reserva', 'Reserva', C.red], ['1_4', '1/4', C.amber], ['1_2', '1/2'], ['3_4', '3/4'], ['cheio', 'Cheio', C.green]),
      }),
      field('resultado', 'Resultado', 'select', 4, { required: true, options: RESULTADO }),
    ],
    [section('sec_checklist', 'Checklist')],
    [
      field('pneus_ok', 'Pneus em bom estado', 'boolean', 4),
      field('freios_ok', 'Freios funcionando', 'boolean', 4),
      field('luzes_ok', 'Faróis e lanternas', 'boolean', 4),
    ],
    [
      field('documentos_ok', 'Documentos em dia', 'boolean', 4),
      field('extintor_ok', 'Extintor válido', 'boolean', 4),
      field('cintos_ok', 'Cintos de segurança', 'boolean', 4),
    ],
    [section('sec_fotos', 'Fotos do veículo')],
    [field('foto_frente', 'Frente', 'image', 6), field('foto_traseira', 'Traseira', 'image', 6)],
    [field('foto_esquerda', 'Lateral esquerda', 'image', 6), field('foto_direita', 'Lateral direita', 'image', 6)],
    [field('observacoes', 'Observações', 'textarea', 12, { placeholder: 'Algo mais que o gestor precisa saber' })],
    [
      field('nao_conformidades', 'Não conformidades', 'sub-entity', 12, {
        subEntitySlug: 'nao-conformidades',
        subEntityDisplayFields: ['item', 'gravidade', 'descricao', 'prazo', 'resolvida', 'foto'],
        parentDisplayField: 'data',
      }),
    ],
    [field('assinatura', 'Assinatura do motorista', 'signature', 12)],
  ),
};

const veiculos = {
  slug: 'veiculos',
  name: 'Veículo',
  namePlural: 'Veículos',
  description: 'Cadastro da frota com situação atual e histórico de vistorias.',
  icon: 'Truck',
  color: C.orange,
  category: 'Frota',
  settings: { titleField: 'placa' },
  fields: rows(
    [
      field('placa', 'Placa', 'text', 4, { required: true, unique: true, placeholder: 'ABC1D23' }),
      field('marca', 'Marca', 'select', 4, {
        required: true,
        options: opts(['volvo', 'Volvo'], ['scania', 'Scania'], ['mercedes', 'Mercedes-Benz'], ['volkswagen', 'Volkswagen'], ['daf', 'DAF'], ['iveco', 'Iveco']),
      }),
      field('modelo', 'Modelo', 'text', 4, { placeholder: 'Ex.: FH 540' }),
    ],
    [
      field('tipo', 'Tipo', 'select', 3, {
        options: opts(['cavalo', 'Cavalo mecânico'], ['carreta', 'Carreta'], ['truck', 'Truck'], ['utilitario', 'Utilitário']),
      }),
      field('ano', 'Ano', 'number', 3, { min: 1990, max: 2030 }),
      field('km_atual', 'Km atual', 'number', 3, { suffix: ' km', min: 0 }),
      field('status', 'Situação', 'select', 3, {
        required: true,
        options: opts(['disponivel', 'Disponível', C.green], ['em_rota', 'Em rota', C.blue], ['manutencao', 'Em manutenção', C.red], ['inativo', 'Inativo', C.gray]),
      }),
    ],
    [field('renavam', 'Renavam', 'text', 6), field('base', 'Base / filial', 'text', 6, { placeholder: 'Ex.: Campinas' })],
    [field('foto', 'Foto do veículo', 'image', 12)],
    [
      field('vistorias', 'Vistorias', 'sub-entity', 12, {
        subEntitySlug: 'vistorias',
        subEntityDisplayFields: ['data', 'tipo', 'motorista', 'km', 'resultado'],
        parentDisplayField: 'placa',
      }),
    ],
  ),
};

// ── Dados de exemplo (ficticios) ──────────────────────────────────────────
const FROTA: Array<[string, string, string, string, number, number, string, string]> = [
  ['RKT4A21', 'volvo', 'FH 540', 'cavalo', 2022, 182400, 'em_rota', 'Campinas'],
  ['QWE7B88', 'scania', 'R 450', 'cavalo', 2021, 241900, 'disponivel', 'Campinas'],
  ['PLM2C34', 'mercedes', 'Actros 2651', 'cavalo', 2023, 96300, 'em_rota', 'Jundiaí'],
  ['JHN5D09', 'volkswagen', 'Constellation 24.280', 'truck', 2020, 312500, 'manutencao', 'Jundiaí'],
  ['BVC8E61', 'daf', 'XF 530', 'cavalo', 2022, 158800, 'disponivel', 'Sorocaba'],
  ['TRE1F45', 'iveco', 'S-Way 480', 'cavalo', 2023, 74200, 'em_rota', 'Sorocaba'],
  ['MNB6G72', 'volvo', 'VM 330', 'truck', 2019, 401700, 'disponivel', 'Campinas'],
  ['ZXC3H18', 'scania', 'P 320', 'truck', 2021, 205300, 'em_rota', 'Jundiaí'],
  ['LKJ9J50', 'mercedes', 'Accelo 1017', 'utilitario', 2022, 88900, 'disponivel', 'Sorocaba'],
  ['GFD4K27', 'volkswagen', 'Delivery 11.180', 'utilitario', 2020, 154600, 'inativo', 'Campinas'],
];
const MOTORISTAS = ['Carlos Mendes', 'Ana Ribeiro', 'João Pereira', 'Marcos Lima', 'Fernanda Souza', 'Rafael Costa'];
const TIPOS = ['saida', 'retorno', 'periodica', 'saida', 'retorno'];
const NCS: Array<[string, string, string]> = [
  ['pneus', 'media', 'Pneu dianteiro esquerdo com desgaste irregular'],
  ['iluminacao', 'baixa', 'Lanterna traseira direita queimada'],
  ['freios', 'alta', 'Ruído ao frear e pedal baixo'],
  ['documentacao', 'media', 'CRLV vence em menos de 15 dias'],
  ['seguranca', 'critica', 'Extintor vencido'],
  ['carroceria', 'baixa', 'Amassado na lateral esquerda da carreta'],
  ['motor', 'alta', 'Vazamento de óleo sob o motor'],
];

function sampleVistorias(i: number, km: number): SampleRecord[] {
  // ~1 vistoria a cada 5 dias por veiculo nos ultimos 30 dias (painel com curva continua)
  const count = 5 + (i % 3);
  return Array.from({ length: count }, (_, j) => {
    const n = i * 7 + j;
    const resultado = n % 9 === 0 ? 'reprovado' : n % 4 === 0 ? 'ressalvas' : 'aprovado';
    const ok = resultado === 'aprovado';
    const ncs = resultado === 'aprovado' ? [] : [NCS[(i + j) % NCS.length], ...(resultado === 'reprovado' ? [NCS[(i + j + 3) % NCS.length]] : [])];
    return {
      data: {
        data: daysAgo((i * 11 + j * j * 3 + j * 4) % 30, 7 + (n % 10)),
        tipo: TIPOS[(i + j) % TIPOS.length],
        motorista: MOTORISTAS[(i + j) % MOTORISTAS.length],
        km: km - j * 900,
        combustivel: ['cheio', '3_4', '1_2', '1_4'][(i + j) % 4],
        resultado,
        pneus_ok: ok || ncs.every((n) => n[0] !== 'pneus'),
        freios_ok: ok || ncs.every((n) => n[0] !== 'freios'),
        luzes_ok: ok || ncs.every((n) => n[0] !== 'iluminacao'),
        documentos_ok: ok || ncs.every((n) => n[0] !== 'documentacao'),
        extintor_ok: ok || ncs.every((n) => n[0] !== 'seguranca'),
        cintos_ok: true,
        observacoes: ok ? 'Veículo liberado sem pendências.' : 'Liberação condicionada à correção dos itens apontados.',
      },
      children: {
        'nao-conformidades': ncs.map(([item, gravidade, descricao], k) => ({
          data: { item, gravidade, descricao, prazo: dateAhead(cycle(PRAZO_ESPALHADO, i * 3 + k)), resolvida: j > 0 },
        })),
      },
    };
  });
}

export const vistoriaVeicular: SolutionSpec = {
  slug: 'vistoria-veicular',
  tenantName: 'Modelo — Vistoria veicular',
  brandColor: '#ea580c',
  entities: [naoConformidades, vistorias, veiculos],
  roles: [
    {
      name: 'Vistoriador',
      description: 'Faz vistorias no app (inclusive sem internet) e registra não conformidades.',
      color: C.blue,
      permissions: [
        { entitySlug: 'veiculos', canRead: true, canCreate: false, canUpdate: false, canDelete: false, scope: 'all' },
        { entitySlug: 'vistorias', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'own' },
        { entitySlug: 'nao-conformidades', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'own' },
      ],
      modulePermissions: { dashboard: { canRead: true }, data: { canRead: true, canCreate: true, canUpdate: true }, templates: { canRead: true, canGenerate: true } },
    },
    {
      name: 'Gestor de frota',
      description: 'Acompanha o painel, cobra as correções e gera os laudos.',
      color: C.orange,
      permissions: [
        { entitySlug: '*', canRead: true, canCreate: true, canUpdate: true, canDelete: true, canExport: true, scope: 'all' },
      ],
      modulePermissions: {
        dashboard: { canRead: true }, data: { canRead: true, canCreate: true, canUpdate: true, canDelete: true },
        templates: { canRead: true, canGenerate: true }, chat: { manage: true },
      },
    },
  ],
  dashboards: [
    {
      name: 'Painel da frota',
      description: 'Situação da frota, resultado das vistorias e não conformidades abertas.',
      entitySlug: 'veiculos',
      roles: ['Administrador', 'Gestor de frota', 'Gerente'],
      priority: 20, // maior aparece primeiro
      tabs: [
        {
          id: 'visao-geral',
          label: 'Visão geral',
          rows: [
            [
              { id: 'kpi-veiculos', type: 'kpi-card', title: 'Veículos', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'veiculos' } },
              { id: 'kpi-vistorias', type: 'kpi-card', title: 'Vistorias', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'vistorias' } },
              { id: 'kpi-ncs', type: 'kpi-card', title: 'Não conformidades', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'nao-conformidades' } },
              { id: 'kpi-km', type: 'kpi-card', title: 'Km médio da frota', w: 3, h: 3, config: { fieldSlug: 'km_atual', aggregation: 'avg', entitySlugOverride: 'veiculos' } },
            ],
            [
              { id: 'line-vistorias', type: 'line-chart', title: 'Vistorias por dia', w: 8, h: 7, config: { days: 30, chartColor: '#2563eb', dataSource: 'records-over-time', dateField: 'data', entitySlugOverride: 'vistorias' } },
              { id: 'donut-resultado', type: 'donut-chart', title: 'Resultado das vistorias', w: 4, h: 7, config: { dataSource: 'field-distribution', groupByField: 'resultado', showLegend: true, entitySlugOverride: 'vistorias' } },
            ],
            [
              { id: 'bar-item', type: 'bar-chart', title: 'Não conformidades por item', w: 6, h: 7, config: { dataSource: 'field-distribution', groupByField: 'item', chartColors: ['#ea580c'], entitySlugOverride: 'nao-conformidades' } },
              { id: 'stat-gravidade', type: 'stat-list', title: 'Por gravidade', w: 6, h: 7, config: { listStyle: 'colored', showTotal: true, groupByField: 'gravidade', entitySlugOverride: 'nao-conformidades' } },
            ],
          ],
        },
        {
          id: 'frota',
          label: 'Frota',
          rows: [
            [
              { id: 'bar-status', type: 'bar-chart', title: 'Situação da frota', w: 6, h: 7, config: { dataSource: 'field-distribution', groupByField: 'status', entitySlugOverride: 'veiculos' } },
              { id: 'donut-marca', type: 'donut-chart', title: 'Frota por marca', w: 6, h: 7, config: { dataSource: 'field-distribution', groupByField: 'marca', showLegend: true, entitySlugOverride: 'veiculos' } },
            ],
            [
              { id: 'dt-veiculos', type: 'data-table', title: 'Veículos', w: 12, h: 10, config: { pageSize: 25, allowEdit: true, allowCreate: true, allowDelete: true, allowExport: true, allowImport: true, allowBatchSelect: true, displayFields: ['placa', 'marca', 'modelo', 'tipo', 'km_atual', 'status', 'base'], defaultSortField: 'placa', defaultSortOrder: 'asc', entitySlugOverride: 'veiculos' } },
            ],
          ],
        },
        {
          id: 'pendencias',
          label: 'Pendências',
          rows: [
            [
              { id: 'mt-ncs', type: 'mini-table', title: 'Não conformidades por prazo', w: 8, h: 9, config: { limit: 10, sortBy: 'prazo', sortOrder: 'asc', displayFields: ['item', 'gravidade', 'descricao', 'prazo', 'resolvida'], entitySlugOverride: 'nao-conformidades' } },
              { id: 'donut-resolvidas', type: 'donut-chart', title: 'Resolvidas', w: 4, h: 9, config: { dataSource: 'field-distribution', groupByField: 'resolvida', showLegend: true, entitySlugOverride: 'nao-conformidades' } },
            ],
          ],
        },
      ],
    },
    {
      name: 'Minhas vistorias',
      description: 'O que o vistoriador fez e o que ficou pendente.',
      entitySlug: 'veiculos',
      roles: ['Vistoriador'],
      priority: 10,
      tabs: [
        {
          id: 'minhas',
          label: 'Minhas vistorias',
          rows: [
            [
              { id: 'kpi-minhas', type: 'kpi-card', title: 'Minhas vistorias', w: 6, h: 3, config: { aggregation: 'count', entitySlugOverride: 'vistorias' } },
              { id: 'kpi-minhas-ncs', type: 'kpi-card', title: 'Não conformidades apontadas', w: 6, h: 3, config: { aggregation: 'count', entitySlugOverride: 'nao-conformidades' } },
            ],
            [
              { id: 'dt-frota', type: 'data-table', title: 'Frota', w: 12, h: 10, config: { pageSize: 25, allowEdit: false, allowCreate: false, allowDelete: false, allowExport: false, displayFields: ['placa', 'marca', 'modelo', 'status', 'base'], defaultSortField: 'placa', defaultSortOrder: 'asc', entitySlugOverride: 'veiculos' } },
            ],
          ],
        },
      ],
    },
  ],
  pdfs: [
    {
      name: 'Laudo de vistoria',
      slug: 'laudo-vistoria',
      description: 'Laudo da vistoria com checklist, fotos, não conformidades e assinatura.',
      entitySlug: 'vistorias',
      templateType: 'single',
      content: {
        header: { title: { text: 'Laudo de vistoria veicular', bold: true, fontSize: 14 }, showOnAllPages: true },
        body: [
          { id: 'veiculo', type: 'field-group', layout: 'grid', columns: 3, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Placa:', binding: '{{_parent.placa}}', labelBold: true },
            { label: 'Modelo:', binding: '{{_parent.modelo}}', labelBold: true },
            { label: 'Base:', binding: '{{_parent.base}}', labelBold: true },
          ] },
          { id: 'vistoria', type: 'field-group', layout: 'grid', columns: 2, marginTop: 4, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Data:', binding: '{{data}}', labelBold: true, format: 'datetime' },
            { label: 'Tipo:', binding: '{{tipo}}', labelBold: true },
            { label: 'Km:', binding: '{{km}}', labelBold: true },
            { label: 'Motorista:', binding: '{{motorista}}', labelBold: true },
          ] },
          { id: 'resultado', type: 'text', content: 'Resultado: {{resultado}}', fontSize: 12, fontWeight: 'bold', marginTop: 10 },
          { id: 'div-1', type: 'divider', marginTop: 8, marginBottom: 8 },
          { id: 'titulo-checklist', type: 'text', content: 'Checklist', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
          { id: 'checklist', type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 9, lineSpacing: 16, fields: [
            { label: 'Pneus em bom estado:', binding: '{{pneus_ok}}' },
            { label: 'Freios funcionando:', binding: '{{freios_ok}}' },
            { label: 'Faróis e lanternas:', binding: '{{luzes_ok}}' },
            { label: 'Documentos em dia:', binding: '{{documentos_ok}}' },
            { label: 'Extintor válido:', binding: '{{extintor_ok}}' },
            { label: 'Cintos de segurança:', binding: '{{cintos_ok}}' },
          ] },
          { id: 'titulo-ncs', type: 'text', content: 'Não conformidades', fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
          { id: 'tabela-ncs', type: 'table', dataSource: 'nao_conformidades', showHeader: true, emptyMessage: 'Nenhuma não conformidade registrada',
            headerStyle: { bold: true, fontSize: 8 }, cellStyle: { fontSize: 8 },
            columns: [
              { field: 'item', header: 'Item', width: 90, align: 'left' },
              { field: 'gravidade', header: 'Gravidade', width: 70, align: 'center' },
              { field: 'descricao', header: 'Descrição', width: 230, align: 'left' },
              { field: 'prazo', header: 'Prazo', width: 70, align: 'center', format: 'date' },
            ] },
          // Modo misto do image-grid: fotos da propria vistoria + foto de cada nao conformidade.
          { id: 'fotos', type: 'image-grid', columns: 5, marginTop: 12, imageWidth: 84, imageHeight: 63, showCaptions: true,
            dataSource: 'nao_conformidades', imageFields: ['foto'],
            parentImageFields: ['foto_frente', 'foto_traseira', 'foto_esquerda', 'foto_direita'],
            captionFields: ['FRENTE', 'TRASEIRA', 'ESQUERDA', 'DIREITA', 'NÃO CONFORMIDADE'], captionFontSize: 7 },
          { id: 'obs', type: 'text', content: 'Observações: {{observacoes}}', fontSize: 9, marginTop: 10 },
          { id: 'assinatura', type: 'image-grid', columns: 2, marginTop: 14, imageWidth: 160, imageHeight: 60, showCaptions: true,
            dataSource: '_sem_filhos', imageFields: ['assinatura'],
            parentImageFields: ['assinatura'], captionFields: ['Assinatura do motorista'], captionFontSize: 7 },
        ],
        footer: { position: 'right', showPageNumbers: true },
        settings: { fileNamePattern: 'laudo-{data}' },
      },
    },
  ],
  commands: [
    {
      slug: 'vistoria',
      description: 'Registrar vistoria de um veículo',
      icon: 'ClipboardCheck',
      targetEntitySlug: 'vistorias',
      actionType: 'create_record',
      actionConfig: {
        parentEntitySlug: 'veiculos',
        parentSearchField: 'placa',
        formFields: [
          { slug: 'tipo', source: 'target' }, { slug: 'km', source: 'target' }, { slug: 'motorista', source: 'target' },
          { slug: 'resultado', source: 'target' }, { slug: 'observacoes', source: 'target' },
        ],
        fixedValues: [],
      },
    },
    {
      slug: 'pendencias',
      description: 'Consultar não conformidades abertas',
      icon: 'AlertTriangle',
      targetEntitySlug: 'nao-conformidades',
      actionType: 'query',
      actionConfig: {
        filters: [{ field: 'resolvida', operator: 'equals', value: false }],
        displayFields: ['item', 'gravidade', 'descricao', 'prazo'],
        formats: ['card', 'xlsx'],
      },
    },
  ],
  samples: {
    veiculos: FROTA.map(([placa, marca, modelo, tipo, ano, km_atual, status, base], i) => ({
      data: { placa, marca, modelo, tipo, ano, km_atual, status, base, renavam: String(1000000000 + i * 7919) },
      children: { vistorias: sampleVistorias(i, km_atual) },
    })),
  },
};
