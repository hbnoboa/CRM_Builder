import { Injectable, Logger } from '@nestjs/common';
import { NotificationGateway, Notification } from './notification.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { NotificationType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { evaluateConditions } from '../../common/utils/evaluate-notification-conditions';
import { buildCursorResponse } from '../../common/utils/cursor-pagination.util';

export interface CreateNotificationDto {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface QueryNotificationDto {
  page?: number;
  limit?: number;
  cursor?: string; // Cursor pagination
  unreadOnly?: boolean;
}

// Map string types to Prisma enum
const typeMap: Record<string, NotificationType> = {
  info: NotificationType.INFO,
  success: NotificationType.SUCCESS,
  warning: NotificationType.WARNING,
  error: NotificationType.ERROR,
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly gateway: NotificationGateway,
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  /**
   * Criar e enviar notificação para um usuário
   */
  async notifyUser(
    userId: string,
    notification: CreateNotificationDto,
    tenantId?: string,
    persist: boolean = true,
  ): Promise<Notification> {
    const fullNotification: Notification = {
      id: uuidv4(),
      ...notification,
      timestamp: new Date(),
      read: false,
    };

    // Enviar via WebSocket
    this.gateway.sendToUser(userId, fullNotification);

    // Enviar push notification (mobile)
    this.pushService.sendToUser(userId, {
      title: notification.title,
      body: notification.message,
      data: { type: notification.type, notificationId: fullNotification.id },
    }).catch((err) => {
      this.logger.warn(`Push notification failed for user ${userId}: ${err}`);
    });

    // Salvar no banco de dados
    if (persist && tenantId) {
      try {
        await this.prisma.notification.create({
          data: {
            id: fullNotification.id,
            tenantId,
            userId,
            type: typeMap[notification.type] || NotificationType.INFO,
            title: notification.title,
            message: notification.message,
            data: notification.data as Prisma.InputJsonValue,
            read: false,
          },
        });
        this.logger.log(`Notification saved for user: ${userId}`);
      } catch (error) {
        this.logger.error(`Failed to save notification: ${error}`);
      }
    }

    return fullNotification;
  }

  /**
   * Notificar todos os usuários de um tenant (com filtro opcional por entidade)
   */
  async notifyTenant(
    tenantId: string,
    notification: CreateNotificationDto,
    entitySlug?: string,
    operation?: 'created' | 'updated' | 'deleted',
    recordData?: Record<string, unknown>,
  ): Promise<Notification> {
    const fullNotification: Notification = {
      id: uuidv4(),
      ...notification,
      timestamp: new Date(),
      read: false,
    };

    // Se tem entitySlug, só notificar usuários com permissão nessa entidade
    if (entitySlug) {
      await this.notifyUsersWithEntityAccess(tenantId, entitySlug, fullNotification, operation, recordData);
    } else {
      this.gateway.sendToTenant(tenantId, fullNotification);
    }

    return fullNotification;
  }

  /**
   * Notifica apenas os usuários que têm acesso à entidade específica
   */
  private async notifyUsersWithEntityAccess(
    tenantId: string,
    entitySlug: string,
    notification: Notification,
    operation?: 'created' | 'updated' | 'deleted',
    recordData?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: {
          id: true,
          customRoleId: true,
          customRole: {
            select: { roleType: true, permissions: true },
          },
        },
      });

      // Filtrar usuarios com acesso
      const eligibleUserIds: string[] = [];
      for (const user of users) {
        const roleType = user.customRole?.roleType;

        // PLATFORM_ADMIN e ADMIN recebem tudo
        if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') {
          eligibleUserIds.push(user.id);
          continue;
        }

