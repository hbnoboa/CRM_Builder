import { C, field, opts, rows, section } from './layout';
import { PRAZO_ESPALHADO, cycle, dateAhead, daysAgo } from './samples';
import type { SampleRecord, SolutionSpec } from './types';

/**
 * Modelo "Ordem de servico": clientes -> ordens de servico -> itens (pecas e
 * servicos). Atendente abre a OS, tecnico executa em campo (app offline) com
 * fotos e assinatura do cliente. Dados de exemplo ficticios.
 */

const STATUS = opts(
  ['aberta', 'Aberta', C.blue],
  ['agendada', 'Agendada', C.violet],
  ['em_execucao', 'Em execução', C.amber],
  ['aguardando_peca', 'Aguardando peça', C.orange],
  ['concluida', 'Concluída', C.green],
  ['cancelada', 'Cancelada', C.gray],
);
const PRIORIDADE = opts(['baixa', 'Baixa', C.gray], ['normal', 'Normal', C.blue], ['alta', 'Alta', C.orange], ['urgente', 'Urgente', C.red]);
const TIPO_OS = opts(['instalacao', 'Instalação'], ['manutencao', 'Manutenção preventiva'], ['reparo', 'Reparo'], ['visita', 'Visita técnica']);

const itensOs = {
  slug: 'itens-os',
  name: 'Item da OS',
  namePlural: 'Itens da OS',
  description: 'Peças e serviços usados na ordem de serviço, com quantidade e valor.',
  icon: 'Package',
  color: C.teal,
  category: 'Serviços',
  subOf: 'ordens-servico',
  settings: { titleField: 'descricao' },
  fields: rows(
    [
      field('tipo', 'Tipo', 'select', 3, { required: true, options: opts(['peca', 'Peça', C.violet], ['servico', 'Serviço', C.blue]) }),
      field('descricao', 'Descrição', 'text', 9, { required: true, placeholder: 'Ex.: Capacitor 35µF' }),
    ],
    [
      field('quantidade', 'Quantidade', 'number', 4, { required: true, min: 0, default: 1 }),
      field('valor_unitario', 'Valor unitário', 'currency', 4, { min: 0 }),
      field('valor_total', 'Total', 'currency', 4, { min: 0 }),
    ],
  ),
};

const ordens = {
  slug: 'ordens-servico',
  name: 'Ordem de serviço',
  namePlural: 'Ordens de serviço',
  description: 'Abertura, agendamento e execução do serviço, com fotos, itens e assinatura do cliente.',
  icon: 'Wrench',
  color: C.blue,
  category: 'Serviços',
  subOf: 'clientes',
  settings: { titleField: 'numero', captureLocation: true, statusField: 'status', doneValues: ['concluida', 'cancelada'], deadlineField: 'agendada_para' },
  fields: rows(
    [
      field('numero', 'Nº da OS', 'text', 3, { unique: true, placeholder: 'OS-0001', helpText: 'A equipe preenche ao receber o pedido' }),
      field('abertura', 'Abertura', 'datetime', 3, { required: true, default: '{{now}}' }),
      field('tipo', 'Tipo de serviço', 'select', 3, { required: true, options: TIPO_OS }),
      field('prioridade', 'Prioridade', 'select', 3, { required: true, default: 'normal', options: PRIORIDADE }),
    ],
    [
      field('status', 'Situação', 'select', 4, { required: true, options: STATUS }),
      field('tecnico', 'Técnico', 'text', 4, { placeholder: 'Quem vai executar' }),
      field('agendada_para', 'Agendada para', 'datetime', 4),
    ],
    [field('equipamento', 'Equipamento / local', 'text', 12, { placeholder: 'Ex.: Split 12.000 BTUs — sala de reuniões' })],
    [field('defeito', 'Problema relatado', 'textarea', 12, { required: true })],
    [section('sec_execucao', 'Execução')],
    [field('servico_executado', 'Serviço executado', 'textarea', 12)],
    [
      field('itens', 'Peças e serviços', 'sub-entity', 12, {
        subEntitySlug: 'itens-os',
        subEntityDisplayFields: ['tipo', 'descricao', 'quantidade', 'valor_unitario', 'valor_total'],
        parentDisplayField: 'numero',
      }),
    ],
    [
      field('valor_total', 'Valor total', 'currency', 4, { min: 0 }),
      field('concluida_em', 'Concluída em', 'datetime', 4),
      field('avaliacao', 'Avaliação do cliente', 'rating', 4),
    ],
    [field('foto_antes', 'Foto antes', 'image', 6), field('foto_depois', 'Foto depois', 'image', 6)],
    [field('assinatura', 'Assinatura do cliente', 'signature', 12)],
  ),
};

