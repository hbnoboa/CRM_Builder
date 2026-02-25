import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios, { isAxiosError } from 'axios';
import type { User, AuthResponse, LoginCredentials, RegisterDate } from '@/types';
import api from '@/lib/api';
import { isTokenExpired } from '@/lib/jwt';

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

        // If access token exists and is not expired, fetch profile
        if (accessToken && !isTokenExpired(accessToken)) {
          try {
            const response = await api.get<User>('/auth/me');
            set({ user: response.data, isAuthenticated: true, isLoading: false });
            return 'ok';
          } catch (error) {
            if (isAxiosError(error) && error.response?.status === 401) {
              // Token rejected by server — fall through to refresh
            } else {
              // Network error — keep session optimistically
              set({ isLoading: false });
              return 'ok';
            }
          }
        }

        // Access token expired or rejected — try refresh directly (bypass interceptor)
        if (refreshToken) {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
            const response = await axios.post<AuthResponse>(`${API_URL}/auth/refresh`, {
              refreshToken,
            });
            const { user, accessToken: newAccess, refreshToken: newRefresh } = response.data;

            localStorage.setItem('accessToken', newAccess);
            localStorage.setItem('refreshToken', newRefresh);
            set({ user, isAuthenticated: true, isLoading: false });
            return 'ok';
          } catch {
            // Refresh failed — session is truly dead
          }
        }

        // All attempts failed — clean up and redirect
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, isAuthenticated: false, isLoading: false });
        return 'redirect';
      },

      switchTenant: async (tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/switch-tenant', { tenantId });
          const { user, accessToken, refreshToken } = response.data;

          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          set({ user, isLoading: false });

          // Notificar componentes que o tenant mudou
          window.dispatchEvent(new CustomEvent('tenant-changed'));
        } catch (error: unknown) {
          const message = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Failed to switch tenant'
            : 'Failed to switch tenant';
          set({ error: message, isLoading: false });
          throw error;
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
