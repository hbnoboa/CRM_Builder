import { Injectable, Logger } from '@nestjs/common';
import { NotificationGateway, Notification } from './notification.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateNotificationDto {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
}

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
  ): Promise<Notification> {
    const fullNotification: Notification = {
      id: uuidv4(),
      ...notification,
      timestamp: new Date(),
      read: false,
    };

    // Enviar via WebSocket
    this.gateway.sendToUser(userId, fullNotification);

    // Salvar no banco de dados se necessário
    // await this.saveNotification(userId, fullNotification);

    return fullNotification;
  }

  /**
   * Notificar todos os usuários de um tenant
   */
  async notifyTenant(
    tenantId: string,
    notification: CreateNotificationDto,
  ): Promise<Notification> {
    const fullNotification: Notification = {
      id: uuidv4(),
      ...notification,
      timestamp: new Date(),
      read: false,
    };

    this.gateway.sendToTenant(tenantId, fullNotification);

    return fullNotification;
  }

  /**
   * Notificar todos os usuários de uma organização
   */
  async notifyOrganization(
    organizationId: string,
    notification: CreateNotificationDto,
  ): Promise<Notification> {
    const fullNotification: Notification = {
      id: uuidv4(),
      ...notification,
      timestamp: new Date(),
      read: false,
    };

    this.gateway.sendToOrganization(organizationId, fullNotification);

    return fullNotification;
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
  ) {
    return this.notifyTenant(tenantId, {
      type: 'success',
      title: 'Novo Registro',
      message: `${createdBy} criou um novo registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, createdBy },
    });
  }

  /**
   * Notificar sobre atualização de registro
   */
  async notifyRecordUpdated(
    tenantId: string,
    entityName: string,
    recordName: string,
    updatedBy: string,
  ) {
    return this.notifyTenant(tenantId, {
      type: 'info',
      title: 'Registro Atualizado',
      message: `${updatedBy} atualizou um registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, updatedBy },
    });
  }

  /**
   * Notificar sobre exclusão de registro
   */
  async notifyRecordDeleted(
    tenantId: string,
    entityName: string,
    recordName: string,
    deletedBy: string,
  ) {
    return this.notifyTenant(tenantId, {
      type: 'warning',
      title: 'Registro Excluído',
      message: `${deletedBy} excluiu um registro em ${entityName}: ${recordName}`,
      data: { entityName, recordName, deletedBy },
    });
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
}