const clientes = {
  slug: 'clientes',
  name: 'Cliente',
  namePlural: 'Clientes',
  description: 'Cadastro de clientes com contato, endereço e histórico de ordens de serviço.',
  icon: 'Building2',
  color: C.orange,
  category: 'Serviços',
  settings: { titleField: 'nome' },
  fields: rows(
    [
      field('nome', 'Nome / razão social', 'text', 8, { required: true }),
      field('tipo_pessoa', 'Tipo', 'select', 4, { required: true, options: opts(['pj', 'Empresa'], ['pf', 'Pessoa física']) }),
    ],
    [
      field('documento', 'CPF / CNPJ', 'text', 4),
      field('telefone', 'Telefone', 'phone', 4),
      field('email', 'E-mail', 'email', 4),
    ],
    [
      field('endereco', 'Endereço', 'text', 8),
      field('cidade', 'Cidade', 'text', 4),
    ],
    [field('contrato', 'Contrato de manutenção', 'select', 6, { options: opts(['sem', 'Sem contrato', C.gray], ['mensal', 'Mensal', C.green], ['anual', 'Anual', C.teal]) })],
    [
      field('ordens', 'Ordens de serviço', 'sub-entity', 12, {
        subEntitySlug: 'ordens-servico',
        subEntityDisplayFields: ['numero', 'abertura', 'tipo', 'status', 'tecnico', 'valor_total'],
        parentDisplayField: 'nome',
      }),
    ],
  ),
};

