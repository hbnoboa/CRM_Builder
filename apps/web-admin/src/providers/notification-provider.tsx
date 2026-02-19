'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

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
  const { isAuthenticated } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Conectar ao WebSocket quando autenticado
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!isAuthenticated || !accessToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Small delay to avoid connecting during transient auth state changes (login redirects)
    let cancelled = false;
    let newSocket: Socket | null = null;

    const timer = setTimeout(() => {
      if (cancelled) return;

      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/v1\/?$/, '');
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

        // PLATFORM_ADMIN: also join the selected tenant's room so we receive
        // data-changed events for the tenant we're currently browsing
        const selectedTenant = sessionStorage.getItem('selectedTenantId');
        if (selectedTenant) {
          newSocket!.emit('subscribe', { channel: `tenant:${selectedTenant}` });
          console.log('📡 Subscribed to tenant room:', selectedTenant);
        }
      });

      newSocket.on('notification', (notification: Notification) => {
        console.log('📩 New notification:', notification);

        // Add to list
        setNotifications((prev) => [notification, ...prev].slice(0, 50));

        // Mostrar toast
        const toastFn = {
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
  }, [isAuthenticated]);

  // PLATFORM_ADMIN: re-subscribe when selected tenant changes
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleTenantChange = () => {
      const selectedTenant = sessionStorage.getItem('selectedTenantId');
      if (selectedTenant) {
        socket.emit('subscribe', { channel: `tenant:${selectedTenant}` });
        console.log('📡 Tenant changed, subscribed to:', selectedTenant);
      }
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
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
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
