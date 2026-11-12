import { C, field, opts, rows, section } from './layout';
import { PRAZO_ESPALHADO, cycle, dateAhead, daysAgo } from './samples';
import type { SampleRecord, SolutionSpec } from './types';

/**
 * Modelo "Gestão de sinistros": segurados -> sinistros (fotos, documentos, prazo,
 * regulação, valores) -> andamentos. Regulador trabalha no app; analista ve o
 * painel e gera o relatório. Dados de exemplo ficticios (nada de clientes reais).
 */

const STATUS = opts(
  ['aberto', 'Aberto', C.blue],
  ['documentacao', 'Aguardando documentos', C.amber],
  ['vistoria', 'Vistoria agendada', C.violet],
  ['regulacao', 'Em regulação', C.orange],
  ['aprovado', 'Aprovado', C.teal],
  ['indenizado', 'Indenizado', C.green],
  ['negado', 'Negado', C.gray],
);
const TIPO = opts(
  ['colisao', 'Colisão'], ['roubo_furto', 'Roubo / furto'], ['terceiros', 'Danos a terceiros'],
  ['alagamento', 'Alagamento'], ['incendio', 'Incêndio'], ['vidros', 'Vidros'], ['natural', 'Fenômeno natural'],
);
const PRIORIDADE = opts(['baixa', 'Baixa', C.gray], ['normal', 'Normal', C.blue], ['alta', 'Alta', C.orange], ['urgente', 'Urgente', C.red]);
const TIPO_ANDAMENTO = opts(
  ['contato', 'Contato com o segurado'], ['documento', 'Documento recebido'], ['vistoria', 'Vistoria realizada'],
  ['parecer', 'Parecer técnico'], ['pagamento', 'Pagamento'],
);

const andamentos = {
  slug: 'andamentos',
  name: 'Andamento',
  namePlural: 'Andamentos',
  description: 'Histórico do sinistro: contatos, documentos, vistoria, parecer e pagamento.',
  icon: 'ListChecks',
  color: C.teal,
  category: 'Sinistros',
  subOf: 'sinistros',
  settings: { titleField: 'descricao' },
  fields: rows(
    [
      field('data', 'Data e hora', 'datetime', 4, { required: true }),
      field('tipo', 'Tipo', 'select', 4, { required: true, options: TIPO_ANDAMENTO }),
      field('responsavel', 'Responsável', 'text', 4),
    ],
    [field('descricao', 'O que aconteceu', 'textarea', 12, { required: true, placeholder: 'Ex.: segurado enviou o boletim de ocorrência' })],
    [field('anexo', 'Anexo', 'file', 12)],
  ),
};

const sinistros = {
  slug: 'sinistros',
  name: 'Sinistro',
  namePlural: 'Sinistros',
  description: 'Aviso, regulação e indenização: fotos, documentos, prazo, valores e parecer.',
  icon: 'ShieldAlert',
  color: C.red,
  category: 'Sinistros',
  subOf: 'segurados',
  settings: {
    titleField: 'numero', captureLocation: true,
    statusField: 'status', doneValues: ['indenizado', 'negado'], deadlineField: 'prazo',
  },
  fields: rows(
    [
      field('numero', 'Nº do sinistro', 'text', 3, { unique: true, placeholder: 'SIN-0001', helpText: 'A equipe preenche ao receber o aviso' }),
      field('data_ocorrencia', 'Data da ocorrência', 'datetime', 3, { required: true }),
      field('tipo', 'Tipo', 'select', 3, { required: true, options: TIPO }),
      field('prioridade', 'Prioridade', 'select', 3, { required: true, default: 'normal', options: PRIORIDADE }),
    ],
    [
      field('status', 'Situação', 'select', 4, { required: true, options: STATUS }),
      field('regulador', 'Regulador', 'text', 4, { placeholder: 'Quem regula o sinistro' }),
      field('prazo', 'Prazo', 'date', 4, { helpText: 'Data limite para a próxima etapa' }),
    ],
    [field('local', 'Local da ocorrência', 'text', 12, { placeholder: 'Ex.: Av. Brasil, 1500 — Campinas' })],
    [field('descricao', 'Relato do segurado', 'textarea', 12, { required: true })],
    [section('sec_valores', 'Valores')],
    [
      field('valor_estimado', 'Valor estimado', 'currency', 6, { prefix: 'R$' }),
      field('valor_indenizado', 'Valor indenizado', 'currency', 6, { prefix: 'R$' }),
    ],
    [section('sec_fotos', 'Fotos e documentos')],
    [field('foto_1', 'Foto do dano', 'image', 6), field('foto_2', 'Foto geral', 'image', 6)],
    [field('boletim', 'Boletim de ocorrência', 'file', 6), field('documentos', 'Outros documentos', 'file', 6)],
    [
      field('andamentos', 'Andamentos', 'sub-entity', 12, {
        subEntitySlug: 'andamentos',
        subEntityDisplayFields: ['data', 'tipo', 'descricao', 'responsavel'],
        parentDisplayField: 'numero',
      }),
    ],
    [field('parecer', 'Parecer do regulador', 'textarea', 12)],
    [field('assinatura', 'Assinatura do segurado', 'signature', 12)],
  ),
};

