import { Injectable, Logger } from '@nestjs/common';

export interface CircuitState {
  failures: number;
  consecutiveFailures: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  openedAt: Date | null;
}

export class CircuitOpenException extends Error {
  constructor(
    message: string,
    public readonly automationId: string,
    public readonly automationName: string,
    public readonly failures: number,
  ) {
    super(message);
    this.name = 'CircuitOpenException';
  }
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  // Configurações
  private readonly FAILURE_THRESHOLD = 5; // 5 falhas consecutivas
  private readonly TIMEOUT = 60000; // 1 minuto (milissegundos)
  private readonly HALF_OPEN_MAX_ATTEMPTS = 3;

  // Armazena estado por automationId
  // Em produção, usar Redis para compartilhar entre workers
  private readonly circuits = new Map<string, CircuitState>();

  /**
   * Executa função com circuit breaker
   * Se circuit estiver OPEN, lança exceção
   * Se executar com sucesso, reseta circuit
   * Se falhar, incrementa contador
   */
  async call<T>(
    automationId: string,
    automationName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const circuit = this.getCircuit(automationId);

    // Circuit OPEN - não executar
    if (circuit.state === 'OPEN') {
      const timeSinceOpen = Date.now() - (circuit.openedAt?.getTime() || 0);

      // Timeout ainda não expirou
      if (timeSinceOpen < this.TIMEOUT) {
        const remainingMs = this.TIMEOUT - timeSinceOpen;
        const remainingSec = Math.ceil(remainingMs / 1000);

        this.logger.warn(
          `⚠️ Circuit OPEN: ${automationName} (${automationId})\n` +
          `   Falhas consecutivas: ${circuit.consecutiveFailures}\n` +
          `   Aguardar ${remainingSec}s para retry`
        );

        throw new CircuitOpenException(
          `Automation "${automationName}" temporariamente desabilitada devido a falhas repetidas (${circuit.consecutiveFailures}). ` +
          `Tente novamente em ${remainingSec} segundos.`,
          automationId,
          automationName,
          circuit.consecutiveFailures,
        );
      }

      // Timeout expirou - tentar HALF_OPEN
      circuit.state = 'HALF_OPEN';
      this.logger.log(
        `🔄 Circuit HALF_OPEN: ${automationName} (tentando recuperação)`
      );
    }

    // Executar função
    try {
      const result = await fn();

      // Sucesso - resetar ou fechar circuit
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        circuit.consecutiveFailures = 0;
        this.logger.log(
          `✅ Circuit CLOSED: ${automationName} (recuperado após falhas)`
        );
      } else if (circuit.consecutiveFailures > 0) {
        // Estava falhando mas recuperou
        circuit.consecutiveFailures = 0;
      }

      circuit.lastSuccess = new Date();
      return result;

    } catch (error) {
      // Falha - incrementar contador
      circuit.failures++;
      circuit.consecutiveFailures++;
      circuit.lastFailure = new Date();

      this.logger.error(
        `❌ Circuit FAILURE: ${automationName}\n` +
        `   Falhas consecutivas: ${circuit.consecutiveFailures}/${this.FAILURE_THRESHOLD}\n` +
        `   Erro: ${error instanceof Error ? error.message : String(error)}`
      );

      // Threshold atingido - abrir circuit
      if (circuit.consecutiveFailures >= this.FAILURE_THRESHOLD) {
        circuit.state = 'OPEN';
        circuit.openedAt = new Date();

        this.logger.error(
          `🔴 Circuit OPEN: ${automationName} (${automationId})\n` +
          `   Threshold atingido: ${circuit.consecutiveFailures} falhas consecutivas\n` +
          `   Automation desabilitada por ${this.TIMEOUT / 1000}s`
        );
      }

      throw error;
    }
  }

  /**
   * Obtém ou cria circuit para uma automation
   */
  private getCircuit(automationId: string): CircuitState {
    if (!this.circuits.has(automationId)) {
      this.circuits.set(automationId, {
        failures: 0,
        consecutiveFailures: 0,
        lastFailure: null,
        lastSuccess: null,
        state: 'CLOSED',
        openedAt: null,
      });
    }
    return this.circuits.get(automationId)!;
  }

  /**
   * Reseta circuit breaker (força fechamento)
   * Útil para admins resetarem manualmente
   */
  async reset(automationId: string): Promise<void> {
    this.circuits.delete(automationId);
    this.logger.log(`🔄 Circuit resetado manualmente: ${automationId}`);
  }

  /**
   * Obtém estado atual do circuit
   */
  getState(automationId: string): CircuitState | null {
    return this.circuits.get(automationId) || null;
  }

  /**
   * Lista todas as automations com circuit OPEN
   */
  getOpenCircuits(): Array<{ automationId: string; circuit: CircuitState }> {
    const circuits: Array<{ automationId: string; circuit: CircuitState }> = [];

    this.circuits.forEach((circuit, automationId) => {
      if (circuit.state === 'OPEN') {
        circuits.push({ automationId, circuit });
      }
    });

    return circuits;
  }

  /**
   * Estatísticas gerais de circuits
   */
  getStats(): {
    total: number;
    closed: number;
    open: number;
    halfOpen: number;
    totalFailures: number;
  } {
    const circuits = Array.from(this.circuits.values());

    return {
      total: circuits.length,
      closed: circuits.filter(c => c.state === 'CLOSED').length,
      open: circuits.filter(c => c.state === 'OPEN').length,
      halfOpen: circuits.filter(c => c.state === 'HALF_OPEN').length,
      totalFailures: circuits.reduce((sum, c) => sum + c.failures, 0),
    };
  }

  /**
   * Limpa todos os circuits (útil para testes)
   */
  clearAll(): void {
    const count = this.circuits.size;
    this.circuits.clear();
    this.logger.debug(`🗑️ ${count} circuits limpos`);
  }

  /**
   * Retorna todos os circuits (para monitoramento)
   */
  getAllCircuits(): Array<{ automationId: string; circuit: CircuitState }> {
    const circuits: Array<{ automationId: string; circuit: CircuitState }> = [];

    this.circuits.forEach((circuit, automationId) => {
      circuits.push({ automationId, circuit });
    });

    return circuits;
  }

  /**
   * Retorna resumo dos circuits (alias para getStats)
   */
  getSummary(): {
    total: number;
    closed: number;
    open: number;
    halfOpen: number;
    totalFailures: number;
  } {
    return this.getStats();
  }
}
