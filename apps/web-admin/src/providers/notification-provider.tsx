'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNotificationPrefs } from '@/components/notifications/notification-prefs-api';
import { api } from '@/lib/api';

interface StoredNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  data?: unknown;
}

const STORED_TYPES: Record<string, Notification['type']> = {
  INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error',
};

function fromStored(n: StoredNotification): Notification {
  return {
    id: n.id,
    type: STORED_TYPES[n.type] ?? 'info',
    title: n.title,
    message: n.message,
    timestamp: new Date(n.createdAt),
    read: n.read,
    data: n.data,
  };
}

/** Falha ao gravar leitura/remocao no servidor nao deve quebrar o sino. */
function ignoreError(): void {
  /* o estado local ja mudou; a proxima carga corrige */
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications deve ser usado dentro de NotificationProvider'
    );
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  console.log('🚀 [NotificationProvider] Componente renderizando');
  const { isAuthenticated } = useAuthStore();
  console.log('🔑 [NotificationProvider] isAuthenticated:', isAuthenticated);
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  // Preferencia "mostrar avisos na tela" (o aviso continua no sino).
  const { data: prefs } = useNotificationPrefs(isAuthenticated);
  const popupsRef = useRef(true);
  popupsRef.current = prefs?.popups ?? true;

  // Historico do sino: as notificacoes ficam no servidor (sobrevivem ao recarregar).
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    api.get<{ data: StoredNotification[] }>('/notifications', { params: { limit: 50 } })
      .then((res) => {
        if (cancelled) return;
        const stored = (res.data?.data ?? []).map(fromStored);
        setNotifications((prev) => {
          // O que chegou pelo socket enquanto carregava continua no topo.
          const ids = new Set(stored.map((n) => n.id));
          return [...prev.filter((n) => !ids.has(n.id)), ...stored].slice(0, 50);
        });
      })
      .catch(ignoreError);
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, reconnectTrigger]);

  // Conectar ao WebSocket quando autenticado
  useEffect(() => {
    console.log('[WebSocket] useEffect executado - isAuthenticated:', isAuthenticated);
    const accessToken = localStorage.getItem('accessToken');
    console.log('[WebSocket] accessToken existe:', !!accessToken);

    if (!isAuthenticated || !accessToken) {
      console.log('[WebSocket] Não conectando - isAuthenticated:', isAuthenticated, 'hasToken:', !!accessToken);
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    console.log('[WebSocket] Iniciando conexão em 500ms...');

    // Small delay to avoid connecting during transient auth state changes (login redirects)
    let cancelled = false;
    let newSocket: Socket | null = null;

    const timer = setTimeout(() => {
      if (cancelled) return;

      const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiUrl = (envUrl.startsWith('/') ? window.location.origin : envUrl).replace(/\/api\/v1\/?$/, '');
      console.log('[WebSocket] Criando conexão Socket.IO para:', `${apiUrl}/notifications`);

      newSocket = io(
        `${apiUrl}/notifications`,
        {
          auth: { token: accessToken },
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 2000,
          timeout: 10000,
        }
      );

      console.log('[WebSocket] Instância Socket.IO criada, aguardando eventos...');

      newSocket.on('connect', () => {
        console.log('🔌 Conectado ao WebSocket');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        if (!cancelled) {
          console.log('❌ Desconectado do WebSocket');
          setIsConnected(false);
        }
      });

      newSocket.on('connected', (data: unknown) => {
        console.log('✅ WebSocket autenticado:', data);
        // Backend já subscreve automaticamente ao tenant correto via JWT
      });

      newSocket.on('notification', (notification: Notification) => {
        console.log('📩 New notification:', notification);

        // Add to list
        setNotifications((prev) => [
          { ...notification, timestamp: new Date(notification.timestamp ?? Date.now()) },
          ...prev.filter((n) => n.id !== notification.id),
        ].slice(0, 50));

        // Mostrar toast (se a pessoa nao desligou os avisos na tela)
        const toastFn = !popupsRef.current ? () => undefined : {
          info: toast.info,
          success: toast.success,
          warning: toast.warning,
          error: toast.error,
        }[notification.type] || toast.info;

        toastFn(notification.title, {
          description: notification.message,
          duration: 5000,
        });

        // Emit custom event for data pages (fallback refresh since notifications don't carry record data)
        if (notification.data?.entitySlug) {
          window.dispatchEvent(
            new CustomEvent('entity-data-changed', {
              detail: { operation: 'refresh', entitySlug: notification.data.entitySlug },
            })
          );
        }
      });

      // Granular data-changed events (create/update/delete with record data)
      newSocket.on('data-changed', (payload: Record<string, unknown>) => {
        console.log('🔔 [WebSocket] Evento data-changed recebido do servidor:', payload);

        // Invalidate TanStack Query cache for dashboard widgets
        const entitySlug = payload.entitySlug as string | undefined;
        if (entitySlug) {
          console.log('🔄 [WebSocket] Invalidando cache de entity-stats para:', entitySlug);
          queryClient.invalidateQueries({
            queryKey: ['entity-stats'],
            // Apenas invalidar queries que contenham esse entitySlug
            predicate: (query) => {
              const key = query.queryKey as unknown[];
              return key.includes(entitySlug);
            }
          });
        }

        // Dispatch event for useEntityDataSource (table widget)
        window.dispatchEvent(
          new CustomEvent('entity-data-changed', { detail: payload })
        );
      });

      newSocket.on('connect_error', (error) => {
        console.warn('⚠️ WebSocket connection error:', error.message);
      });

      setSocket(newSocket);
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, reconnectTrigger]);

  // Handle tenant changes
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleTenantChange = () => {
      // TODOS reconectam WebSocket (JWT mudou para refletir novo tenant)
      console.log('🔄 Reconnecting WebSocket with new JWT...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      // Incrementar trigger para forçar reconexão
      setReconnectTrigger(prev => prev + 1);
    };

    // Listen for custom event dispatched when tenant selector changes
    window.addEventListener('tenant-changed', handleTenantChange);
    return () => window.removeEventListener('tenant-changed', handleTenantChange);
  }, [socket, isConnected]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    api.post(`/notifications/${id}/read`).catch(ignoreError);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.post('/notifications/read-all').catch(ignoreError);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    api.delete('/notifications').catch(ignoreError);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    api.delete(`/notifications/${id}`).catch(ignoreError);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