const segurados = {
  slug: 'segurados',
  name: 'Segurado',
  namePlural: 'Segurados',
  description: 'Quem tem o seguro: contato, apólice e o bem segurado.',
  icon: 'UserRound',
  color: C.blue,
  category: 'Sinistros',
  settings: { titleField: 'nome' },
  fields: rows(
    [
      field('nome', 'Nome', 'text', 6, { required: true }),
      field('documento', 'CPF / CNPJ', 'text', 3),
      field('telefone', 'Telefone', 'phone', 3),
    ],
    [
      field('email', 'E-mail', 'email', 4),
      field('apolice', 'Nº da apólice', 'text', 4),
      field('seguradora', 'Seguradora', 'select', 4, {
        options: opts(['alfa', 'Seguradora Alfa'], ['beta', 'Beta Seguros'], ['gama', 'Gama Seguradora'], ['delta', 'Delta Proteção']),
      }),
    ],
    [field('bem', 'Bem segurado', 'text', 8, { placeholder: 'Ex.: Fiat Strada 2022, placa ABC1D23' }), field('cidade', 'Cidade', 'text', 4)],
    [
      field('sinistros', 'Sinistros', 'sub-entity', 12, {
        subEntitySlug: 'sinistros',
        subEntityDisplayFields: ['numero', 'data_ocorrencia', 'tipo', 'status', 'valor_estimado'],
        parentDisplayField: 'nome',
      }),
    ],
  ),
};

// ── Dados de exemplo (ficticios) ──────────────────────────────────────────
const SEGURADOS: Array<[string, string, string, string, string]> = [
  ['Patrícia Almeida', 'alfa', 'Fiat Strada 2022, placa RTA3B21', 'Campinas', '(19) 99812-4410'],
  ['Transportes Horizonte Ltda', 'beta', 'Frota de 12 caminhões', 'Jundiaí', '(11) 4521-8800'],
  ['Rodrigo Siqueira', 'gama', 'Honda Civic 2021, placa QWE4C55', 'Sorocaba', '(15) 99731-2208'],
  ['Mercado Bom Preço', 'alfa', 'Loja e estoque — Rua das Flores, 210', 'Campinas', '(19) 3241-7700'],
  ['Juliana Prado', 'delta', 'Apartamento 52 — Ed. Aurora', 'Valinhos', '(19) 99104-6632'],
  ['Clínica Vida Plena', 'beta', 'Equipamentos de imagem', 'Jundiaí', '(11) 4588-1290'],
  ['André Nogueira', 'gama', 'Toyota Hilux 2023, placa PLK7D12', 'Indaiatuba', '(19) 99655-0137'],
  ['Padaria Trigo de Ouro', 'delta', 'Loja — Av. Brasil, 1500', 'Campinas', '(19) 3254-9921'],
];
const STATUS_CICLO = ['regulacao', 'indenizado', 'documentacao', 'vistoria', 'indenizado', 'aberto', 'aprovado', 'negado', 'regulacao', 'indenizado'];
const TIPO_POR_BEM = (bem: string) => (/placa|caminh/i.test(bem) ? ['colisao', 'roubo_furto', 'terceiros', 'vidros'] : ['alagamento', 'incendio', 'natural']);
const RELATOS: Record<string, string> = {
  colisao: 'Colisão traseira em cruzamento; danos no para-choque e na tampa traseira.',
  roubo_furto: 'Veículo levado do estacionamento durante a noite; boletim registrado.',
  terceiros: 'Ao manobrar, atingiu o portão de um vizinho.',
  vidros: 'Para-brisa trincado por pedra na rodovia.',
  alagamento: 'Água da chuva entrou pelo térreo e danificou móveis e mercadorias.',
  incendio: 'Curto-circuito no quadro elétrico com fogo na área dos fundos.',
  natural: 'Queda de árvore sobre o telhado durante temporal.',
};
const REGULADORES = ['Marcelo Tavares', 'Luciana Freitas', 'Eduardo Ramos'];