        // Verificar permissoes da custom role
        if (user.customRole) {
          const permissions = user.customRole.permissions as unknown as Array<{
            entitySlug: string;
            canRead: boolean;
            notificationRules?: {
              enabled: boolean;
              onCreate: boolean;
              onUpdate: boolean;
              onDelete: boolean;
              conditions?: Array<{ fieldSlug: string; fieldType: string; operator: string; value?: unknown; value2?: unknown }>;
            };
          }>;
          const entityPerm = permissions.find(
            (p) => p.entitySlug === entitySlug && p.canRead,
          );

          if (!entityPerm) continue;

          // Checar notificationRules
          const rules = entityPerm.notificationRules;
          if (!rules) {
            // Sem regras definidas → comportamento padrao (recebe tudo)
            eligibleUserIds.push(user.id);
            continue;
          }

          if (!rules.enabled) continue;

          // Checar operacao
          if (operation) {
            const opMap: Record<string, boolean> = {
              created: rules.onCreate,
              updated: rules.onUpdate,
              deleted: rules.onDelete,
            };
            if (opMap[operation] === false) continue;
          }

          // Checar condicoes
          if (rules.conditions && rules.conditions.length > 0 && recordData) {
            if (!evaluateConditions(recordData, rules.conditions)) continue;
          }

          eligibleUserIds.push(user.id);
        }
      }

      // Enviar notificacoes via WebSocket
      for (const userId of eligibleUserIds) {
        this.gateway.sendToUser(userId, notification);
      }

      // Persistir em batch (1 query ao inves de N)
      if (eligibleUserIds.length > 0) {
        await this.prisma.notification.createMany({
          data: eligibleUserIds.map((userId) => ({
            tenantId,
            userId,
            type: typeMap[notification.type] || NotificationType.INFO,
            title: notification.title,
            message: notification.message,
            data: notification.data as Prisma.InputJsonValue,
            entitySlug,
            read: false,
          })),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify users with entity access: ${error}`);
      this.gateway.sendToTenant(tenantId, notification);
    }
  }

  private async persistNotification(
    userId: string,
    tenantId: string,
    notification: Notification,
    entitySlug?: string,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          tenantId,
          userId,
          type: typeMap[notification.type] || NotificationType.INFO,
          title: notification.title,
          message: notification.message,
          data: notification.data as Prisma.InputJsonValue,
          entitySlug,
          read: false,
        },
      });
    } catch (error) {
      // Ignora erros de persistência silenciosamente
    }
  }

  // Helpers para notificações comuns

  /**
   * Notificar sobre criação de registro
   */
  async notifyRecordCreated(
    tenantId: string,
    entityName: string,
    recordName: string,
    createdBy: string,
    entitySlug?: string,
    recordData?: Record<string, unknown>,
  ) {
    return this.notifyTenant(tenantId, {
      type: 'success',
      title: 'Novo Registro',
      message: `${createdBy} criou um novo registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, createdBy, entitySlug },
    }, entitySlug, 'created', recordData);
  }

  /**
   * Notificar sobre atualização de registro
   */
  async notifyRecordUpdated(
    tenantId: string,
    entityName: string,
    recordName: string,
    updatedBy: string,
    entitySlug?: string,
    recordData?: Record<string, unknown>,
  ) {
    return this.notifyTenant(tenantId, {
      type: 'info',
      title: 'Registro Atualizado',
      message: `${updatedBy} atualizou um registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, updatedBy, entitySlug },
    }, entitySlug, 'updated', recordData);
  }

  /**
   * Notificar sobre exclusão de registro
   */
  async notifyRecordDeleted(
    tenantId: string,
    entityName: string,
    recordName: string,
    deletedBy: string,
    entitySlug?: string,
    recordData?: Record<string, unknown>,
  ) {
    return this.notifyTenant(tenantId, {
      type: 'warning',
      title: 'Registro Excluído',
      message: `${deletedBy} excluiu um registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, deletedBy, entitySlug },
    }, entitySlug, 'deleted', recordData);
  }

  /**
   * Notificar sobre novo usuário
   */
  async notifyNewUser(tenantId: string, userName: string, invitedBy: string) {
    return this.notifyTenant(tenantId, {
      type: 'info',
      title: 'Novo Usuário',
      message: `${invitedBy} convidou ${userName} para a plataforma`,
      data: { userName, invitedBy },
    });
  }

  /**
   * Notificar sobre nova entidade
   */
  async notifyEntityCreated(
    tenantId: string,
    entityName: string,
    createdBy: string,
  ) {
    return this.notifyTenant(tenantId, {
      type: 'success',
      title: 'Nova Entidade',
      message: `${createdBy} criou a entidade "${entityName}"`,
      data: { entityName, createdBy },
    });
  }

  /**
   * Notificar sobre erro
   */
  async notifyError(userId: string, title: string, message: string) {
    return this.notifyUser(userId, {
      type: 'error',
      title,
      message,
    });
  }

  /**
   * Notificar todos os administradores de um tenant
   */
  async notifyAdmins(
    tenantId: string,
    notification: CreateNotificationDto,
  ): Promise<void> {
    try {
      // Buscar todos os admins do tenant (ADMIN e PLATFORM_ADMIN)
      const admins = await this.prisma.user.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          customRole: {
            roleType: {
              in: ['ADMIN', 'PLATFORM_ADMIN'],
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (admins.length === 0) {
        this.logger.warn(`Nenhum admin encontrado no tenant ${tenantId}`);
        return;
      }

      // Notificar cada admin
      for (const admin of admins) {
        await this.notifyUser(admin.id, notification, tenantId, true);
      }

      this.logger.log(
        `Notificação enviada para ${admins.length} admin(s) do tenant ${tenantId}`,
      );
    } catch (error) {
      this.logger.error(`Falha ao notificar admins: ${error}`);
      throw error;
    }
  }

  /**
   * Emit data-changed event with operation details for granular frontend updates.
   */
  emitDataChanged(tenantId: string, payload: { operation: string; entitySlug: string; userId?: string; [key: string]: unknown }) {
    // Se o payload tem userId, excluir esse usuário do broadcast para evitar loops infinitos
    const excludeUserId = payload.userId as string | undefined;
    this.gateway.emitDataChanged(tenantId, payload, excludeUserId);
  }

  /**
   * Verificar se usuário está online
   */
  isUserOnline(userId: string): boolean {
    return this.gateway.isUserOnline(userId);
  }

  /**
   * Obter usuários online de um tenant
   */
  getOnlineUsers(tenantId: string): string[] {
    return this.gateway.getOnlineUsers(tenantId);
  }

  // =====================
  // Persistence Methods
  // =====================

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    tenantId: string,
    query: QueryNotificationDto = {},
  ) {
    const { page = 1, limit = 20, cursor, unreadOnly = false } = query;
    const useCursor = !!cursor;

    const where: Prisma.NotificationWhereInput = {
      userId,
      tenantId,
    };

    if (unreadOnly) {
      where.read = false;
    }

    // Cursor pagination (mais eficiente para listas grandes)
    if (useCursor) {
      const takeWithExtra = limit + 1;
      const items = await this.prisma.notification.findMany({
        where,
        take: takeWithExtra,
        orderBy: { createdAt: 'desc' },
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1, // Pular o item do cursor
        }),
      });

      const unreadCount = await this.prisma.notification.count({
        where: { userId, tenantId, read: false },
      });

      const response = buildCursorResponse({
        items,
        limit,
        getCursorValue: (item) => item.id,
      });

      return {
        ...response,
        meta: {
          ...response.meta,
          unreadCount,
        },
      };
    }

    // Offset pagination (legacy - mantido para compatibilidade)
    const skip = (page - 1) * limit;
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, tenantId, read: false },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, tenantId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        tenantId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  /**
   * Delete all read notifications older than a certain date
   */
  async cleanupOldNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notification.deleteMany({
      where: {
        read: true,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old notifications`);
    return result;
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        tenantId,
        read: false,
      },
    });
  }
}
