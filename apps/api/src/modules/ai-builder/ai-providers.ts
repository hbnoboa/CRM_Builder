import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AiProposal } from './ai-builder.schema';

/**
 * Provedor de IA do assistente (plugavel por AI_BUILDER_PROVIDER):
 *   off (padrao) -> assistente escondido
 *   mock         -> resposta fixa, sem rede (testes automatizados)
 *   claude-cli   -> SO EM DEV: ponte HTTP no host que roda `claude -p` com o login
 *                   de quem administra a VM (scripts/ai-bridge/claude-bridge.ts)
 *   anthropic    -> (proxima etapa) API da Anthropic com chave propria
 */

export interface AiProposeInput {
  system: string;
  /** Pedido completo em texto: tabelas existentes, proposta atual e conversa. */
  prompt: string;
  schema: Record<string, unknown>;
  /** So para o mock (deterministico). */
  lastMessage: string;
  current: AiProposal | null;
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
  async propose({ lastMessage, current }: AiProposeInput): Promise<AiProposeOutput> {
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

/** Ponte local para o `claude -p` (dev). Nunca configurar em producao. */
export class ClaudeCliBridgeProvider implements AiBuilderProvider {
  readonly name = 'claude-cli';
  private readonly logger = new Logger(ClaudeCliBridgeProvider.name);

  constructor(private readonly url: string, private readonly token: string) {}

  async propose({ system, prompt, schema }: AiProposeInput): Promise<AiProposeOutput> {
    let res: Response;
    try {
      res = await fetch(`${this.url.replace(/\/$/, '')}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ system, prompt, schema }),
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