// ── Dados de exemplo (ficticios) ──────────────────────────────────────────
const CLIENTES: Array<[string, string, string, string, string]> = [
  ['Padaria Trigo Bom', 'pj', 'Campinas', 'mensal', 'Rua das Flores, 120'],
  ['Clínica Sorriso Pleno', 'pj', 'Valinhos', 'anual', 'Av. Brasil, 845'],
  ['Escritório Alves & Rocha', 'pj', 'Campinas', 'sem', 'Rua Barão de Jaguara, 1500'],
  ['Mercado Bom Preço', 'pj', 'Sumaré', 'mensal', 'Av. Rebouças, 77'],
  ['Hotel Vista Serra', 'pj', 'Vinhedo', 'anual', 'Estrada da Serra, km 4'],
  ['Mariana Tavares', 'pf', 'Campinas', 'sem', 'Rua Coronel Quirino, 302'],
  ['Academia Movimento', 'pj', 'Hortolândia', 'mensal', 'Rua Joaquim Nabuco, 58'],
  ['Paulo Henrique Duarte', 'pf', 'Paulínia', 'sem', 'Rua das Palmeiras, 19'],
];
const TECNICOS = ['Diego Martins', 'Luana Prado', 'Rogério Nunes', 'Camila Freitas'];
const SERVICOS: Array<{ tipo: string; equipamento: string; defeito: string; executado: string; itens: Array<[string, string, number, number]> }> = [
  { tipo: 'reparo', equipamento: 'Split 12.000 BTUs — recepção', defeito: 'Aparelho liga mas não gela.', executado: 'Troca do capacitor e recarga de gás.',
    itens: [['peca', 'Capacitor 35µF', 1, 85], ['peca', 'Gás R-410A (kg)', 1, 160], ['servico', 'Mão de obra — reparo', 1, 220]] },
  { tipo: 'manutencao', equipamento: 'Câmara fria — estoque', defeito: 'Manutenção preventiva mensal.', executado: 'Limpeza do evaporador, aperto de conexões e medição de temperatura.',
    itens: [['servico', 'Preventiva câmara fria', 1, 380]] },
  { tipo: 'instalacao', equipamento: 'Split 18.000 BTUs — sala 3', defeito: 'Instalação de aparelho novo.', executado: 'Instalação completa com suporte e dreno.',
    itens: [['peca', 'Kit instalação (tubulação 3 m)', 1, 290], ['peca', 'Suporte de parede', 1, 75], ['servico', 'Instalação split', 1, 450]] },
  { tipo: 'reparo', equipamento: 'Quadro elétrico — cozinha', defeito: 'Disjuntor desarmando com o forno ligado.', executado: 'Substituição do disjuntor e reaperto dos barramentos.',
    itens: [['peca', 'Disjuntor 40 A', 1, 68], ['servico', 'Mão de obra elétrica', 2, 120]] },
  { tipo: 'visita', equipamento: 'Bomba d\'água — subsolo', defeito: 'Barulho alto ao ligar.', executado: 'Diagnóstico: rolamento desgastado. Orçamento enviado.',
    itens: [['servico', 'Visita técnica', 1, 150]] },
  { tipo: 'manutencao', equipamento: 'Splits — andar inteiro (6 un.)', defeito: 'Limpeza semestral.', executado: 'Limpeza de filtros e serpentinas, teste de dreno.',
    itens: [['servico', 'Higienização split', 6, 140]] },
];
const STATUS_CICLO = ['concluida', 'concluida', 'em_execucao', 'agendada', 'concluida', 'aguardando_peca', 'aberta', 'concluida', 'cancelada', 'concluida'];
const PRIORIDADE_CICLO = ['normal', 'alta', 'normal', 'baixa', 'urgente', 'normal'];

let numeroOs = 0;
function sampleOrdens(i: number): SampleRecord[] {
  const count = 3 + (i % 3);
  return Array.from({ length: count }, (_, j) => {
    const n = i * 5 + j;
    const serv = cycle(SERVICOS, n);
    const status = cycle(STATUS_CICLO, n);
    const dias = (i * 7 + j * 6 + j * j) % 30;
    const itens = serv.itens.map(([tipo, descricao, quantidade, unit]) => ({
      data: { tipo, descricao, quantidade, valor_unitario: unit, valor_total: quantidade * unit },
    }));
    const total = serv.itens.reduce((sum, [, , q, u]) => sum + q * u, 0);
    const concluida = status === 'concluida';
    const emAberto = !concluida && status !== 'cancelada';
    numeroOs += 1;
    return {
      data: {
        numero: `OS-${String(1000 + numeroOs)}`,
        // Em aberto: aberta ha poucos dias, com prazo espalhado em volta de hoje
        abertura: emAberto ? daysAgo(5 + (n % 6), 8 + (n % 9)) : daysAgo(dias, 8 + (n % 9)),
        tipo: serv.tipo,
        prioridade: cycle(PRIORIDADE_CICLO, n),
        status,
        tecnico: cycle(TECNICOS, n),
        agendada_para: emAberto ? `${dateAhead(cycle(PRAZO_ESPALHADO, n))}T14:00:00.000Z` : daysAgo(Math.max(dias - 1, 0), 14),
        equipamento: serv.equipamento,
        defeito: serv.defeito,
        servico_executado: concluida ? serv.executado : '',
        valor_total: status === 'cancelada' ? 0 : total,
        ...(concluida ? { concluida_em: daysAgo(Math.max(dias - 1, 0), 17), avaliacao: 4 + (n % 2) } : {}),
      },
      children: { 'itens-os': status === 'cancelada' ? [] : itens },
    };
  });
}

