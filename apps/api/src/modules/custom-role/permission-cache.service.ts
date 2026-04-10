import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';

export interface UserPermissions {
  roleType: string;
  modulePermissions: Record<string, unknown>;
  entityPermissions: Array<{
    entitySlug: string;
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    scope: 'all' | 'own';
    dataFilters?: Array<{ fieldSlug: string; operator: string; value: unknown }>;
  }>;
}

@Injectable()
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);
  private readonly TTL = 300; // 5 minutos em segundos

  constructor(private readonly redis: RedisService) {}

  /**
   * Gera chave única para permissions de usuário
   */
  private getUserPermissionKey(userId: string, tenantId: string): string {
    return `permissions:${tenantId}:user:${userId}`;
  }

  /**
   * Gera chave para permissions de uma role
   */
  private getRolePermissionKey(roleId: string): string {
    return `permissions:role:${roleId}`;
  }

  /**
   * Buscar permissions do usuário no cache
   */
  async getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<UserPermissions | null> {
    const key = this.getUserPermissionKey(userId, tenantId);
    const cached = await this.redis.get<UserPermissions>(key);

    if (cached) {
      this.logger.debug(`✅ Cache HIT: ${key}`);
    } else {
      this.logger.debug(`❌ Cache MISS: ${key}`);
    }

    return cached;
  }

  /**
   * Salvar permissions do usuário no cache
   */
  async setUserPermissions(
    userId: string,
    tenantId: string,
    permissions: UserPermissions
  ): Promise<void> {
    const key = this.getUserPermissionKey(userId, tenantId);
    await this.redis.set(key, permissions, this.TTL);
    this.logger.debug(`💾 Cached: ${key} (TTL: ${this.TTL}s)`);
  }

  /**
   * Invalidar cache de permissions de um usuário específico
   */
  async invalidateUserPermissions(userId: string, tenantId: string): Promise<void> {
    const key = this.getUserPermissionKey(userId, tenantId);
    await this.redis.del(key);
    this.logger.log(`🗑️ Invalidado cache de usuário: ${userId} (tenant: ${tenantId})`);
  }

  /**
   * Invalidar cache de permissions de uma role
   * Isso NÃO invalida os users, mas é útil para tracking
   */
  async invalidateRolePermissions(roleId: string): Promise<void> {
    const roleKey = this.getRolePermissionKey(roleId);
    await this.redis.del(roleKey);
    this.logger.log(`🗑️ Invalidado cache de role: ${roleId}`);
  }

  /**
   * Invalidar TODOS os caches de permissions de um tenant
   * Usar quando há mudanças globais (ex: admin atualiza configurações)
   */
  async invalidateTenantPermissions(tenantId: string): Promise<void> {
    const pattern = `permissions:${tenantId}:*`;
    const deletedCount = await this.redis.delPattern(pattern);
    this.logger.log(
      `🗑️ Invalidados ${deletedCount} caches de permissions do tenant: ${tenantId}`
    );
  }

  /**
   * Invalidar permissions de múltiplos usuários
   * Útil quando uma role é atualizada e afeta vários usuários
   */
  async invalidateMultipleUsers(
    userIds: string[],
    tenantId: string
  ): Promise<void> {
    const promises = userIds.map(userId =>
      this.invalidateUserPermissions(userId, tenantId)
    );

    await Promise.all(promises);
    this.logger.log(
      `🗑️ Invalidados caches de ${userIds.length} usuários (tenant: ${tenantId})`
    );
  }

  /**
   * Obter estatísticas do cache (para monitoramento)
   */
  async getStats(): Promise<{
    totalKeys: number;
    permissionKeys: number;
    averageTTL: number;
  }> {
    try {
      const allKeys = await this.redis.client.keys('permissions:*');
      const totalKeys = allKeys.length;

      if (totalKeys === 0) {
        return { totalKeys: 0, permissionKeys: 0, averageTTL: 0 };
      }

      // Calcular TTL médio (sample de até 100 chaves)
      const sampleKeys = allKeys.slice(0, 100);
      const ttls = await Promise.all(
        sampleKeys.map(key => this.redis.ttl(key))
      );

      const validTTLs = ttls.filter(ttl => ttl > 0);
      const averageTTL = validTTLs.length > 0
        ? Math.round(validTTLs.reduce((a, b) => a + b, 0) / validTTLs.length)
        : 0;

      return {
        totalKeys: allKeys.length,
        permissionKeys: allKeys.length,
        averageTTL,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao obter stats: ${errorMessage}`);
      return { totalKeys: 0, permissionKeys: 0, averageTTL: 0 };
    }
  }

  /**
   * Pré-aquecer cache para um usuário
   * Útil em login para evitar cache miss na primeira request
   */
  async warmupUser(
    userId: string,
    tenantId: string,
    permissions: UserPermissions
  ): Promise<void> {
    await this.setUserPermissions(userId, tenantId, permissions);
    this.logger.debug(`🔥 Cache pre-aquecido para usuário: ${userId}`);
  }

  /**
   * Limpar TODOS os caches de permissions (apenas dev/teste)
   */
  async clearAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error('❌ clearAll() bloqueado em produção!');
      return;
    }

    const deletedCount = await this.redis.delPattern('permissions:*');
    this.logger.warn(`⚠️ Limpos ${deletedCount} caches de permissions`);
  }
}
