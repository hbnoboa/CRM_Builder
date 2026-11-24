import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector, PowerSyncCredentials } from '@powersync/web';
import api from '@/lib/api';

type Credentials = { token: string; endpoint: string; expiresAt: string };

/** Erro do servidor que nao adianta repetir (permissao, campo obrigatorio, limite do plano...). */
function isPermanent(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return !!status && status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}

/**
 * Liga o banco local a API: token do PowerSync (mesmo do app do celular) e envio das
 * alteracoes feitas sem internet pelas rotas normais da API (mesma regra do app).
 */
export class OfflineConnector implements PowerSyncBackendConnector {
  /** Alteracoes que o servidor recusou (mostradas na tela de campo). */
  rejected: Array<{ id: string; message: string }> = [];

  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const { data } = await api.post<Credentials>('/sync/credentials');
    // A API devolve o endereco com /sync no fim (https://dominio/sync). O SDK do celular
    // ignora esse caminho (pede /sync/stream na raiz), mas o web junta tudo e cairia em
    // /sync/sync/stream, que nao existe. So a origem deixa os dois iguais.
    return { endpoint: new URL(data.endpoint).origin, token: data.token, expiresAt: new Date(data.expiresAt) };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const tx = await database.getNextCrudTransaction();
    if (!tx) return;
    for (const op of tx.crud) {
      if (op.table !== 'EntityData') continue; // o resto e so leitura no aparelho
      try {
        const row = await database.getOptional<{ entityId: string; data: string; parentRecordId: string | null }>(
          'SELECT entityId, data, parentRecordId FROM EntityData WHERE id = ?', [op.id]);
        const entityId = (op.opData?.entityId as string | undefined) ?? row?.entityId;
        const entity = entityId
          ? await database.getOptional<{ slug: string }>('SELECT slug FROM Entity WHERE id = ?', [entityId])
          : null;
        if (!entity) continue;
        const raw = (op.opData?.data as string | undefined) ?? row?.data;
        const data = raw ? JSON.parse(raw) : undefined;
        if (op.op === 'PUT') {
          const parentRecordId = (op.opData?.parentRecordId as string | undefined) ?? row?.parentRecordId ?? undefined;
          await api.post(`/data/${entity.slug}`, { id: op.id, data: data ?? {}, ...(parentRecordId ? { parentRecordId } : {}) });
        } else if (op.op === 'PATCH') {
          if (op.opData?.deletedAt) await api.delete(`/data/${entity.slug}/${op.id}`);
          else if (data) await api.patch(`/data/${entity.slug}/${op.id}`, { data });
        } else if (op.op === 'DELETE') {
          await api.delete(`/data/${entity.slug}/${op.id}`);
        }
      } catch (error) {
        if (!isPermanent(error)) throw error; // sem rede/servidor fora: tenta de novo depois
        const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
        this.rejected.push({ id: op.id, message: Array.isArray(message) ? message.join(', ') : message || 'O servidor recusou a alteração' });
      }
    }
    await tx.complete();
  }
}
