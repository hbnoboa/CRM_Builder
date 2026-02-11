import { Injectable, Logger } from '@nestjs/common';
import { NotificationGateway, Notification } from './notification.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface CreateNotificationDto {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface QueryNotificationDto {
  page?: number;
  limit?: number;
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
  ): Promise<Notification> {
    const fullNotification: Notification = {
      id: uuidv4(),
      ...notification,
      timestamp: new Date(),
      read: false,
    };

    // Se tem entitySlug, só notificar usuários com permissão nessa entidade
    if (entitySlug) {
      await this.notifyUsersWithEntityAccess(tenantId, entitySlug, fullNotification);
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

      for (const user of users) {
        const roleType = user.customRole?.roleType;

        // PLATFORM_ADMIN e ADMIN recebem tudo
        if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') {
          this.gateway.sendToUser(user.id, notification);
          this.persistNotification(user.id, tenantId, notification, entitySlug);
          continue;
        }

        // Verificar permissoes da custom role
        if (user.customRole) {
          const permissions = user.customRole.permissions as unknown as Array<{
            entitySlug: string; canRead: boolean;
          }>;
          const hasAccess = permissions.some(
            (p) => p.entitySlug === entitySlug && p.canRead,
          );
          if (hasAccess) {
            this.gateway.sendToUser(user.id, notification);
            this.persistNotification(user.id, tenantId, notification, entitySlug);
          }
        } else {
          // Sem custom role: nao recebe (todos devem ter customRole agora)
        }
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
  ) {
    return this.notifyTenant(tenantId, {
      type: 'success',
      title: 'Novo Registro',
      message: `${createdBy} criou um novo registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, createdBy, entitySlug },
    }, entitySlug);
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
  ) {
    return this.notifyTenant(tenantId, {
      type: 'info',
      title: 'Registro Atualizado',
      message: `${updatedBy} atualizou um registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, updatedBy, entitySlug },
    }, entitySlug);
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
  ) {
    return this.notifyTenant(tenantId, {
      type: 'warning',
      title: 'Registro Excluído',
      message: `${deletedBy} excluiu um registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, deletedBy, entitySlug },
    }, entitySlug);
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
    const { page = 1, limit = 20, unreadOnly = false } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
      tenantId,
    };

    if (unreadOnly) {
      where.read = false;
    }

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
