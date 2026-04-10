import { Injectable, Logger } from '@nestjs/common';

export interface ExecutionContext {
  automationId: string;
  automationName: string;
  recordId: string;
  trigger: string;
  depth: number;
  path: string[]; // IDs das automações no caminho de execução
  pathNames: string[]; // Nomes para exibição
  startedAt: Date;
}

export class LoopDetectedException extends Error {
  constructor(
    message: string,
    public readonly path: string[],
    public readonly pathNames: string[],
    public readonly automationId: string,
  ) {
    super(message);
    this.name = 'LoopDetectedException';
  }
}

export class MaxDepthExceededException extends Error {
  constructor(
    message: string,
    public readonly path: string[],
    public readonly pathNames: string[],
    public readonly depth: number,
  ) {
    super(message);
    this.name = 'MaxDepthExceededException';
  }
}

@Injectable()
export class ExecutionContextService {
  private readonly logger = new Logger(ExecutionContextService.name);
  private readonly MAX_DEPTH = 5;

  // Armazena contexto de execução por recordId
  // Em produção, usar Redis para compartilhar entre workers
  private readonly contexts = new Map<string, ExecutionContext>();

  /**
   * Gera chave única para contexto de execução
   */
  private getContextKey(recordId: string): string {
    return `exec:${recordId}`;
  }

  /**
   * Inicia um novo contexto de execução
   * Valida loop e max depth
   */
  startExecution(
    automationId: string,
    automationName: string,
    recordId: string,
    trigger: string,
    parentContext?: ExecutionContext,
  ): ExecutionContext {
    const depth = parentContext ? parentContext.depth + 1 : 0;
    const path = parentContext
      ? [...parentContext.path, automationId]
      : [automationId];
    const pathNames = parentContext
      ? [...parentContext.pathNames, automationName]
      : [automationName];

    // DETECTAR LOOP: automation já foi executada neste caminho?
    const occurrences = path.filter(id => id === automationId).length;
    if (occurrences > 1) {
      const loopPath = pathNames.join(' → ');
      this.logger.error(
        `🔴 LOOP DETECTADO: ${automationName} (${automationId})\n` +
        `   Caminho: ${loopPath}\n` +
        `   Profundidade: ${depth}`
      );

      throw new LoopDetectedException(
        `Loop infinito detectado: automation "${automationName}" já foi executada neste contexto`,
        path,
        pathNames,
        automationId,
      );
    }

    // DETECTAR MAX DEPTH: profundidade excedida?
    if (depth > this.MAX_DEPTH) {
      const depthPath = pathNames.join(' → ');
      this.logger.error(
        `🔴 MAX DEPTH EXCEDIDO: ${this.MAX_DEPTH}\n` +
        `   Caminho: ${depthPath}\n` +
        `   Profundidade atual: ${depth}`
      );

      throw new MaxDepthExceededException(
        `Profundidade máxima excedida (${this.MAX_DEPTH}). Caminho muito longo de automações encadeadas.`,
        path,
        pathNames,
        depth,
      );
    }

    // Criar contexto
    const context: ExecutionContext = {
      automationId,
      automationName,
      recordId,
      trigger,
      depth,
      path,
      pathNames,
      startedAt: new Date(),
    };

    // Armazenar contexto
    const key = this.getContextKey(recordId);
    this.contexts.set(key, context);

    this.logger.debug(
      `✅ Contexto iniciado: ${automationName} (depth: ${depth})\n` +
      `   Path: ${pathNames.join(' → ')}`
    );

    return context;
  }

  /**
   * Finaliza contexto de execução
   */
  endExecution(recordId: string): void {
    const key = this.getContextKey(recordId);
    const context = this.contexts.get(key);

    if (context) {
      const duration = Date.now() - context.startedAt.getTime();
      this.logger.debug(
        `✓ Contexto finalizado: ${context.automationName} (${duration}ms)`
      );
      this.contexts.delete(key);
    }
  }

  /**
   * Obtém contexto atual de um registro
   * Útil para passar contexto para automações filhas
   */
  getContext(recordId: string): ExecutionContext | undefined {
    const key = this.getContextKey(recordId);
    return this.contexts.get(key);
  }

  /**
   * Verifica se há execução em andamento para um registro
   */
  hasActiveExecution(recordId: string): boolean {
    const key = this.getContextKey(recordId);
    return this.contexts.has(key);
  }

  /**
   * Limpa todos os contextos (útil para testes)
   */
  clearAll(): void {
    const count = this.contexts.size;
    this.contexts.clear();
    this.logger.debug(`🗑️ ${count} contextos limpos`);
  }

  /**
   * Obtém estatísticas de execuções ativas
   */
  getStats(): {
    activeExecutions: number;
    byDepth: Record<number, number>;
    longestChain: number;
  } {
    const contexts = Array.from(this.contexts.values());
    const byDepth: Record<number, number> = {};

    contexts.forEach(ctx => {
      byDepth[ctx.depth] = (byDepth[ctx.depth] || 0) + 1;
    });

    const longestChain = contexts.length > 0
      ? Math.max(...contexts.map(ctx => ctx.depth))
      : 0;

    return {
      activeExecutions: contexts.length,
      byDepth,
      longestChain,
    };
  }

  /**
   * Retorna todos os contextos ativos (para monitoramento)
   */
  getActiveContexts(): ExecutionContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Retorna o número de contextos ativos
   */
  getActiveContextCount(): number {
    return this.contexts.size;
  }
}
