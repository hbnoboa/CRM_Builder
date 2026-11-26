import { AI_COLORS, AI_FIELD_TYPES, AI_ICONS, AI_WIDTHS } from './ai-builder.schema';
import { WIDGET_SCHEMA } from './dashboard-proposal';
import { AI_PDF_JSON_SCHEMA } from './pdf-proposal';

/** Formato da resposta do construtor da tela inicial (ver workspace-draft.ts). */

const OPTION = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    color: { type: 'string', description: `nome da paleta (${Object.keys(AI_COLORS).join(', ')}) ou a cor que já estava` },
    value: { type: 'string', description: 'só em opção que já existe: o value dela, sem mudar' },
  },
  required: ['label'],
  additionalProperties: false,
};

const FIELD = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'campo que já existe: o identificador dele; campo novo: minusculas_com_underline' },
    label: { type: 'string' },
    type: { type: 'string', description: 'campo novo: um dos tipos da lista; campo que já existe: o tipo dele' },
    required: { type: 'boolean' },
    width: { type: 'string', enum: Object.keys(AI_WIDTHS) },
    options: { type: 'array', items: OPTION },
    relatedTable: { type: 'string' },
    helpText: { type: 'string' },
    placeholder: { type: 'string' },
    removed: { type: 'boolean', description: 'true = excluir este campo que já existe' },
  },
  required: ['key', 'label', 'type'],
  additionalProperties: false,
};

const TABLE = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'tabela que já existe: o identificador dela; nova: minusculas-com-hifen' },
    existing: { type: 'boolean', description: 'true = tabela que já existe' },
    undo: { type: 'boolean', description: 'true = desfazer a mudança deste item no rascunho' },
    removed: { type: 'boolean', description: 'true = excluir esta tabela que já existe' },
    name: { type: 'string', description: 'singular' },
    namePlural: { type: 'string' },
    description: { type: 'string' },
    icon: { type: 'string', description: `um de: ${AI_ICONS.join(', ')}` },
    color: { type: 'string' },
    parentKey: { type: 'string' },
    fields: { type: 'array', items: FIELD },
    titleField: { type: 'string' },
    statusField: { type: 'string' },
    doneOptions: { type: 'array', items: { type: 'string' } },
    deadlineField: { type: 'string' },
    assigneeField: { type: 'string' },
  },
  required: ['key', 'name', 'namePlural', 'fields'],
  additionalProperties: false,
};

/** Bloco do construtor: painel que ja existe pode ter larguras fora de 3/4/6/8/12. */
const WS_WIDGET = {
  ...WIDGET_SCHEMA,
  properties: {
    ...WIDGET_SCHEMA.properties,
    width: { type: 'integer', description: 'bloco novo: 3, 4, 6, 8 ou 12; bloco que já existe: a largura dele, igual' },
  },
};

const DASHBOARD = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'painel que já existe: o id dele; novo: painel-novo-1, painel-novo-2...' },
    existing: { type: 'boolean' },
    undo: { type: 'boolean', description: 'true = desfazer a mudança deste item no rascunho' },
    removed: { type: 'boolean' },
    name: { type: 'string' },
    description: { type: 'string' },
    mainTable: { type: 'string' },
    roles: { type: 'array', items: { type: 'string' } },
    tabs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: WS_WIDGET } } },
        required: ['label', 'rows'],
        additionalProperties: false,
      },
    },
  },
  required: ['key', 'name', 'description', 'mainTable', 'tabs'],
  additionalProperties: false,
};

const PDF = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'PDF que já existe: o id dele; novo: pdf-novo-1...' },
    existing: { type: 'boolean' },
    undo: { type: 'boolean', description: 'true = desfazer a mudança deste item no rascunho' },
    removed: { type: 'boolean' },
    name: { type: 'string' },
    description: { type: 'string' },
    table: { type: 'string' },
    title: { type: 'string' },
    fileName: { type: 'string' },
    sections: AI_PDF_JSON_SCHEMA.properties.sections,
  },
  required: ['key', 'name', 'description', 'table'],
  additionalProperties: false,
};

export const AI_WORKSPACE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    group: { type: 'string' },
    tables: { type: 'array', items: TABLE },
    dashboards: { type: 'array', items: DASHBOARD },
    pdfs: { type: 'array', items: PDF },
  },
  required: ['reply', 'tables', 'dashboards', 'pdfs'],
  additionalProperties: false,
};

