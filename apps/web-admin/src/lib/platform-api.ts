import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Sessao da EQUIPE (console /admin). Chave propria: nunca se mistura com a
// sessao de usuario de tenant (accessToken/refreshToken) do mesmo navegador.
export const PLATFORM_TOKEN_KEY = 'platformAccessToken';

export function getPlatformToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setPlatformToken(token: string | null): void {
  if (token) localStorage.setItem(PLATFORM_TOKEN_KEY, token);
  else localStorage.removeItem(PLATFORM_TOKEN_KEY);
}

function adminLoginPath(): string {
  const locale = window.location.pathname.split('/').filter(Boolean)[0] || 'pt-BR';
  return `/${locale}/admin/login`;
}

export const platformApi = axios.create({
  baseURL: `${API_URL}/platform`,
  headers: { 'Content-Type': 'application/json' },
});

platformApi.interceptors.request.use((config) => {
  const token = getPlatformToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Sem refresh token: sessao da equipe expirou (8h) ou foi revogada -> login.
platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || '';
    if (error.response?.status === 401 && !url.endsWith('/auth/login') && typeof window !== 'undefined') {
      setPlatformToken(null);
      if (!window.location.pathname.endsWith('/admin/login')) {
        window.location.href = adminLoginPath();
      }
    }
    return Promise.reject(error);
  },
);
