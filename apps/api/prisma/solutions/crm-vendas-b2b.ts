import { C, field, opts, rows, section } from './layout';
import { PRAZO_ESPALHADO, cycle, dateAhead, dateAgo, daysAgo } from './samples';
import type { SampleRecord, SolutionSpec } from './types';

/**
 * Modelo "CRM de vendas B2B": empresas (contas) -> oportunidades (funil) ->
 * atividades (ligacoes, reunioes, visitas). Vendedor ve so as proprias
 * oportunidades; gestor comercial ve o funil inteiro. Dados de exemplo ficticios.
 */

const ETAPA = opts(
  ['prospeccao', 'Prospecção', C.gray],
  ['qualificacao', 'Qualificação', C.blue],
  ['proposta', 'Proposta enviada', C.violet],
  ['negociacao', 'Negociação', C.amber],
  ['ganho', 'Ganho', C.green],
  ['perdido', 'Perdido', C.red],
);
const ORIGEM = opts(['indicacao', 'Indicação'], ['site', 'Site'], ['evento', 'Evento / feira'], ['prospeccao_ativa', 'Prospecção ativa'], ['parceiro', 'Parceiro']);
const SEGMENTO = opts(['industria', 'Indústria'], ['varejo', 'Varejo'], ['servicos', 'Serviços'], ['saude', 'Saúde'], ['logistica', 'Logística'], ['agro', 'Agronegócio']);

const atividades = {
  slug: 'atividades',
  name: 'Atividade',
  namePlural: 'Atividades',
  description: 'Ligações, reuniões, e-mails e visitas de cada oportunidade.',
  icon: 'CalendarCheck',
  color: C.teal,
  category: 'Vendas',
  subOf: 'oportunidades',
  settings: { titleField: 'assunto' },
  fields: rows(
    [
      field('tipo', 'Tipo', 'select', 4, { required: true, options: opts(['ligacao', 'Ligação'], ['reuniao', 'Reunião'], ['email', 'E-mail'], ['visita', 'Visita']) }),
      field('data', 'Data e hora', 'datetime', 4, { required: true }),
      field('concluida', 'Concluída', 'boolean', 4, { default: false }),
    ],
    [field('assunto', 'Assunto', 'text', 12, { required: true })],
    [field('anotacoes', 'Anotações', 'textarea', 12)],
  ),
};

const oportunidades = {
  slug: 'oportunidades',
  name: 'Oportunidade',
  namePlural: 'Oportunidades',
  description: 'Negócios em andamento: etapa do funil, valor, chance e próximo passo.',
  icon: 'Target',
  color: C.violet,
  category: 'Vendas',
  subOf: 'empresas',
  settings: { titleField: 'titulo', statusField: 'etapa', doneValues: ['ganho', 'perdido'], deadlineField: 'previsao' },
  fields: rows(
    [
      field('titulo', 'Oportunidade', 'text', 8, { required: true, placeholder: 'Ex.: Licenças para 40 usuários' }),
      field('etapa', 'Etapa', 'select', 4, { required: true, options: ETAPA }),
    ],
    [
      field('valor', 'Valor', 'currency', 3, { required: true, min: 0 }),
      field('probabilidade', 'Chance de fechar', 'percentage', 3, { min: 0, max: 100 }),
      field('previsao', 'Previsão de fechamento', 'date', 3),
      field('criada_em', 'Criada em', 'date', 3, { required: true }),
    ],
    [
      field('vendedor', 'Vendedor', 'text', 4),
      field('origem', 'Origem', 'select', 4, { options: ORIGEM }),
      field('contato', 'Contato na empresa', 'text', 4),
    ],
    [field('proximo_passo', 'Próximo passo', 'text', 12, { placeholder: 'Ex.: enviar proposta revisada até sexta' })],
    [field('motivo_perda', 'Motivo da perda', 'select', 6, {
      options: opts(['preco', 'Preço'], ['concorrente', 'Escolheu concorrente'], ['sem_orcamento', 'Sem orçamento'], ['timing', 'Não é o momento'], ['sem_resposta', 'Parou de responder']),
    })],
    [section('sec_proposta', 'Proposta')],
    [field('escopo', 'Escopo da proposta', 'textarea', 12)],
    [field('condicoes', 'Condições comerciais', 'textarea', 12, { placeholder: 'Prazo, forma de pagamento, validade' })],
    [
      field('atividades', 'Atividades', 'sub-entity', 12, {
        subEntitySlug: 'atividades',
        subEntityDisplayFields: ['data', 'tipo', 'assunto', 'concluida'],
        parentDisplayField: 'titulo',
      }),
    ],
  ),
};

