import type { SchemaField, SchemaTable } from '../ai-builder/tenant-schema';

/**
 * IA no chat: a IA so DECIDE o que fazer (contar, listar, criar, alterar, resumir,
 * escrever) a partir da estrutura das tabelas; quem le e grava e o sistema, com as
 * permissoes de quem pediu. Conteudo de registro so vai para a IA em "resumir" e
 * "escrever", e so se a empresa ligou "Permitir que a IA leia registros".
 */

export const CHAT_AI_ACTIONS = ['none', 'count', 'list', 'create', 'update', 'summarize', 'write'] as const;
export type ChatAiActionType = (typeof CHAT_AI_ACTIONS)[number];
export const CHAT_AI_OPERATORS = ['equals', 'notEquals', 'contains', 'gt', 'gte', 'lt', 'lte', 'between', 'isEmpty', 'isNotEmpty'] as const;

export interface ChatAiFilter { field: string; operator: string; value?: string; value2?: string }
export interface ChatAiValue { field: string; value: string }

export interface ChatAiDecision {
  reply: string;
  action: {
    type: ChatAiActionType;
    table?: string;
    filters?: ChatAiFilter[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    values?: ChatAiValue[];
    /** Texto que identifica o registro (ex.: "SIN-1013", "Patrícia Almeida"). */
    record?: string;
    /** Registro de cima, para criar dentro dele (ex.: o segurado do sinistro). */
    parent?: string;
    instruction?: string;
  };
}

export const CHAT_AI_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    action: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...CHAT_AI_ACTIONS] },
        table: { type: 'string' },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: [...CHAT_AI_OPERATORS] },
              value: { type: 'string' },
              value2: { type: 'string' },
            },
            required: ['field', 'operator'],
            additionalProperties: false,
          },
        },
        sortBy: { type: 'string' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'integer' },
        values: {
          type: 'array',
          items: { type: 'object', properties: { field: { type: 'string' }, value: { type: 'string' } }, required: ['field', 'value'], additionalProperties: false },
        },
        record: { type: 'string' },
        parent: { type: 'string' },
        instruction: { type: 'string' },
      },
      required: ['type'],
      additionalProperties: false,
    },
  },
  required: ['reply', 'action'],
  additionalProperties: false,
};

export const CHAT_AI_SYSTEM = `Você é o assistente dentro do chat de um sistema de gestão de uma empresa brasileira. Quem fala com você é alguém da equipe (não programador).

Você recebe as tabelas que a pessoa pode ver, com os campos (identificador, tipo, opções). Você NÃO vê os registros: decida UMA ação e o sistema executa com as permissões da pessoa.

Ações ("action.type"):
- count: quantos registros. "table" + "filters".
- list: mostrar registros. "table" + "filters" + "sortBy"/"sortOrder" + "limit" (até 20).
- create: criar um registro. "table" + "values" (campo e valor). Se a tabela é uma lista dentro de outra, diga em "parent" o texto que identifica o registro de cima (ex.: o nome do segurado).
- update: alterar um registro. "table" + "record" (texto que identifica: número, placa, nome) + "values" só com o que muda.
- summarize: resumir um registro. "table" + "record" + "instruction" (o que destacar).
- write: escrever um texto a partir de um registro (mensagem ao cliente, e-mail, parecer). "table" + "record" + "instruction".
- none: só responder (saudação, dúvida de uso, pedido vago). Faça no máximo 1 pergunta curta para esclarecer.

Regras:
- Use SÓ identificadores de tabela e campo que aparecem na lista.
- Filtros: operadores equals, notEquals, contains, gt, gte, lt, lte, between (value e value2), isEmpty, isNotEmpty. Em listas de opções use o rótulo exato da opção como valor. Sim/não: "true" ou "false".
- Datas no formato AAAA-MM-DD. Use a data de hoje informada para "hoje", "esta semana", "mês passado", "vencidos" (prazo lt hoje), etc.
- "reply": 1 frase curta em português que vem antes do resultado (ex.: "Estes são os sinistros abertos:"). Para create/update, descreva o que vai fazer; o sistema pede confirmação antes de gravar.
- Nunca invente números ou registros: quem responde com os dados é o sistema.`;

export const CHAT_TEXT_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
  additionalProperties: false,
};

