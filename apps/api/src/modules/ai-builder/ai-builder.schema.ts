/**
 * Formato da proposta do assistente de criacao de tabelas. A IA devolve SO isto
 * (saida estruturada); o servidor valida e corrige antes de mostrar ou aplicar.
 * Nada de registros da empresa entra no pedido: so nomes de tabelas e campos.
 */

/** Tipos que a IA pode usar (os demais existem, mas sao avancados para comecar). */
export const AI_FIELD_TYPES = [
  'text', 'textarea', 'number', 'currency', 'percentage', 'rating',
  'date', 'datetime', 'time',
  'select', 'multiselect', 'boolean', 'tags',
  'phone', 'email', 'cpf', 'cnpj', 'cep', 'url',
  'image', 'file', 'signature', 'map',
  'relation', 'user-select', 'section-title',
] as const;
export type AiFieldType = (typeof AI_FIELD_TYPES)[number];

export const AI_COLORS = {
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  blue: '#2563eb',
  gray: '#64748b',
  violet: '#7c3aed',
  orange: '#ea580c',
  teal: '#0d9488',
} as const;
export type AiColor = keyof typeof AI_COLORS;

export const AI_ICONS = [
  'Users', 'UserRound', 'Building2', 'Briefcase', 'ClipboardList', 'ClipboardCheck', 'Wrench', 'Car',
  'Truck', 'Package', 'ShoppingCart', 'DollarSign', 'Receipt', 'FileText', 'Calendar', 'CalendarCheck',
  'MapPin', 'House', 'Phone', 'Mail', 'ShieldAlert', 'Camera', 'ListChecks', 'Tag', 'Star', 'HeartPulse',
  'GraduationCap', 'Hammer', 'Boxes', 'Store', 'Handshake', 'Stethoscope', 'Dog', 'Scissors', 'Utensils',
  'Ticket', 'Factory', 'Leaf', 'Megaphone', 'Headset',
] as const;

export const AI_WIDTHS = { full: 12, half: 6, third: 4, quarter: 3 } as const;
export type AiWidth = keyof typeof AI_WIDTHS;

export interface AiFieldProposal {
  key: string;
  label: string;
  type: AiFieldType;
  required?: boolean;
  width?: AiWidth;
  options?: Array<{ label: string; color?: AiColor }>;
  /** Tabela ligada: chave de uma tabela nova desta proposta ou slug de uma que ja existe. */
  relatedTable?: string;
  helpText?: string;
  placeholder?: string;
}

export interface AiTableProposal {
  key: string;
  name: string;
  namePlural: string;
  description: string;
  icon?: string;
  color?: AiColor;
  /** Lista dentro de outra tabela (ex.: itens dentro do pedido). */
  parentKey?: string | null;
  fields: AiFieldProposal[];
  titleField?: string;
  statusField?: string;
  /** Rotulos das opcoes de statusField que significam "terminado". */
  doneOptions?: string[];
  deadlineField?: string;
  assigneeField?: string;
}

export interface AiProposal {
  reply: string;
  /** Grupo no menu para as tabelas novas (ex.: "Vendas"). */
  group?: string;
  tables: AiTableProposal[];
}

const OPTION_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    color: { type: 'string', enum: Object.keys(AI_COLORS) },
  },
  required: ['label'],
  additionalProperties: false,
};

const FIELD_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'identificador curto, minusculas_com_underline' },
    label: { type: 'string' },
    type: { type: 'string', enum: [...AI_FIELD_TYPES] },
    required: { type: 'boolean' },
    width: { type: 'string', enum: Object.keys(AI_WIDTHS) },
    options: { type: 'array', items: OPTION_SCHEMA },
    relatedTable: { type: 'string' },
    helpText: { type: 'string' },
    placeholder: { type: 'string' },
  },
  required: ['key', 'label', 'type'],
  additionalProperties: false,
};