const empresas = {
  slug: 'empresas',
  name: 'Empresa',
  namePlural: 'Empresas',
  description: 'Contas (clientes e prospects) com segmento, porte e oportunidades.',
  icon: 'Building',
  color: C.orange,
  category: 'Vendas',
  settings: { titleField: 'nome' },
  fields: rows(
    [
      field('nome', 'Empresa', 'text', 8, { required: true }),
      field('situacao', 'Situação', 'select', 4, {
        required: true,
        options: opts(['prospect', 'Prospect', C.blue], ['cliente', 'Cliente', C.green], ['inativa', 'Inativa', C.gray]),
      }),
    ],
    [
      field('cnpj', 'CNPJ', 'cnpj', 4),
      field('segmento', 'Segmento', 'select', 4, { options: SEGMENTO }),
      field('porte', 'Porte', 'select', 4, { options: opts(['pequena', 'Pequena'], ['media', 'Média'], ['grande', 'Grande']) }),
    ],
    [
      field('cidade', 'Cidade', 'text', 4),
      field('uf', 'UF', 'text', 2),
      field('site', 'Site', 'url', 6),
    ],
    [
      field('responsavel', 'Responsável pela conta', 'text', 6),
      field('telefone', 'Telefone', 'phone', 6),
    ],
    [
      field('oportunidades', 'Oportunidades', 'sub-entity', 12, {
        subEntitySlug: 'oportunidades',
        subEntityDisplayFields: ['titulo', 'etapa', 'valor', 'previsao', 'vendedor'],
        parentDisplayField: 'nome',
      }),
    ],
  ),
};

// ── Dados de exemplo (ficticios) ──────────────────────────────────────────
const EMPRESAS: Array<[string, string, string, string, string, string]> = [
  ['Metalúrgica Horizonte', 'industria', 'grande', 'Joinville', 'SC', 'cliente'],
  ['Rede Farma Vida', 'saude', 'media', 'Ribeirão Preto', 'SP', 'prospect'],
  ['TransLog Cargas', 'logistica', 'grande', 'Curitiba', 'PR', 'cliente'],
  ['Agro Campo Verde', 'agro', 'media', 'Rio Verde', 'GO', 'prospect'],
  ['Lojas Estação Moda', 'varejo', 'media', 'Belo Horizonte', 'MG', 'cliente'],
  ['Consultoria Nexo', 'servicos', 'pequena', 'Florianópolis', 'SC', 'prospect'],
  ['Plásticos Unidos', 'industria', 'media', 'Caxias do Sul', 'RS', 'prospect'],
  ['Clínicas Bem Estar', 'saude', 'grande', 'Salvador', 'BA', 'cliente'],
  ['Distribuidora Sol Nascente', 'logistica', 'pequena', 'Recife', 'PE', 'inativa'],
];
const VENDEDORES = ['Bruno Teixeira', 'Juliana Campos', 'Ricardo Alves'];
const PRODUTOS: Array<[string, number]> = [
  ['Licenças anuais — 40 usuários', 48000], ['Implantação e treinamento', 18500], ['Módulo de relatórios', 9600],
  ['Expansão para filiais', 32000], ['Suporte premium 12 meses', 14400], ['Integração com ERP', 22000],
];
const ETAPA_CICLO = ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'ganho', 'proposta', 'qualificacao', 'perdido', 'negociacao', 'ganho'];
const CHANCE: Record<string, number> = { prospeccao: 10, qualificacao: 25, proposta: 50, negociacao: 70, ganho: 100, perdido: 0 };
const PASSOS: Record<string, string> = {
  prospeccao: 'Agendar primeira conversa', qualificacao: 'Mapear decisores e orçamento', proposta: 'Cobrar retorno da proposta',
  negociacao: 'Ajustar condições de pagamento', ganho: 'Passar para implantação', perdido: 'Retomar contato em 6 meses',
};

