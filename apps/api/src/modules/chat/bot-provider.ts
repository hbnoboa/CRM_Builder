/**
 * Provider de LLM do bot (plugável). Ver docs/chat-bot-module-spec.md §5.
 * O provider apenas DECIDE qual ferramenta usar (toolbelt fechado) — a EXECUÇÃO,
 * com as permissões do usuário, fica no ChatService. Fatia 3: read-only via mock.
 *   BOT_LLM_PROVIDER=mock      → MockBotProvider (determinístico, zero custo)
 *   BOT_LLM_PROVIDER=anthropic → (Fatia 6) Claude Haiku com tool-use
 */

export interface ToolDef {
  name: string;
  description: string;
}

export type BotDecision =
  | { tool: string; args: Record<string, unknown> }
  | { abstain: true; reason: string };

export interface BotDecideInput {
  message: string;
  tools: ToolDef[];
  context: { channelEntitySlug?: string | null };
}

export interface BotLlmProvider {
  decide(input: BotDecideInput): Promise<BotDecision>;
}

// Toolbelt FECHADO da Fatia 3 (somente leitura). Novas ferramentas (escrita,
// reabrir_veiculo, etc.) entram nas fatias seguintes, com teto/confirmação/audit.
export const BOT_TOOLS: ToolDef[] = [
  { name: 'contar_registros', description: 'Conta quantos registros de uma tabela o usuário pode ver.' },
  { name: 'listar_registros', description: 'Lista alguns registros de uma tabela.' },
  { name: 'reabrir_veiculo', description: 'Reabre um veículo (marca concluído = não). Ação elevada (as_bot).' },
];

function detectEntity(m: string): string | null {
  if (/ve[ií]cul/.test(m)) return 'veiculos';
  if (/avaria|conformidad/.test(m)) return 'nao-conformidades';
  if (/opera[çc]/.test(m)) return 'operacoes';
  return null;
}

/**
 * MockProvider determinístico: keyword → ferramenta. Sem rede, sem custo,
 * repetível em teste. Mapeia o pedido para EXATAMENTE uma ferramenta declarada
 * ou abstém (contrato de saída rígido).
 */
export class MockBotProvider implements BotLlmProvider {
  // eslint-disable-next-line @typescript-eslint/require-await
  async decide({ message, context }: BotDecideInput): Promise<BotDecision> {
    const m = message.toLowerCase();
    const entitySlug = detectEntity(m) || context.channelEntitySlug || null;

    // Ação elevada: "reabre/reabrir o veículo <chassi>". Extrai o maior token alfanumérico.
    if (/reabr/.test(m)) {
      const token = (message.match(/[A-Za-z0-9]{5,}/g) || [])
        .filter((t) => !/^(reabr|reabre|reabrir|veicul|veículo|veiculo)/i.test(t))
        .sort((a, b) => b.length - a.length)[0];
      return { tool: 'reabrir_veiculo', args: { chassi: token } };
    }
    if (/\bquant|contar|n[úu]mero|total|quanto/.test(m)) {
      return { tool: 'contar_registros', args: { entitySlug } };
    }
    if (/\blist|mostr|quais|exib|ve(r|ja)\b/.test(m)) {
      return { tool: 'listar_registros', args: { entitySlug, q: '' } };
    }
    return {
      abstain: true,
      reason: 'Não entendi o pedido. Tente, por ex.: "quantas avarias?" ou "liste os veículos".',
    };
  }
}

export function createBotProvider(): BotLlmProvider {
  // Fatia 6: if (process.env.BOT_LLM_PROVIDER === 'anthropic') return new AnthropicBotProvider();
  return new MockBotProvider();
}
