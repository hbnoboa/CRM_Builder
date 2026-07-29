import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isAxiosError } from 'axios';
import type { User, AuthResponse, LoginCredentials, RegisterDate } from '@/types';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterDate) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
  ensureAuth: () => Promise<'ok' | 'redirect'>;
  switchTenant: (tenantId: string) => Promise<void>;
  impersonate: (targetUserId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/login', credentials);
          const { user, accessToken, refreshToken } = response.data;
          
          // Store tokens in localStorage
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          // Modelo B: tenant ativo inicial = tenant do usuario (persistido p/ F5)
          if (user?.tenantId) localStorage.setItem('activeTenantId', user.tenantId);

          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: unknown) {
          const message = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Login failed'
            : 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterDate) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/register', data);
          const { user, accessToken, refreshToken } = response.data;

          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: unknown) {
          const message = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Registration failed'
            : 'Registration failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          // Ignore logout errors
        } finally {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('activeTenantId');
          localStorage.removeItem('impersonationBackup');
          localStorage.removeItem('impersonatedBy');
          set({ user: null, isAuthenticated: false });
        }
      },

      getProfile: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await api.get<User>('/auth/me');
          set({ user: response.data, isAuthenticated: true, isLoading: false });
        } catch (error) {
          if (isAxiosError(error) && error.response?.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            set({ user: null, isAuthenticated: false, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        }
      },

      ensureAuth: async () => {
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');

        // No tokens at all — redirect immediately
        if (!accessToken && !refreshToken) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return 'redirect';
        }

        set({ isLoading: true });

        // Delega TODO refresh ao interceptor do `api` (single-flight unico, como o portal
        // do cliente do segmob). Mesmo com o access token expirado, GET /me retorna 401 e o
        // interceptor renova (com fila) e re-tenta. Isso evita o 2o caminho de refresh que
        // corria com o interceptor e causava logout sob rotacao (StrictMode/abas).
        try {
          const response = await api.get<User>('/auth/me');
          set({ user: response.data, isAuthenticated: true, isLoading: false });
          return 'ok';
        } catch (error) {
          // Erro de rede (sem resposta) e nao-401: mantem sessao otimisticamente.
          if (isAxiosError(error) && !error.response) {
            set({ isLoading: false });
            return 'ok';
          }
          // 401 mesmo apos o interceptor tentar renovar — sessao morta.
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set({ user: null, isAuthenticated: false, isLoading: false });
          return 'redirect';
        }
      },

      switchTenant: async (tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/switch-tenant', { tenantId });
          const { user, accessToken, refreshToken } = response.data;

          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          // Modelo B: persistir tenant ativo -> sobrevive ao F5 (enviado em X-Tenant-Id)
          localStorage.setItem('activeTenantId', user?.tenantId || tenantId);

          set({ user, isLoading: false });

          // Notificar componentes que o tenant mudou
          window.dispatchEvent(new CustomEvent('tenant-changed'));
        } catch (error: unknown) {
          console.error('Erro ao trocar tenant:', error);
          const message = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Failed to switch tenant'
            : 'Failed to switch tenant';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      impersonate: async (targetUserId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse & { impersonatedBy?: { id: string; name: string } }>(
            '/auth/impersonate',
            { targetUserId },
          );
          const { user, accessToken, refreshToken, impersonatedBy } = response.data;
          // Backup da sessao atual para poder voltar (stop).
          localStorage.setItem(
            'impersonationBackup',
            JSON.stringify({
              accessToken: localStorage.getItem('accessToken'),
              refreshToken: localStorage.getItem('refreshToken'),
              activeTenantId: localStorage.getItem('activeTenantId'),
            }),
          );
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          if (user?.tenantId) localStorage.setItem('activeTenantId', user.tenantId);
          if (impersonatedBy) localStorage.setItem('impersonatedBy', JSON.stringify(impersonatedBy));
          set({ user, isLoading: false });
          window.dispatchEvent(new CustomEvent('tenant-changed'));
        } catch (error: unknown) {
          const message = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Falha ao impersonar'
            : 'Falha ao impersonar';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      stopImpersonation: async () => {
        const raw = localStorage.getItem('impersonationBackup');
        if (raw) {
          try {
            const backup = JSON.parse(raw);
            if (backup.accessToken) localStorage.setItem('accessToken', backup.accessToken);
            if (backup.refreshToken) localStorage.setItem('refreshToken', backup.refreshToken);
            if (backup.activeTenantId) localStorage.setItem('activeTenantId', backup.activeTenantId);
            else localStorage.removeItem('activeTenantId');
          } catch {
            /* backup corrompido — segue limpando */
          }
        }
        localStorage.removeItem('impersonationBackup');
        localStorage.removeItem('impersonatedBy');
        try {
          const response = await api.get<User>('/auth/me');
          set({ user: response.data });
          window.dispatchEvent(new CustomEvent('tenant-changed'));
        } catch {
          /* ignore */
        }
      },

      setUser: (user: User) => set({ user }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      // Only persist auth flag - NOT user object (avoid PII in localStorage)
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