/** CNPJ ficticio com digitos verificadores validos (formato 00.000.000/0001-00). */
function fakeCnpj(i: number): string {
  const base = String(11222333 + i * 104729).padStart(8, '0').slice(0, 8) + '0001';
  const digits = base.split('').map(Number);
  const dv = (weights: number[]) => {
    const sum = weights.reduce((acc, w, k) => acc + w * digits[k], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  digits.push(dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  digits.push(dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  const d = digits.join('');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function sampleOportunidades(i: number, contato: string): SampleRecord[] {
  const count = 2 + (i % 3);
  return Array.from({ length: count }, (_, j) => {
    const n = i * 3 + j;
    const etapa = cycle(ETAPA_CICLO, n);
    const [titulo, base] = cycle(PRODUTOS, n);
    const criada = (i * 9 + j * 11) % 30;
    const fechado = etapa === 'ganho' || etapa === 'perdido';
    const atividadesN = 1 + (n % 3);
    return {
      data: {
        titulo, etapa,
        valor: base + (n % 4) * 1500,
        probabilidade: CHANCE[etapa],
        criada_em: dateAgo(criada),
        previsao: fechado ? dateAgo(Math.max(criada - 10, 0)) : dateAhead(cycle(PRAZO_ESPALHADO, n) + 3),
        vendedor: cycle(VENDEDORES, n),
        origem: cycle(['indicacao', 'site', 'evento', 'prospeccao_ativa', 'parceiro'], n),
        contato,
        proximo_passo: PASSOS[etapa],
        ...(etapa === 'perdido' ? { motivo_perda: cycle(['preco', 'concorrente', 'timing'], n) } : {}),
        escopo: `${titulo}, com configuração inicial, migração dos dados atuais e acompanhamento nos primeiros 30 dias.`,
        condicoes: 'Pagamento em 3 parcelas (30/60/90 dias). Proposta válida por 15 dias.',
      },
      children: {
        atividades: Array.from({ length: atividadesN }, (_, k) => {
          const passado = k < atividadesN - 1 || fechado;
          return {
            data: {
              tipo: cycle(['ligacao', 'reuniao', 'email', 'visita'], n + k),
              data: passado ? daysAgo(Math.max(criada - k * 4, 0), 10 + k) : `${dateAhead(2 + (n % 6))}T15:00:00.000Z`,
              assunto: cycle(['Apresentação da solução', 'Levantamento de necessidades', 'Envio da proposta', 'Reunião com diretoria', 'Ajuste de escopo'], n + k),
              concluida: passado,
            },
          };
        }),
      },
    };
  });
}

export const crmVendasB2b: SolutionSpec = {
  slug: 'crm-vendas-b2b',
  tenantName: 'Modelo — CRM de vendas B2B',
  brandColor: '#7c3aed',
  entities: [atividades, oportunidades, empresas],
  roles: [
    {
      name: 'Vendedor',
      description: 'Cuida das próprias oportunidades e atividades; vê todas as empresas.',
      color: C.violet,
      permissions: [
        { entitySlug: 'empresas', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'all' },
        { entitySlug: 'oportunidades', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'own' },
        { entitySlug: 'atividades', canRead: true, canCreate: true, canUpdate: true, canDelete: true, scope: 'own' },
      ],
      modulePermissions: { dashboard: { canRead: true }, data: { canRead: true, canCreate: true, canUpdate: true }, templates: { canRead: true, canGenerate: true } },
    },
    {
      name: 'Gestor comercial',
      description: 'Acompanha o funil da equipe, metas e motivos de perda.',
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
      name: 'Funil de vendas',
      description: 'Pipeline por etapa, valor em negociação, conversão e motivos de perda.',
      entitySlug: 'empresas',
      roles: ['Administrador', 'Gestor comercial', 'Gerente'],
      priority: 20,
      tabs: [
        {
          id: 'pipeline',
          label: 'Pipeline',
          rows: [
            [
              { id: 'kpi-oport', type: 'kpi-card', title: 'Oportunidades', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'oportunidades' } },
              { id: 'kpi-pipeline', type: 'kpi-card', title: 'Valor no funil', w: 3, h: 3, config: { fieldSlug: 'valor', aggregation: 'sum', entitySlugOverride: 'oportunidades' } },
              { id: 'kpi-ticket', type: 'kpi-card', title: 'Ticket médio', w: 3, h: 3, config: { fieldSlug: 'valor', aggregation: 'avg', entitySlugOverride: 'oportunidades' } },
              { id: 'kpi-empresas', type: 'kpi-card', title: 'Empresas', w: 3, h: 3, config: { aggregation: 'count', entitySlugOverride: 'empresas' } },
            ],
            [
              { id: 'funil-etapa', type: 'funnel-chart', title: 'Funil por etapa', w: 6, h: 8, config: { groupByField: 'etapa', stages: ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'ganho'], chartColors: ['#7c3aed'], entitySlugOverride: 'oportunidades' } },
              { id: 'col-etapa', type: 'column-chart', title: 'Oportunidades por etapa', w: 6, h: 8, config: { dataSource: 'field-distribution', groupByField: 'etapa', entitySlugOverride: 'oportunidades' } },
            ],
            [
              { id: 'line-criadas', type: 'line-chart', title: 'Novas oportunidades por dia', w: 8, h: 7, config: { days: 30, chartColor: '#7c3aed', dataSource: 'records-over-time', dateField: 'criada_em', entitySlugOverride: 'oportunidades' } },
              { id: 'stat-vendedor', type: 'stat-list', title: 'Por vendedor', w: 4, h: 7, config: { listStyle: 'ranked', showTotal: true, groupByField: 'vendedor', entitySlugOverride: 'oportunidades' } },
            ],
          ],
        },
        {
          id: 'quadro',
          label: 'Quadro',
          rows: [
            [
              { id: 'kanban-etapa', type: 'kanban-board', title: 'Oportunidades por etapa', w: 12, h: 13, config: { groupByField: 'etapa', cardTitleField: 'titulo', cardSubtitleFields: ['vendedor', 'previsao'], cardBadgeField: 'valor', columnOrder: ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'ganho', 'perdido'], limit: 100, entitySlugOverride: 'oportunidades' } },
            ],
          ],
        },
        {
          id: 'analise',
          label: 'Análise',
          rows: [
            [
              { id: 'donut-origem', type: 'donut-chart', title: 'Origem das oportunidades', w: 4, h: 8, config: { dataSource: 'field-distribution', groupByField: 'origem', showLegend: true, entitySlugOverride: 'oportunidades' } },
              { id: 'bar-perda', type: 'bar-chart', title: 'Motivos de perda', w: 4, h: 8, config: { dataSource: 'field-distribution', groupByField: 'motivo_perda', chartColors: ['#dc2626'], entitySlugOverride: 'oportunidades' } },
              { id: 'donut-segmento', type: 'donut-chart', title: 'Empresas por segmento', w: 4, h: 8, config: { dataSource: 'field-distribution', groupByField: 'segmento', showLegend: true, entitySlugOverride: 'empresas' } },
            ],
            [
              { id: 'mt-proximas', type: 'mini-table', title: 'Fechamentos por data', w: 12, h: 8, config: { limit: 10, sortBy: 'previsao', sortOrder: 'desc', displayFields: ['titulo', 'etapa', 'valor', 'previsao', 'vendedor', 'proximo_passo'], entitySlugOverride: 'oportunidades' } },
            ],
          ],
        },
      ],
    },
    {
      name: 'Minhas vendas',
      description: 'Oportunidades e atividades do vendedor.',
      entitySlug: 'empresas',
      roles: ['Vendedor'],
      priority: 10,
      tabs: [
        {
          id: 'minhas',
          label: 'Minhas vendas',
          rows: [
            [
              { id: 'kpi-minhas', type: 'kpi-card', title: 'Minhas oportunidades', w: 6, h: 3, config: { aggregation: 'count', entitySlugOverride: 'oportunidades' } },
              { id: 'kpi-meu-funil', type: 'kpi-card', title: 'Meu valor no funil', w: 6, h: 3, config: { fieldSlug: 'valor', aggregation: 'sum', entitySlugOverride: 'oportunidades' } },
            ],
            [
              { id: 'kanban-minhas', type: 'kanban-board', title: 'Meu funil', w: 12, h: 13, config: { groupByField: 'etapa', cardTitleField: 'titulo', cardSubtitleFields: ['previsao', 'proximo_passo'], cardBadgeField: 'valor', columnOrder: ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'ganho', 'perdido'], limit: 100, entitySlugOverride: 'oportunidades' } },
            ],
          ],
        },
      ],
    },
  ],
  pdfs: [
    {
      name: 'Proposta comercial',
      slug: 'proposta-comercial',
      description: 'Proposta com dados da empresa, escopo, valor e condições.',
      entitySlug: 'oportunidades',
      templateType: 'single',
      content: {
        header: { title: { text: 'Proposta comercial', bold: true, fontSize: 16 }, showOnAllPages: true },
        body: [
          { id: 'para', type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, fields: [
            { label: 'Para:', binding: '{{_parent.nome}}', labelBold: true },
            { label: 'CNPJ:', binding: '{{_parent.cnpj}}', labelBold: true },
            { label: 'A/C:', binding: '{{contato}}', labelBold: true },
            { label: 'Cidade:', binding: '{{_parent.cidade}} / {{_parent.uf}}', labelBold: true },
          ] },
          { id: 'div-0', type: 'divider', marginTop: 8, marginBottom: 8 },
          { id: 'titulo', type: 'text', content: '{{titulo}}', fontSize: 13, fontWeight: 'bold' },
          { id: 'escopo-t', type: 'text', content: 'Escopo', fontSize: 11, fontWeight: 'bold', marginTop: 10 },
          { id: 'escopo', type: 'text', content: '{{escopo}}', fontSize: 10, marginTop: 4 },
          { id: 'inv-t', type: 'text', content: 'Investimento', fontSize: 11, fontWeight: 'bold', marginTop: 12 },
          { id: 'valor', type: 'field-group', layout: 'horizontal', marginTop: 4, labelFontSize: 12, valueFontSize: 12, fields: [
            { label: 'Valor total:', binding: '{{valor}}', labelBold: true, format: 'currency' },
          ] },
          { id: 'cond-t', type: 'text', content: 'Condições', fontSize: 11, fontWeight: 'bold', marginTop: 12 },
          { id: 'condicoes', type: 'text', content: '{{condicoes}}', fontSize: 10, marginTop: 4 },
          { id: 'div-1', type: 'divider', marginTop: 16, marginBottom: 8 },
          { id: 'vendedor', type: 'text', content: 'Atenciosamente, {{vendedor}}', fontSize: 10 },
        ],
        footer: { position: 'right', showPageNumbers: true },
        settings: { fileNamePattern: 'proposta-{titulo}' },
      },
    },
  ],
  commands: [
    {
      slug: 'oportunidade',
      description: 'Registrar uma oportunidade para uma empresa',
      icon: 'Target',
      targetEntitySlug: 'oportunidades',
      actionType: 'create_record',
      actionConfig: {
        parentEntitySlug: 'empresas',
        parentSearchField: 'nome',
        formFields: [
          { slug: 'titulo', source: 'target' }, { slug: 'valor', source: 'target' }, { slug: 'previsao', source: 'target' },
          { slug: 'origem', source: 'target' }, { slug: 'proximo_passo', source: 'target' },
        ],
        fixedValues: [{ fieldSlug: 'etapa', value: 'prospeccao' }],
      },
    },
    {
      slug: 'negociacao',
      description: 'Ver oportunidades em negociação',
      icon: 'Handshake',
      targetEntitySlug: 'oportunidades',
      actionType: 'query',
      actionConfig: {
        filters: [{ field: 'etapa', operator: 'equals', value: 'negociacao' }],
        displayFields: ['titulo', 'valor', 'previsao', 'vendedor'],
        formats: ['card', 'xlsx'],
      },
    },
  ],
  samples: {
    empresas: EMPRESAS.map(([nome, segmento, porte, cidade, uf, situacao], i) => {
      const contato = cycle(['Fernanda Lopes', 'Gustavo Reis', 'Patrícia Moura', 'André Siqueira', 'Renata Dias'], i);
      return {
        data: {
          nome, segmento, porte, cidade, uf, situacao,
          cnpj: fakeCnpj(i),
          site: `https://www.empresa${i + 1}.exemplo.com`,
          responsavel: cycle(VENDEDORES, i),
          telefone: `(11) 3${String(200 + i * 41).padStart(3, '0')}-${String(4000 + i * 157).slice(0, 4)}`,
        },
        children: { oportunidades: situacao === 'inativa' ? [] : sampleOportunidades(i, contato) },
      };
    }),
  },
};