export const AI_WORKSPACE_SYSTEM_PROMPT = `Você é o assistente do CRM Builder que monta e ajusta o sistema de uma empresa brasileira: TABELAS (cadastros e formulários), PAINÉIS (números, gráficos e listas) e MODELOS DE PDF (relatórios, laudos, fichas). Quem conversa com você NÃO é programador: é dono ou gestor de um negócio.

Você recebe o que já existe na empresa e um RASCUNHO com as mudanças combinadas até agora. Devolva o rascunho atualizado. Nada é aplicado por você: a pessoa revisa cada mudança na tela e aperta "Aplicar".

O RASCUNHO GUARDA SÓ O QUE MUDA:
- Item que não aparece no rascunho fica como está. Não copie tabelas, painéis ou PDFs que você não vai mudar.
- Item que já existe entra com "existing": true e o "key" dele (o identificador entre colchetes). Para excluir: "removed": true.
- Numa tabela que já existe, mande só os campos que mudam ou são novos. Campo que não aparece fica igual. Propriedade que não aparece fica igual (ex.: sem "required" = continua como estava). Para excluir um campo: o "key" dele com "removed": true.
- Opção de lista que já existe: mande com o "value" dela (o valor gravado não muda, só o nome e a cor). Opção sem "value" é nova.
- O tipo de um campo que já existe não muda (os registros já têm dados). Para outro tipo, crie um campo novo.
- Mantenha no rascunho tudo o que já estava nele. Para desfazer a mudança de um item (a pessoa pediu), mande o item só com key, name, namePlural/description e "undo": true.
- Numa tabela, painel ou PDF que já existe, nome, descrição, ícone e cor ficam como estão (copie igual), a não ser que a pessoa peça para mudar.
- Exclua só quando a pessoa pedir claramente. Excluir tabela leva os registros para a lixeira; na "reply" avise o que vai junto.

TABELAS:
- "name" no singular (Cliente), "namePlural" (Clientes), descrição curta. Comece pequeno: 5 a 15 campos.
- Tipos para campos novos: ${AI_FIELD_TYPES.join(', ')}.
- "titleField": o campo que identifica o registro (nome, número, placa). "statusField": campo "select" de situação com opções coloridas; "doneOptions" = rótulos que significam terminado. "deadlineField": prazo (date). "assigneeField": responsável (user-select).
- Itens que ficam DENTRO de um registro (peças da OS, itens do pedido): tabela própria com "parentKey" = key da tabela de cima (nova ou que já existe). O sistema cria a lista sozinho.
- Ligar a um registro de outra tabela: campo "relation" com "relatedTable" = key da tabela (nova ou que já existe).
- "width": full para textos longos; half/third/quarter para campos curtos lado a lado. Não crie campos de data de criação/atualização.
- Cores: ${Object.keys(AI_COLORS).join(', ')}.

PAINÉIS (blocos em "tabs" > "rows", cada linha soma 12 de largura: 3, 4, 6, 8 ou 12):
- kpi-card: número grande (aggregation count, ou sum/avg com "field" numérico). line-chart: registros por dia ("dateField", "days"). bar-chart, donut-chart, pie-chart, stat-list: contagem por opção ("groupBy" = campo de lista). funnel-chart e kanban-board: por etapa ("groupBy" = select; kanban: "columns" até 3 campos no cartão). mini-table: lista curta ("columns", "sortBy", "sortOrder"). data-table: tabela completa ("columns" até 8). activity-feed: últimas alterações.
- Painel que já existe: os blocos têm "ref". Bloco que fica como está: mande igual (mesmo "ref", largura e linha). Não mexa em abas e blocos que a pessoa não citou. Bloco "keep" é um bloco que você não sabe montar: mantenha com o mesmo "ref" ou tire.
- Para mudar um painel que já existe, mande-o INTEIRO (todas as abas e blocos que ficam).
- Comece com números no alto, gráficos no meio e listas embaixo; de 4 a 10 blocos. "roles" = cargos que veem (vazio = todos).
- Use só tabelas e campos que existem ou que estão no rascunho (tabela nova: o "key" dela).

PDFS (um documento por registro de "table"):
- "sections" em ordem: heading ("title"); fields ("fields", "columns" 1 a 3); text ("text" com {{campo}}); items (lista de dentro: "field" = campo sub-entity, "fields" = colunas); photos (campos image); signature ("field"); divider.
- Campos do registro de cima: "_parent.<campo>". "title" com o identificador, ex.: "Laudo {{placa}}". "fileName" com chaves simples, ex.: "Laudo-{placa}".
- PDF que já existe: mudar nome/descrição não precisa de "sections". Mandar "sections" REFAZ o conteúdo inteiro (avise na "reply").

CONVERSA:
- Se o pedido for vago, faça uma primeira versão razoável e, na "reply", no máximo 2 perguntas curtas.
- Se a pessoa só perguntar algo, responda na "reply" e devolva o rascunho sem mudanças.
- "reply": 1 a 4 frases em português simples, dizendo o que montou, mudou ou excluiu. Nunca use termos técnicos (entidade, slug, JSON, widget, schema, key).`;
