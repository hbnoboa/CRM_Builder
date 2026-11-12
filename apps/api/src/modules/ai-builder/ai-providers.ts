import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AiProposal } from './ai-builder.schema';
import type { AiDashboardProposal } from './dashboard-proposal';
import type { AiPdfProposal } from './pdf-proposal';
import type { SchemaTable } from './tenant-schema';

export type AiAssistantKind = 'tables' | 'dashboard' | 'pdf' | 'chat' | 'chat-text' | 'page';

/** Imagem enviada junto do pedido (modelo de pagina, por exemplo). */
export interface AiImage {
  mediaType: string;
  /** base64 */
  data: string;
}

/**
 * Provedor de IA do assistente (plugavel por AI_BUILDER_PROVIDER):
 *   off (padrao) -> assistente escondido
 *   mock         -> resposta fixa, sem rede (testes automatizados)
 *   claude-cli   -> SO EM DEV: ponte HTTP no host que roda `claude -p` com o login
 *                   de quem administra a VM (scripts/ai-bridge/claude-bridge.ts)
 *   anthropic    -> (proxima etapa) API da Anthropic com chave propria
 */

export interface AiProposeInput {
  kind: AiAssistantKind;
  system: string;
  /** Pedido completo em texto: tabelas existentes, proposta atual e conversa. */
  prompt: string;
  schema: Record<string, unknown>;
  /** So para o mock (deterministico). */
  lastMessage: string;
  current: unknown;
  tables: SchemaTable[];
  preferredTable?: string;
  images?: AiImage[];
}

export interface AiProposeOutput {
  output: unknown;
  costUsd?: number;
  durationMs?: number;
}

export interface AiBuilderProvider {
  readonly name: string;
  propose(input: AiProposeInput): Promise<AiProposeOutput>;
}

/** Sem rede: uma proposta fixa (cliente -> visitas, servicos) e um ajuste por pedido. */
export class MockAiProvider implements AiBuilderProvider {
  readonly name = 'mock';

  // eslint-disable-next-line @typescript-eslint/require-await
  async propose(input: AiProposeInput): Promise<AiProposeOutput> {
    if (input.kind === 'dashboard') return { output: mockDashboard(input) };
    if (input.kind === 'page') return { output: mockPage(input) };
    if (input.kind === 'pdf') return { output: mockPdf(input) };
    if (input.kind === 'chat') return { output: mockChat(input) };
    if (input.kind === 'chat-text') return { output: { text: `Resumo de teste: ${input.prompt.split('\n').filter((l) => l.includes(':')).slice(1, 3).join(' · ')}` } };
    const { lastMessage } = input;
    const current = input.current as AiProposal | null;
    if (current) {
      const next: AiProposal = JSON.parse(JSON.stringify(current)) as AiProposal;
      next.tables[0].fields.push({ key: 'observacoes', label: 'Observações', type: 'textarea', width: 'full' });
      next.reply = `Adicionei o campo Observações em ${next.tables[0].name}. (${lastMessage.slice(0, 40)})`;
      return { output: next };
    }
    const proposal: AiProposal = {
      reply: 'Montei Clientes, com as visitas dentro de cada cliente, e um catálogo de serviços.',
      group: 'Atendimento',
      tables: [
        {
          key: 'clientes', name: 'Cliente', namePlural: 'Clientes', description: 'Quem você atende.',
          icon: 'Users', color: 'blue', titleField: 'nome',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, width: 'half' },
            { key: 'telefone', label: 'Telefone', type: 'phone', width: 'quarter' },
            { key: 'email', label: 'E-mail', type: 'email', width: 'quarter' },
            { key: 'endereco', label: 'Endereço', type: 'text', width: 'full' },
          ],
        },
        {
          key: 'visitas', name: 'Visita', namePlural: 'Visitas', description: 'Cada visita feita ao cliente.',
          icon: 'CalendarCheck', color: 'teal', parentKey: 'clientes',
          titleField: 'assunto', statusField: 'situacao', doneOptions: ['Concluída', 'Cancelada'],
          deadlineField: 'data', assigneeField: 'responsavel',
          fields: [
            { key: 'assunto', label: 'Assunto', type: 'text', required: true },
            { key: 'data', label: 'Data', type: 'date', required: true, width: 'quarter' },
            {
              key: 'situacao', label: 'Situação', type: 'select', width: 'quarter',
              options: [
                { label: 'Agendada', color: 'blue' }, { label: 'Concluída', color: 'green' }, { label: 'Cancelada', color: 'gray' },
              ],
            },
            { key: 'responsavel', label: 'Responsável', type: 'user-select', width: 'half' },
            { key: 'servico', label: 'Serviço', type: 'relation', relatedTable: 'servicos', width: 'half' },
            { key: 'relato', label: 'Relato', type: 'textarea' },
          ],
        },
        {
          key: 'servicos', name: 'Serviço', namePlural: 'Serviços', description: 'O que você oferece e o preço.',
          icon: 'Wrench', color: 'violet', titleField: 'nome',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true },
            { key: 'preco', label: 'Preço', type: 'currency' },
          ],
        },
      ],
    };
    return { output: proposal };
  }
}