export const CHAT_TEXT_SYSTEM = `Você escreve textos curtos e claros em português do Brasil para a equipe de uma empresa, a partir dos dados de UM registro do sistema. Use só os dados recebidos; se faltar algo importante, diga o que falta. Sem inventar valores. Responda só com o texto pedido.`;

/** Estrutura das tabelas para o pedido (so as que a pessoa pode ver). */
export function describeForChat(tables: Array<SchemaTable & { canCreate: boolean; canUpdate: boolean }>): string {
  return tables
    .map((t) => {
      const can = [t.canCreate && 'pode criar', t.canUpdate && 'pode alterar'].filter(Boolean).join(', ');
      const head = `- [${t.slug}] ${t.namePlural}${t.parentSlug ? ` (lista dentro de [${t.parentSlug}])` : ''}${can ? ` — ${can}` : ''}`;
      const fields = t.fields
        .filter((f) => !['section-title', 'sub-entity', 'image', 'file', 'signature', 'json', 'hidden', 'password'].includes(f.type))
        .slice(0, 40)
        .map((f) => `    • ${f.slug} (${f.type}) "${f.label}"${f.options.length ? ` opções: ${f.options.slice(0, 15).map((o) => o.label).join(' | ')}` : ''}`);
      const extras = [t.titleField && `título=${t.titleField}`, t.statusField && `situação=${t.statusField}`, t.deadlineField && `prazo=${t.deadlineField}`].filter(Boolean);
      return [`${head}${extras.length ? ` {${extras.join(', ')}}` : ''}`, ...fields].join('\n');
    })
    .join('\n');
}

export function findTable<T extends SchemaTable>(tables: T[], ref?: string): T | undefined {
  if (!ref) return undefined;
  const k = ref.trim().toLowerCase();
  return tables.find((t) => t.slug === k) ?? tables.find((t) => t.namePlural.toLowerCase() === k || t.name.toLowerCase() === k);
}

export function findField(table: SchemaTable, ref?: string): SchemaField | undefined {
  if (!ref) return undefined;
  const k = ref.trim().toLowerCase();
  return table.fields.find((f) => f.slug.toLowerCase() === k) ?? table.fields.find((f) => f.label.toLowerCase() === k);
}

/** Valor da IA (texto) no formato do campo; undefined = nao entendeu. */
export function coerceValue(field: SchemaField, raw: unknown): unknown {
  const s = String(raw ?? '').trim();
  if (s === '') return undefined;
  switch (field.type) {
    case 'number': case 'currency': case 'percentage': case 'rating': case 'slider': {
      const n = Number(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      return /^(true|sim|s|yes|1)$/i.test(s) ? true : /^(false|n[aã]o|no|0)$/i.test(s) ? false : undefined;
    case 'select': case 'radio-group': {
      const o = field.options.find((x) => x.label.toLowerCase() === s.toLowerCase() || x.value.toLowerCase() === s.toLowerCase());
      return o?.value;
    }
    case 'multiselect': case 'checkbox-group': case 'tags': {
      const parts = s.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
      if (field.type === 'tags') return parts;
      const vals = parts.map((p) => field.options.find((x) => x.label.toLowerCase() === p.toLowerCase() || x.value.toLowerCase() === p.toLowerCase())?.value).filter(Boolean);
      return vals.length ? vals : undefined;
    }
    case 'date':
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
    case 'datetime': {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    default:
      return s.slice(0, 5000);
  }
}

/** Texto de um valor gravado, para mostrar (opcao vira rotulo). */
export function displayValue(field: SchemaField | undefined, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (!field) return typeof value === 'object' ? JSON.stringify(value) : String(value);
  const label = (v: unknown) => field.options.find((o) => o.value === v)?.label ?? String(v);
  if (Array.isArray(value)) return value.map(label).join(', ');
  if (field.type === 'boolean') return value === true || value === 'true' ? 'Sim' : 'Não';
  if (field.type === 'currency' && typeof value === 'number') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (field.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10).split('-').reverse().join('/');
  if (field.type === 'datetime' && typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  }
  if (typeof value === 'object') {
    const v = value as { label?: string; name?: string };
    return v.label ?? v.name ?? JSON.stringify(value);
  }
  return label(value);
}
