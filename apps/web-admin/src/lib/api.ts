import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Detect if current page is a public link page
function isPublicContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/p/');
}

// Modelo B: o tenant é o 1º segmento depois do locale na URL (/{locale}/{tenant}/...).
// Segmentos não-tenant (auth/público) são ignorados.
const NON_TENANT_SEGMENTS = new Set(['login', 'register', 'forgot-password', 'reset-password', 'invite', 'security-setup', 'p', 'api', 'admin']);
function tenantSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const segs = window.location.pathname.split('/').filter(Boolean); // [locale, tenant?, ...]
  const seg = segs[1];
  if (seg && !NON_TENANT_SEGMENTS.has(seg)) return seg;
  return null;
}

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const tokenKey = isPublicContext() ? 'publicAccessToken' : 'accessToken';
    const token = localStorage.getItem(tokenKey);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Modelo B: tenant ativo vai como X-Tenant-Id (persistido -> sobrevive ao F5).
    // O backend resolve tenant+role via Membership a partir deste header.
    if (!isPublicContext()) {
      // Preferencial: tenant da URL (slug). Fallback: activeTenantId (localStorage).
      const slug = tenantSlugFromUrl();
      if (slug) {
        config.headers['X-Tenant-Slug'] = slug;
      }
      const activeTenantId = localStorage.getItem('activeTenantId');
      if (activeTenantId) {
        config.headers['X-Tenant-Id'] = activeTenantId;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Refresh queue (prevents concurrent refresh calls with one-time-use tokens) ---
let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach(({ resolve }) => resolve(newToken));
  refreshSubscribers = [];
}

function onRefreshFailed(error: unknown) {
  refreshSubscribers.forEach(({ reject }) => reject(error));
  refreshSubscribers = [];
}

function subscribeToRefresh(): Promise<string> {
  return new Promise((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject });
  });
}

// Sessao encerrada por empresa suspensa: as requests paralelas que ainda voltarem
// (401 sem token) nao podem disparar o redirect generico por cima do aviso.
let sessionEndedBySuspension = false;

// Auth endpoints that should NOT trigger token refresh on 401
const AUTH_ENDPOINTS = ['/auth/login', '/auth/login/mfa', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];
// Rotas publicas com token no caminho (convite): 401 e resposta do formulario, nao sessao vencida.
const PUBLIC_PREFIXES = ['/invitations/public/'];

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Empresa suspensa/cancelada pelo console da plataforma: encerra a sessao
    // (refresh nao resolve) e mostra o motivo na tela de login.
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === 'TENANT_SUSPENDED' &&
      !isPublicContext() &&
      typeof window !== 'undefined'
    ) {
      if (sessionEndedBySuspension) return Promise.reject(error);
      sessionEndedBySuspension = true;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('activeTenantId');
      const locale = window.location.pathname.split('/').filter(Boolean)[0] || 'pt-BR';
      window.location.href = `/${locale}/login?reason=suspended`;
      return Promise.reject(error);
    }

    if (sessionEndedBySuspension) return Promise.reject(error);

    // Empresa exige duas etapas e a pessoa nao ativou: leva para ativar (uma vez).
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === 'MFA_SETUP_REQUIRED' &&
      typeof window !== 'undefined' &&
      !window.location.pathname.includes('/security-setup')
    ) {
      const locale = window.location.pathname.split('/').filter(Boolean)[0] || 'pt-BR';
      window.location.href = `/${locale}/security-setup`;
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => url.endsWith(path)) || PUBLIC_PREFIXES.some((p) => url.includes(p));

    // Only attempt refresh for non-auth endpoints with 401 status
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      // If already refreshing, queue this request and wait
      if (isRefreshing) {
        try {
          const newToken = await subscribeToRefresh();
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      isRefreshing = true;

      try {
        const isPublic = isPublicContext();
        const refreshTokenKey = isPublic ? 'publicRefreshToken' : 'refreshToken';
        const accessTokenKey = isPublic ? 'publicAccessToken' : 'accessToken';

        const refreshToken = localStorage.getItem(refreshTokenKey);
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem(accessTokenKey, accessToken);
        localStorage.setItem(refreshTokenKey, newRefreshToken);

        isRefreshing = false;
        onTokenRefreshed(accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed(refreshError);

        // Clear tokens and redirect appropriately
        // isPublic recalculado aqui pois o do bloco try esta fora de escopo no catch
        const isPublic = isPublicContext();
        if (isPublic) {
          localStorage.removeItem('publicAccessToken');
          localStorage.removeItem('publicRefreshToken');

          // Redirect to public login page
          const match = window.location.pathname.match(/\/p\/([^/]+)/);
          if (match) {
            window.location.href = window.location.pathname.replace(/\/p\/([^/]+)\/.*/, '/p/$1');
            return Promise.reject(refreshError);
          }
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }

        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