/**
 * Chat de teste (sem rede): "quantos X", "liste X", "crie X: titulo", "mude REG para OPCAO",
 * "resuma REG", "escreva ... REG". Tabela = a citada pelo nome; senao a primeira.
 */
function mockChat({ lastMessage, tables }: AiProposeInput) {
  const m = lastMessage.toLowerCase();
  const table = tables.find((t) => m.includes(t.namePlural.toLowerCase()) || m.includes(t.name.toLowerCase())) ?? tables[0];
  const slug = table?.slug ?? '';
  const status = table?.fields.find((f) => f.slug === table.statusField) ?? table?.fields.find((f) => f.type === 'select');
  if (/^quant/.test(m)) return { reply: 'Contagem:', action: { type: 'count', table: slug } };
  if (/^(liste|mostre)/.test(m)) {
    const opt = status?.options.find((o) => m.includes(o.label.toLowerCase()));
    return { reply: 'Lista:', action: { type: 'list', table: slug, filters: opt ? [{ field: status!.slug, operator: 'equals', value: opt.label }] : [] } };
  }
  const create = /^crie [^:]+:\s*(.+?)(?:\s+em\s+(.+))?$/i.exec(lastMessage);
  if (create && table?.titleField) {
    return { reply: 'Vou criar:', action: { type: 'create', table: slug, values: [{ field: table.titleField, value: create[1] }], ...(create[2] ? { parent: create[2] } : {}) } };
  }
  const update = /^mude (\S+) para (.+)$/i.exec(lastMessage);
  if (update && status) return { reply: 'Vou alterar:', action: { type: 'update', table: slug, record: update[1], values: [{ field: status.slug, value: update[2] }] } };
  const sum = /^(resuma|escreva)\b.*?(\S+)$/i.exec(lastMessage);
  if (sum) return { reply: '', action: { type: /^resuma/i.test(lastMessage) ? 'summarize' : 'write', table: slug, record: sum[2], instruction: lastMessage } };
  return { reply: 'Posso contar, listar, criar ou alterar registros. Como ajudo?', action: { type: 'none' } };
}

function mockDashboard({ current, tables }: AiProposeInput): AiDashboardProposal {
  if (current) {
    const next = JSON.parse(JSON.stringify(current)) as AiDashboardProposal;
    next.tabs[0].rows.push([{ type: 'activity-feed', title: 'Últimas alterações', table: next.mainTable, width: 12 }]);
    next.reply = 'Coloquei as últimas alterações no fim.';
    return next;
  }
  const main = tables.find((t) => !t.parentSlug) ?? tables[0];
  const group = main?.fields.find((f) => f.type === 'select');
  return {
    reply: `Montei um painel de ${main?.namePlural ?? 'registros'}.`,
    name: `Painel de ${main?.namePlural ?? 'registros'}`,
    description: 'Números, situação e a lista completa.',
    mainTable: main?.slug ?? '',
    tabs: [{
      label: 'Visão geral',
      rows: [
        [{ type: 'kpi-card', title: 'Total', table: main?.slug ?? '', width: 4, aggregation: 'count' }],
        ...(group ? [[{ type: 'donut-chart' as const, title: `Por ${group.label.toLowerCase()}`, table: main!.slug, groupBy: group.slug, width: 6 }]] : []),
        [{ type: 'data-table', title: main?.namePlural ?? 'Registros', table: main?.slug ?? '', width: 12 }],
      ],
    }],
  };
}

function mockPdf({ current, tables, preferredTable }: AiProposeInput): AiPdfProposal {
  if (current) {
    const next = JSON.parse(JSON.stringify(current)) as AiPdfProposal;
    next.sections.push({ kind: 'text', title: 'Observações', text: 'Documento gerado pelo sistema.' });
    next.reply = 'Coloquei um texto de observações no fim.';
    return next;
  }
  const table = tables.find((t) => t.slug === preferredTable) ?? tables[0];
  const simple = (table?.fields || []).filter((f) => !['sub-entity', 'section-title', 'image', 'file', 'signature'].includes(f.type));
  return {
    reply: `Montei um documento de ${table?.name ?? 'registro'}.`,
    name: `Ficha de ${table?.name ?? 'registro'}`,
    description: 'Os dados principais do registro.',
    table: table?.slug ?? '',
    title: table?.titleField ? `${table.name} {{${table.titleField}}}` : (table?.name ?? 'Documento'),
    sections: [
      { kind: 'heading', title: 'Dados' },
      { kind: 'fields', fields: simple.slice(0, 4).map((f) => f.slug), columns: 2 },
      { kind: 'divider' },
    ],
  };
}