const TABLE_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'identificador curto, minusculas-com-hifen' },
    name: { type: 'string', description: 'singular' },
    namePlural: { type: 'string' },
    description: { type: 'string' },
    icon: { type: 'string', enum: [...AI_ICONS] },
    color: { type: 'string', enum: Object.keys(AI_COLORS) },
    parentKey: { type: 'string' },
    fields: { type: 'array', items: FIELD_SCHEMA },
    titleField: { type: 'string' },
    statusField: { type: 'string' },
    doneOptions: { type: 'array', items: { type: 'string' } },
    deadlineField: { type: 'string' },
    assigneeField: { type: 'string' },
  },
  required: ['key', 'name', 'namePlural', 'description', 'fields'],
  additionalProperties: false,
};

/** JSON Schema da resposta (saida estruturada do provedor). */
export const AI_PROPOSAL_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    group: { type: 'string' },
    tables: { type: 'array', items: TABLE_SCHEMA },
  },
  required: ['reply', 'tables'],
  additionalProperties: false,
};

export const AI_SYSTEM_PROMPT = `Você é o assistente do CRM Builder que monta tabelas para empresas brasileiras. Quem conversa com você NÃO é programador: é dono ou gestor de um negócio.

Seu trabalho: entender o que a pessoa quer controlar e devolver uma proposta de tabelas (cadastros) com campos, sempre no formato pedido.

Como montar:
- Use português do Brasil, palavras simples. Na "reply" nunca use termos técnicos (entidade, slug, JSON, schema, campo relacional). Diga "tabela", "campo", "lista dentro de".
- Comece pequeno: de 1 a 4 tabelas, de 5 a 15 campos cada. Melhor pouco e certo; a pessoa pede mais depois.
- Cada tabela: "name" no singular (Cliente), "namePlural" (Clientes), descrição curta do que guarda.
- "titleField": o campo que identifica o registro (nome, número, placa). Toda tabela deve ter um.
- Situação/etapa: campo "select" com opções coloridas (ex.: Aberto azul, Em andamento amber, Concluído green, Cancelado gray). Aponte em "statusField" e liste em "doneOptions" os rótulos que significam terminado.
- Prazo: campo "date" apontado em "deadlineField". Responsável pela tarefa: "user-select" apontado em "assigneeField".
- Itens que ficam DENTRO de um registro (peças da OS, andamentos do processo, itens do pedido): tabela própria com "parentKey" apontando para a tabela de cima. Não crie campo para isso na tabela de cima: o sistema cria sozinho.
- Ligar a um registro de OUTRA tabela (escolher o cliente na OS): campo "relation" com "relatedTable" = key de tabela nova desta proposta ou o identificador de uma tabela que já existe.
- Use os tipos específicos: phone, email, cpf, cnpj, cep, currency (dinheiro), percentage, date, image (fotos), file (documentos), signature (assinatura), map (localização), boolean (sim/não), rating (nota de 1 a 5).
- "section-title" separa blocos em formulários longos.
- "width": full para textos longos, half/third/quarter para campos curtos lado a lado.
- Não crie campos de data de criação ou atualização: o sistema já guarda.
- Você só CRIA tabelas novas. Não altera nem oferece alterar as que já existem (isso a pessoa faz no editor da tabela). Para aproveitar uma que já existe, ligue a ela com "relation".

Conversa:
- A cada mensagem devolva a proposta COMPLETA atualizada (não só o que mudou). Se a pessoa pedir uma mudança, mantenha o resto igual.
- Se o pedido for vago, monte uma primeira versão razoável mesmo assim e, na "reply", faça no máximo 2 perguntas curtas para melhorar.
- Se a pessoa pedir painel, dashboard, gráficos, site ou página para clientes: monte as tabelas que isso precisa e diga na "reply" que o painel e o site são os próximos passos, logo depois de criar as tabelas (o assistente monta em seguida, com o que ela já pediu aqui).
- Se o pedido não tiver nada a ver com montar a empresa, explique gentilmente que aqui você monta as tabelas (e depois o painel e o site) e devolva a proposta atual sem mudanças.
- "reply": 1 a 4 frases, dizendo o que montou ou mudou.`;
