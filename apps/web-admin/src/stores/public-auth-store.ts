'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios, { isAxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface PublicUser {
  id: string;
  name: string;
  email: string;
  cpf?: string | null;
  phone?: string | null;
  tenantId: string;
}

interface PublicAuthState {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  slug: string | null;

  setSlug: (slug: string) => void;
  register: (slug: string, data: {
    name: string;
    email: string;
    password: string;
    cpf?: string;
    cnpj?: string;
    phone?: string;
  }) => Promise<void>;
  login: (slug: string, data: {
    identifier: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  getAccessToken: () => string | null;
}

export const usePublicAuthStore = create<PublicAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      slug: null,

      setSlug: (slug: string) => set({ slug }),

      register: async (slug, data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(`${API_URL}/p/${slug}/register`, data);
          const { user, accessToken, refreshToken } = response.data;

          // Store only as public tokens — api.ts detects public pages and reads these
          localStorage.setItem('publicAccessToken', accessToken);
          localStorage.setItem('publicRefreshToken', refreshToken);

          set({ user, isAuthenticated: true, isLoading: false, slug });
        } catch (error: unknown) {
          const message = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Erro ao registrar'
            : 'Erro ao registrar';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      login: async (slug, data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(`${API_URL}/p/${slug}/login`, data);
          const { user, accessToken, refreshToken } = response.data;

          // Store only as public tokens — api.ts detects public pages and reads these
          localStorage.setItem('publicAccessToken', accessToken);
          localStorage.setItem('publicRefreshToken', refreshToken);

          set({ user, isAuthenticated: true, isLoading: false, slug });
        } catch (error: unknown) {
          const message = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Erro ao entrar'
            : 'Erro ao entrar';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('publicAccessToken');
        localStorage.removeItem('publicRefreshToken');
        set({ user: null, isAuthenticated: false, slug: null });
      },

      clearError: () => set({ error: null }),

      getAccessToken: () => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('publicAccessToken');
      },
    }),
    {
      name: 'public-auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        slug: state.slug,
        user: state.user,
      }),
    },
  ),
);