/** Pagina de teste: destaque, texto, icones e contato (com quantas imagens vieram). */
function mockPage({ current, lastMessage, images }: AiProposeInput) {
  const prev = current as { title?: string } | null;
  return {
    reply: `Página de teste montada${images?.length ? ` a partir de ${images.length} imagem(ns)` : ''}. (${lastMessage.slice(0, 40)})`,
    title: prev?.title || 'Início',
    theme: { decor: 'classic', accent: '#0f766e', colors: { bg: '#f0fdfa', text: '#134e4a' }, fonts: { heading: 'playfair-display', body: 'lato' }, buttons: { shape: 'pill', fill: 'solid' }, animation: 'rise' },
    header: { layout: 'inline', cta: { label: 'Fale com a gente', url: 'https://wa.me/5511999990000' } },
    footer: { layout: 'columns', tone: 'dark' },
    sections: [
      { width: 'full', padding: 'none', items: [{ w: 12, block: { type: 'hero', title: 'Bem-vindo!', text: 'Uma frase sobre o negócio.', buttonLabel: 'Conheça', buttonUrl: '#servicos' } }] },
      { name: 'servicos', width: 'normal', padding: 'lg', items: [
        { w: 12, align: 'center', block: { type: 'heading', text: 'O que fazemos' } },
        { w: 12, newRow: true, block: { type: 'icons', columns: 3, items: [{ icon: 'star', title: 'Qualidade' }, { icon: 'heart', title: 'Carinho' }, { icon: 'truck', title: 'Entrega' }] } },
      ] },
      { width: 'normal', padding: 'lg', tone: 'surface', items: [
        { w: 6, block: { type: 'text', text: 'Conte aqui a história da empresa.' } },
        { w: 6, block: { type: 'map', address: 'Seu endereço aqui' } },
      ] },
      // Foto com coluna ao lado, descrita em linhas (como a IA costuma mandar)
      { width: 'normal', padding: 'lg', items: [
        { w: 6, block: { type: 'image', url: 'https://example.com/loja.jpg', alt: 'Loja' } },
        { w: 6, block: { type: 'heading', text: 'A casa' } },
        { w: 6, newRow: true, block: { type: 'text', text: 'Um pouco da nossa história.' } },
        { w: 6, newRow: true, block: { type: 'button', label: 'Visite', url: '#servicos' } },
      ] },
      { width: 'full', padding: 'lg', bgImage: 'https://example.com/fundo.jpg', items: [{ w: 12, block: { type: 'heading', text: 'Venha nos ver' } }] },
    ],
  };
}

/** Ponte local para o `claude -p` (dev). Nunca configurar em producao. */
export class ClaudeCliBridgeProvider implements AiBuilderProvider {
  readonly name = 'claude-cli';
  private readonly logger = new Logger(ClaudeCliBridgeProvider.name);

  constructor(private readonly url: string, private readonly token: string) {}

  async propose({ system, prompt, schema, images }: AiProposeInput): Promise<AiProposeOutput> {
    let res: Response;
    try {
      res = await fetch(`${this.url.replace(/\/$/, '')}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ system, prompt, schema, ...(images?.length ? { images } : {}) }),
        signal: AbortSignal.timeout(200_000),
      });
    } catch (err) {
      this.logger.error(`Ponte da IA fora do ar: ${(err as Error).message}`);
      throw new ServiceUnavailableException('O assistente está fora do ar agora. Tente de novo em instantes.');
    }
    if (!res.ok) {
      this.logger.error(`Ponte da IA respondeu ${res.status}`);
      throw new ServiceUnavailableException('O assistente não conseguiu responder. Tente de novo.');
    }
    return (await res.json()) as AiProposeOutput;
  }
}

export function createAiBuilderProvider(env: NodeJS.ProcessEnv = process.env): AiBuilderProvider | null {
  switch (env.AI_BUILDER_PROVIDER) {
    case 'mock':
      return new MockAiProvider();
    case 'claude-cli':
      if (!env.AI_BRIDGE_URL || !env.AI_BRIDGE_TOKEN) return null;
      return new ClaudeCliBridgeProvider(env.AI_BRIDGE_URL, env.AI_BRIDGE_TOKEN);
    default:
      return null;
  }
}