export const ordemServico: SolutionSpec = {
  slug: 'ordem-servico',
  tenantName: 'Modelo — Ordem de serviço',
  brandColor: '#2563eb',
  entities: [itensOs, ordens, clientes],
  roles: [
    {
      name: 'Técnico',
      description: 'Recebe as ordens no app, registra o serviço, fotos, peças e a assinatura do cliente.',
      color: C.blue,
      permissions: [
        { entitySlug: 'clientes', canRead: true, canCreate: false, canUpdate: false, canDelete: false, scope: 'all' },
        { entitySlug: 'ordens-servico', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'own' },
        { entitySlug: 'itens-os', canRead: true, canCreate: true, canUpdate: true, canDelete: true, scope: 'own' },
      ],
      modulePermissions: { dashboard: { canRead: true }, data: { canRead: true, canCreate: true, canUpdate: true }, templates: { canRead: true, canGenerate: true } },
    },
    {
      name: 'Atendente',
      description: 'Cadastra clientes, abre e agenda as ordens e acompanha a fila.',
      color: C.violet,
      permissions: [
        { entitySlug: '*', canRead: true, canCreate: true, canUpdate: true, canDelete: false, canExport: true, scope: 'all' },
      ],
      modulePermissions: {
        dashboard: { canRead: true }, data: { canRead: true, canCreate: true, canUpdate: true },
        templates: { canRead: true, canGenerate: true }, chat: { manage: true },
      },
    },
  ],
  dashboards: [
    {
      name: 'Painel de serviços',
      description: 'Ordens abertas, faturamento, tipos de serviço e fila dos técnicos.',
      entitySlug: 'clientes',
      roles: ['Administrador', 'Atendente', 'Gerente'],
      priority: 20,
      tabs: [
        {
          id: 'visao-geral',
          label: 'Visão geral',
          rows: [
            [
              { id: 'kpi-os', type: 'kpi-card', title: 'Ordens de serviço', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'ordens-servico' } },
              { id: 'kpi-faturamento', type: 'kpi-card', title: 'Faturamento', w: 3, h: 3, config: { fieldSlug: 'valor_total', aggregation: 'sum', entitySlugOverride: 'ordens-servico' } },
              { id: 'kpi-ticket', type: 'kpi-card', title: 'Ticket médio', w: 3, h: 3, config: { fieldSlug: 'valor_total', aggregation: 'avg', entitySlugOverride: 'ordens-servico' } },
              { id: 'kpi-avaliacao', type: 'kpi-card', title: 'Avaliação média', w: 3, h: 3, config: { fieldSlug: 'avaliacao', aggregation: 'avg', entitySlugOverride: 'ordens-servico' } },
            ],
            [
              { id: 'line-os', type: 'line-chart', title: 'Ordens abertas por dia', w: 8, h: 7, config: { days: 30, chartColor: '#2563eb', dataSource: 'records-over-time', dateField: 'abertura', entitySlugOverride: 'ordens-servico' } },
              { id: 'donut-status', type: 'donut-chart', title: 'Situação', w: 4, h: 7, config: { dataSource: 'field-distribution', groupByField: 'status', showLegend: true, entitySlugOverride: 'ordens-servico' } },
            ],
            [
              { id: 'bar-tipo', type: 'bar-chart', title: 'Por tipo de serviço', w: 6, h: 7, config: { dataSource: 'field-distribution', groupByField: 'tipo', chartColors: ['#2563eb'], entitySlugOverride: 'ordens-servico' } },
              { id: 'stat-prioridade', type: 'stat-list', title: 'Por prioridade', w: 6, h: 7, config: { listStyle: 'colored', showTotal: true, groupByField: 'prioridade', entitySlugOverride: 'ordens-servico' } },
            ],
          ],
        },
        {
          id: 'fila',
          label: 'Fila',
          rows: [
            [
              { id: 'kanban-os', type: 'kanban-board', title: 'Ordens por situação', w: 12, h: 12, config: { groupByField: 'status', cardTitleField: 'numero', cardSubtitleFields: ['equipamento', 'tecnico'], cardBadgeField: 'prioridade', columnOrder: ['aberta', 'agendada', 'em_execucao', 'aguardando_peca', 'concluida'], limit: 100, entitySlugOverride: 'ordens-servico' } },
            ],
            [
              { id: 'bar-tecnico', type: 'bar-chart', title: 'Ordens por técnico', w: 6, h: 7, config: { dataSource: 'field-distribution', groupByField: 'tecnico', chartColors: ['#7c3aed'], entitySlugOverride: 'ordens-servico' } },
              { id: 'mt-agenda', type: 'mini-table', title: 'Agenda', w: 6, h: 7, config: { limit: 10, sortBy: 'agendada_para', sortOrder: 'desc', displayFields: ['numero', 'tecnico', 'agendada_para', 'status'], entitySlugOverride: 'ordens-servico' } },
            ],
          ],
        },
        {
          id: 'clientes',
          label: 'Clientes',
          rows: [
            [
              { id: 'dt-clientes', type: 'data-table', title: 'Clientes', w: 12, h: 10, config: { pageSize: 25, allowEdit: true, allowCreate: true, allowDelete: true, allowExport: true, allowImport: true, allowBatchSelect: true, displayFields: ['nome', 'tipo_pessoa', 'telefone', 'cidade', 'contrato'], defaultSortField: 'nome', defaultSortOrder: 'asc', entitySlugOverride: 'clientes' } },
            ],
          ],
        },
      ],
    },
    {
      name: 'Minhas ordens',
      description: 'Ordens do técnico e o que está pendente.',
      entitySlug: 'clientes',
      roles: ['Técnico'],
      priority: 10,
      tabs: [
        {
          id: 'minhas',
          label: 'Minhas ordens',
          rows: [
            [
              { id: 'kpi-minhas', type: 'kpi-card', title: 'Minhas ordens', w: 6, h: 3, config: { aggregation: 'count', entitySlugOverride: 'ordens-servico' } },
              { id: 'kpi-minhas-av', type: 'kpi-card', title: 'Minha avaliação média', w: 6, h: 3, config: { fieldSlug: 'avaliacao', aggregation: 'avg', entitySlugOverride: 'ordens-servico' } },
            ],
            [
              { id: 'kanban-minhas', type: 'kanban-board', title: 'Minhas ordens por situação', w: 12, h: 12, config: { groupByField: 'status', cardTitleField: 'numero', cardSubtitleFields: ['equipamento'], cardBadgeField: 'prioridade', columnOrder: ['aberta', 'agendada', 'em_execucao', 'aguardando_peca', 'concluida'], limit: 100, entitySlugOverride: 'ordens-servico' } },
            ],
          ],
        },
      ],
    },
  ],
  pdfs: [
    {
      name: 'Ordem de serviço',
      slug: 'ordem-servico',
      description: 'OS com dados do cliente, serviço executado, peças, valor e assinatura.',
      entitySlug: 'ordens-servico',
      templateType: 'single',
      content: {
        header: { title: { text: 'Ordem de serviço {{numero}}', bold: true, fontSize: 14 }, showOnAllPages: true },
        body: [
          { id: 'cliente', type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Cliente:', binding: '{{_parent.nome}}', labelBold: true },
            { label: 'Telefone:', binding: '{{_parent.telefone}}', labelBold: true },
            { label: 'Endereço:', binding: '{{_parent.endereco}}', labelBold: true },
            { label: 'Cidade:', binding: '{{_parent.cidade}}', labelBold: true },
          ] },
          { id: 'div-0', type: 'divider', marginTop: 6, marginBottom: 6 },
          { id: 'os', type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Abertura:', binding: '{{abertura}}', labelBold: true, format: 'datetime' },
            { label: 'Tipo:', binding: '{{tipo}}', labelBold: true },
            { label: 'Técnico:', binding: '{{tecnico}}', labelBold: true },
            { label: 'Situação:', binding: '{{status}}', labelBold: true },
            { label: 'Equipamento:', binding: '{{equipamento}}', labelBold: true },
            { label: 'Concluída em:', binding: '{{concluida_em}}', labelBold: true, format: 'datetime' },
          ] },
          { id: 'defeito', type: 'text', content: 'Problema relatado: {{defeito}}', fontSize: 9, marginTop: 8 },
          { id: 'executado', type: 'text', content: 'Serviço executado: {{servico_executado}}', fontSize: 9, marginTop: 4 },
          { id: 'titulo-itens', type: 'text', content: 'Peças e serviços', fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
          { id: 'tabela-itens', type: 'table', dataSource: 'itens', showHeader: true, emptyMessage: 'Nenhum item lançado',
            headerStyle: { bold: true, fontSize: 8 }, cellStyle: { fontSize: 8 },
            columns: [
              { field: 'tipo', header: 'Tipo', width: 60, align: 'center' },
              { field: 'descricao', header: 'Descrição', width: 210, align: 'left' },
              { field: 'quantidade', header: 'Qtd.', width: 40, align: 'center' },
              { field: 'valor_unitario', header: 'Unitário', width: 75, align: 'right', format: 'currency' },
              { field: 'valor_total', header: 'Total', width: 75, align: 'right', format: 'currency' },
            ] },
          { id: 'total', type: 'field-group', layout: 'horizontal', marginTop: 6, labelFontSize: 11, valueFontSize: 11, fields: [
            { label: 'Valor total:', binding: '{{valor_total}}', labelBold: true, format: 'currency' },
          ] },
          { id: 'fotos', type: 'image-grid', columns: 2, marginTop: 12, imageWidth: 180, imageHeight: 120, showCaptions: true,
            dataSource: '_sem_filhos', imageFields: ['foto_antes'],
            parentImageFields: ['foto_antes', 'foto_depois'], captionFields: ['ANTES', 'DEPOIS'], captionFontSize: 7 },
          { id: 'assinatura', type: 'image-grid', columns: 2, marginTop: 14, imageWidth: 160, imageHeight: 60, showCaptions: true,
            dataSource: '_sem_filhos', imageFields: ['assinatura'],
            parentImageFields: ['assinatura'], captionFields: ['Assinatura do cliente'], captionFontSize: 7 },
        ],
        footer: { position: 'right', showPageNumbers: true },
        settings: { fileNamePattern: '{numero}' },
      },
    },
  ],
  commands: [
    {
      slug: 'os',
      description: 'Abrir uma ordem de serviço para um cliente',
      icon: 'Wrench',
      targetEntitySlug: 'ordens-servico',
      actionType: 'create_record',
      actionConfig: {
        parentEntitySlug: 'clientes',
        parentSearchField: 'nome',
        formFields: [
          { slug: 'numero', source: 'target' }, { slug: 'tipo', source: 'target' }, { slug: 'prioridade', source: 'target' },
          { slug: 'equipamento', source: 'target' }, { slug: 'defeito', source: 'target' },
        ],
        fixedValues: [{ fieldSlug: 'status', value: 'aberta' }],
      },
    },
    {
      slug: 'fila',
      description: 'Ver as ordens abertas',
      icon: 'ListTodo',
      targetEntitySlug: 'ordens-servico',
      actionType: 'query',
      actionConfig: {
        filters: [{ field: 'status', operator: 'equals', value: 'aberta' }],
        displayFields: ['numero', 'equipamento', 'prioridade', 'tecnico'],
        formats: ['card', 'xlsx'],
      },
    },
  ],
  samples: {
    clientes: CLIENTES.map(([nome, tipo_pessoa, cidade, contrato, endereco], i) => ({
      data: {
        nome, tipo_pessoa, cidade, contrato, endereco,
        telefone: `(19) 9${String(8100 + i * 37).padStart(4, '0')}-${String(2000 + i * 113).slice(0, 4)}`,
        email: tipo_pessoa === 'pj' ? `contato@cliente${i + 1}.exemplo.com` : `cliente${i + 1}@exemplo.com`,
      },
      children: { 'ordens-servico': sampleOrdens(i) },
    })),
  },
};