let numeroSinistro = 0;
function sampleSinistros(i: number, bem: string): SampleRecord[] {
  const count = 2 + (i % 3);
  const tipos = TIPO_POR_BEM(bem);
  return Array.from({ length: count }, (_, j) => {
    const n = i * 4 + j;
    const status = cycle(STATUS_CICLO, n);
    const tipo = cycle(tipos, n);
    const encerrado = status === 'indenizado' || status === 'negado';
    const dias = encerrado ? 12 + ((i * 7 + j * 5) % 18) : 2 + ((i + j * 3) % 9);
    const estimado = 1800 + ((n * 2371) % 38000);
    numeroSinistro += 1;
    const andamentosN = encerrado ? 3 : 1 + (n % 2);
    return {
      data: {
        numero: `SIN-${String(1000 + numeroSinistro)}`,
        data_ocorrencia: daysAgo(dias, 9 + (n % 8)),
        tipo,
        prioridade: cycle(['normal', 'alta', 'normal', 'urgente', 'baixa'], n),
        status,
        regulador: cycle(REGULADORES, n),
        // Em aberto: prazo espalhado em volta de hoje (pendencias realistas)
        prazo: encerrado ? daysAgo(Math.max(dias - 6, 0)).slice(0, 10) : dateAhead(cycle(PRAZO_ESPALHADO, n)),
        local: cycle(['Av. Norte-Sul, 800', 'Rod. Anhanguera, km 98', 'Rua XV de Novembro, 45', 'Av. das Amoreiras, 1200'], n),
        descricao: RELATOS[tipo],
        valor_estimado: estimado,
        ...(status === 'indenizado' ? { valor_indenizado: Math.round(estimado * 0.85) } : {}),
        ...(encerrado ? { parecer: status === 'indenizado' ? 'Cobertura confirmada; danos compatíveis com o relato. Indenização aprovada.' : 'Evento fora da cobertura contratada (cláusula de exclusão).' } : {}),
      },
      children: {
        andamentos: Array.from({ length: andamentosN }, (_, k) => ({
          data: {
            data: daysAgo(Math.max(dias - k * 3, 0), 10 + k),
            tipo: ['contato', 'documento', 'vistoria', 'parecer'][k] ?? 'contato',
            descricao: ['Contato com o segurado e abertura do aviso.', 'Recebidos o boletim de ocorrência e as fotos.', 'Vistoria realizada no local; danos registrados.', 'Parecer técnico concluído.'][k],
            responsavel: cycle(REGULADORES, n),
          },
        })),
      },
    };
  });
}

