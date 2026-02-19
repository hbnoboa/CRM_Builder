import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private connectedClients: Map<string, AuthenticatedSocket[]> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    // Configure Redis adapter for horizontal scaling
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      this.setupRedisAdapter(server, redisUrl);
    } else {
      this.logger.log('🔌 WebSocket Gateway initialized (no Redis URL configured, using in-memory adapter)');
    }
  }

  private async setupRedisAdapter(server: Server, redisUrl: string) {
    try {
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null; // Stop retrying after 3 attempts
          return Math.min(times * 200, 1000);
        },
        lazyConnect: true,
      });

      // Test the connection before using as adapter
      await pubClient.connect();
      await pubClient.ping();

      const subClient = pubClient.duplicate();
      await subClient.connect();

      pubClient.on('error', (err) => {
        this.logger.error('Redis pub client error:', err.message);
      });

      subClient.on('error', (err) => {
        this.logger.error('Redis sub client error:', err.message);
      });

      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('🔌 WebSocket Gateway initialized with Redis adapter');
    } catch (error) {
      this.logger.warn(`Redis unavailable (${(error as Error).message}), using in-memory adapter`);
      this.logger.log('🔌 WebSocket Gateway initialized (in-memory fallback)');
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extrair token do handshake
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('Conexão sem token - desconectando');
        client.disconnect();
        return;
      }

      // Verificar token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.userId = payload.sub;
      client.tenantId = payload.tenantId;

      // Adicionar cliente ao mapa
      if (!this.connectedClients.has(payload.sub)) {
        this.connectedClients.set(payload.sub, []);
      }
      this.connectedClients.get(payload.sub)!.push(client);

      // Entrar na sala do tenant
      client.join(`tenant:${payload.tenantId}`);
      client.join(`user:${payload.sub}`);

      this.logger.log(
        `✅ Cliente conectado: ${payload.sub} (${this.getConnectionCount()} total)`,
      );

      // Enviar confirmação
      client.emit('connected', {
        message: 'Conectado com sucesso',
        userId: payload.sub,
      });
    } catch (error) {
      this.logger.warn('Token inválido - desconectando cliente');
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userClients = this.connectedClients.get(client.userId);
      if (userClients) {
        const index = userClients.indexOf(client);
        if (index > -1) {
          userClients.splice(index, 1);
        }
        if (userClients.length === 0) {
          this.connectedClients.delete(client.userId);
        }
      }
      this.logger.log(
        `❌ Cliente desconectado: ${client.userId} (${this.getConnectionCount()} restantes)`,
      );
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channel: string },
  ) {
    client.join(data.channel);
    this.logger.log(`Cliente ${client.userId} inscrito em ${data.channel}`);
    return { event: 'subscribed', data: { channel: data.channel } };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channel: string },
  ) {
    client.leave(data.channel);
    this.logger.log(`Cliente ${client.userId} saiu de ${data.channel}`);
    return { event: 'unsubscribed', data: { channel: data.channel } };
  }

  // Métodos para enviar notificações

  /**
   * Enviar notificação para um usuário específico
   */
  sendToUser(userId: string, notification: Notification) {
    this.server.to(`user:${userId}`).emit('notification', notification);
    this.logger.log(`📤 Notificação enviada para usuário: ${userId}`);
  }

  /**
   * Enviar notificação para todos os usuários de um tenant
   */
  sendToTenant(tenantId: string, notification: Notification) {
    this.server.to(`tenant:${tenantId}`).emit('notification', notification);
    this.logger.log(`📤 Notificação enviada para tenant: ${tenantId}`);
  }

  /**
   * Enviar evento para um canal específico
   */
  sendToChannel(channel: string, event: string, data: any) {
    this.server.to(channel).emit(event, data);
  }

  /**
   * Emit lightweight data-changed event to all tenant users (no DB, no permissions).
   * Used for real-time UI refresh when entity data is created/updated/deleted.
   */
  emitDataChanged(tenantId: string, entitySlug: string) {
    this.server.to(`tenant:${tenantId}`).emit('data-changed', { entitySlug });
  }

  /**
   * Broadcast para todos os clientes conectados
   */
  broadcast(notification: Notification) {
    this.server.emit('notification', notification);
    this.logger.log(`📢 Broadcast enviado para todos`);
  }

  private getConnectionCount(): number {
    let count = 0;
    this.connectedClients.forEach((clients) => {
      count += clients.length;
    });
    return count;
  }

  /**
   * Verificar se um usuário está online
   */
  isUserOnline(userId: string): boolean {
    const clients = this.connectedClients.get(userId);
    return clients !== undefined && clients.length > 0;
  }

  /**
   * Obter lista de usuários online de um tenant
   */
  getOnlineUsers(tenantId: string): string[] {
    const onlineUsers: string[] = [];
    this.connectedClients.forEach((clients, userId) => {
      if (clients.some((c) => c.tenantId === tenantId)) {
        onlineUsers.push(userId);
      }
    });
    return onlineUsers;
  }
}
