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
const NON_TENANT_SEGMENTS = new Set(['login', 'register', 'forgot-password', 'p', 'api']);
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

// Auth endpoints that should NOT trigger token refresh on 401
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh'];

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => url.endsWith(path));

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