export const sinistrosModelo: SolutionSpec = {
  slug: 'gestao-sinistros',
  tenantName: 'Modelo — Gestão de sinistros',
  brandColor: '#dc2626',
  entities: [andamentos, sinistros, segurados],
  roles: [
    {
      name: 'Regulador',
      description: 'Faz a vistoria e a regulação no app, registra andamentos e o parecer.',
      color: C.orange,
      permissions: [
        { entitySlug: 'segurados', canRead: true, canCreate: false, canUpdate: false, canDelete: false, scope: 'all' },
        { entitySlug: 'sinistros', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'own' },
        { entitySlug: 'andamentos', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'own' },
      ],
      modulePermissions: { dashboard: { canRead: true }, data: { canRead: true, canCreate: true, canUpdate: true }, templates: { canRead: true, canGenerate: true } },
    },
    {
      name: 'Analista de sinistros',
      description: 'Recebe os avisos, cobra documentos, acompanha prazos e gera os relatórios.',
      color: C.red,
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
      name: 'Painel de sinistros',
      description: 'Sinistros por situação e tipo, valores estimados e indenizados e a fila por prazo.',
      entitySlug: 'segurados',
      roles: ['Administrador', 'Analista de sinistros', 'Gerente'],
      priority: 20,
      tabs: [
        {
          id: 'visao-geral',
          label: 'Visão geral',
          rows: [
            [
              { id: 'kpi-sinistros', type: 'kpi-card', title: 'Sinistros', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'sinistros' } },
              { id: 'kpi-estimado', type: 'kpi-card', title: 'Valor estimado', w: 3, h: 3, config: { fieldSlug: 'valor_estimado', aggregation: 'sum', entitySlugOverride: 'sinistros' } },
              { id: 'kpi-indenizado', type: 'kpi-card', title: 'Valor indenizado', w: 3, h: 3, config: { fieldSlug: 'valor_indenizado', aggregation: 'sum', entitySlugOverride: 'sinistros' } },
              { id: 'kpi-segurados', type: 'kpi-card', title: 'Segurados', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'segurados' } },
            ],
            [
              { id: 'line-avisos', type: 'line-chart', title: 'Avisos de sinistro por dia', w: 8, h: 7, config: { days: 30, chartColor: '#dc2626', dataSource: 'records-over-time', dateField: 'data_ocorrencia', entitySlugOverride: 'sinistros' } },
              { id: 'donut-status', type: 'donut-chart', title: 'Situação', w: 4, h: 7, config: { dataSource: 'field-distribution', groupByField: 'status', showLegend: true, entitySlugOverride: 'sinistros' } },
            ],
            [
              { id: 'bar-tipo', type: 'bar-chart', title: 'Por tipo de sinistro', w: 6, h: 7, config: { dataSource: 'field-distribution', groupByField: 'tipo', chartColors: ['#dc2626'], entitySlugOverride: 'sinistros' } },
              { id: 'stat-prioridade', type: 'stat-list', title: 'Por prioridade', w: 6, h: 7, config: { listStyle: 'colored', showTotal: true, groupByField: 'prioridade', entitySlugOverride: 'sinistros' } },
            ],
          ],
        },
        {
          id: 'fila',
          label: 'Fila',
          rows: [
            [
              { id: 'kanban-status', type: 'kanban-board', title: 'Sinistros por situação', w: 12, h: 13, config: { groupByField: 'status', cardTitleField: 'numero', cardSubtitleFields: ['tipo', 'regulador', 'prazo'], cardBadgeField: 'prioridade', columnOrder: ['aberto', 'documentacao', 'vistoria', 'regulacao', 'aprovado', 'indenizado', 'negado'], limit: 100, entitySlugOverride: 'sinistros' } },
            ],
            [
              { id: 'mt-prazo', type: 'mini-table', title: 'Próximos prazos', w: 12, h: 8, config: { limit: 10, sortBy: 'prazo', sortOrder: 'asc', displayFields: ['numero', 'tipo', 'status', 'prazo', 'regulador'], entitySlugOverride: 'sinistros' } },
            ],
          ],
        },
        {
          id: 'segurados',
          label: 'Segurados',
          rows: [
            [
              { id: 'dt-segurados', type: 'data-table', title: 'Segurados', w: 12, h: 10, config: { pageSize: 25, allowEdit: true, allowCreate: true, allowDelete: true, allowExport: true, allowImport: true, allowBatchSelect: true, displayFields: ['nome', 'documento', 'telefone', 'apolice', 'seguradora', 'cidade'], defaultSortField: 'nome', defaultSortOrder: 'asc', entitySlugOverride: 'segurados' } },
            ],
          ],
        },
      ],
    },
    {
      name: 'Meus sinistros',
      description: 'O que o regulador tem para fazer e os prazos.',
      entitySlug: 'segurados',
      roles: ['Regulador'],
      priority: 10,
      tabs: [
        {
          id: 'meus',
          label: 'Meus sinistros',
          rows: [
            [
              { id: 'kpi-meus', type: 'kpi-card', title: 'Meus sinistros', w: 6, h: 3, config: { aggregation: 'count', entitySlugOverride: 'sinistros' } },
              { id: 'kpi-meus-andamentos', type: 'kpi-card', title: 'Andamentos registrados', w: 6, h: 3, config: { aggregation: 'count', entitySlugOverride: 'andamentos' } },
            ],
            [
              { id: 'mt-meus', type: 'mini-table', title: 'Por prazo', w: 12, h: 9, config: { limit: 15, sortBy: 'prazo', sortOrder: 'asc', displayFields: ['numero', 'tipo', 'status', 'prazo'], entitySlugOverride: 'sinistros' } },
            ],
          ],
        },
      ],
    },
  ],
  pdfs: [
    {
      name: 'Relatório de sinistro',
      slug: 'relatorio-sinistro',
      description: 'Relatório de regulação com segurado, ocorrência, valores, andamentos, fotos e parecer.',
      entitySlug: 'sinistros',
      templateType: 'single',
      content: {
        header: { title: { text: 'Relatório de sinistro {{numero}}', bold: true, fontSize: 14 }, showOnAllPages: true },
        body: [
          { id: 'segurado', type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Segurado:', binding: '{{_parent.nome}}', labelBold: true },
            { label: 'Apólice:', binding: '{{_parent.apolice}}', labelBold: true },
            { label: 'Bem segurado:', binding: '{{_parent.bem}}', labelBold: true },
            { label: 'Seguradora:', binding: '{{_parent.seguradora}}', labelBold: true },
          ] },
          { id: 'div-0', type: 'divider', marginTop: 6, marginBottom: 6 },
          { id: 'ocorrencia', type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Ocorrência:', binding: '{{data_ocorrencia}}', labelBold: true, format: 'datetime' },
            { label: 'Tipo:', binding: '{{tipo}}', labelBold: true },
            { label: 'Situação:', binding: '{{status}}', labelBold: true },
            { label: 'Regulador:', binding: '{{regulador}}', labelBold: true },
            { label: 'Valor estimado:', binding: '{{valor_estimado}}', labelBold: true, format: 'currency' },
            { label: 'Valor indenizado:', binding: '{{valor_indenizado}}', labelBold: true, format: 'currency' },
          ] },
          { id: 'local', type: 'text', content: 'Local: {{local}}', fontSize: 9, marginTop: 6 },
          { id: 'relato', type: 'text', content: 'Relato do segurado: {{descricao}}', fontSize: 9, marginTop: 4 },
          { id: 'titulo-andamentos', type: 'text', content: 'Andamentos', fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
          { id: 'tabela-andamentos', type: 'table', dataSource: 'andamentos', showHeader: true, emptyMessage: 'Nenhum andamento registrado',
            headerStyle: { bold: true, fontSize: 8 }, cellStyle: { fontSize: 8 },
            columns: [
              { field: 'data', header: 'Data', width: 90, align: 'left', format: 'datetime' },
              { field: 'tipo', header: 'Tipo', width: 110, align: 'left' },
              { field: 'descricao', header: 'Descrição', width: 230, align: 'left' },
              { field: 'responsavel', header: 'Responsável', width: 90, align: 'left' },
            ] },
          { id: 'fotos', type: 'image-grid', columns: 2, marginTop: 12, imageWidth: 180, imageHeight: 120, showCaptions: true,
            dataSource: '_sem_filhos', imageFields: ['foto_1'],
            parentImageFields: ['foto_1', 'foto_2'], captionFields: ['DANO', 'VISÃO GERAL'], captionFontSize: 7 },
          { id: 'parecer', type: 'text', content: 'Parecer do regulador: {{parecer}}', fontSize: 9, marginTop: 10 },
          { id: 'assinatura', type: 'image-grid', columns: 2, marginTop: 14, imageWidth: 160, imageHeight: 60, showCaptions: true,
            dataSource: '_sem_filhos', imageFields: ['assinatura'],
            parentImageFields: ['assinatura'], captionFields: ['Assinatura do segurado'], captionFontSize: 7 },
        ],
        footer: { position: 'right', showPageNumbers: true },
        settings: { fileNamePattern: '{numero}' },
      },
    },
  ],
  commands: [
    {
      slug: 'sinistro',
      description: 'Abrir um aviso de sinistro para um segurado',
      icon: 'ShieldAlert',
      targetEntitySlug: 'sinistros',
      actionType: 'create_record',
      actionConfig: {
        parentEntitySlug: 'segurados',
        parentSearchField: 'nome',
        formFields: [
          { slug: 'numero', source: 'target' }, { slug: 'tipo', source: 'target' }, { slug: 'prioridade', source: 'target' },
          { slug: 'local', source: 'target' }, { slug: 'descricao', source: 'target' },
        ],
        fixedValues: [{ fieldSlug: 'status', value: 'aberto' }],
      },
    },
    {
      slug: 'documentos',
      description: 'Sinistros aguardando documentos do segurado',
      icon: 'FileWarning',
      targetEntitySlug: 'sinistros',
      actionType: 'query',
      actionConfig: {
        filters: [{ field: 'status', operator: 'equals', value: 'documentacao' }],
        displayFields: ['numero', 'tipo', 'prazo', 'regulador'],
        formats: ['card', 'xlsx'],
      },
    },
  ],
  samples: {
    segurados: SEGURADOS.map(([nome, seguradora, bem, cidade, telefone], i) => ({
      data: {
        nome, seguradora, bem, cidade, telefone,
        apolice: `AP-${String(48000 + i * 137)}`,
        email: `contato${i + 1}@exemplo.com.br`,
      },
      children: { sinistros: sampleSinistros(i, bem) },
    })),
  },
};
