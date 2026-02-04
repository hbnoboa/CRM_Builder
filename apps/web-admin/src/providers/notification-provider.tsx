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

    const newSocket = io(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/notifications`,
      {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }
    );

    newSocket.on('connect', () => {
      console.log('🔌 Conectado ao WebSocket');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Desconectado do WebSocket');
      setIsConnected(false);
    });

    newSocket.on('connected', (data) => {
      console.log('✅ WebSocket autenticado:', data);
    });

    newSocket.on('notification', (notification: Notification) => {
      console.log('📩 New notification:', notification);

      // Add to list
      setNotifications((prev) => [notification, ...prev].slice(0, 50)); // Keep last 50

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
    });

    newSocket.on('error', (error) => {
      console.error('⚠️ Error no WebSocket:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

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
