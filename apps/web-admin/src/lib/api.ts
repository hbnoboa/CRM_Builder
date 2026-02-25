import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token + tenant context
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Auto-inject tenantId for PLATFORM_ADMIN cross-tenant browsing
    if (typeof window !== 'undefined') {
      const selectedTenantId = sessionStorage.getItem('selectedTenantId');
      if (selectedTenantId) {
        // Query param (for GET, DELETE, and backend @Query('tenantId'))
        if (!config.params?.tenantId) {
          config.params = { ...config.params, tenantId: selectedTenantId };
        }
        // Body (for POST, PUT, PATCH — backend reads dto.tenantId)
        const method = config.method?.toLowerCase();
        if (method === 'post' || method === 'put' || method === 'patch') {
          if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
            if (!config.data.tenantId) {
              config.data = { ...config.data, tenantId: selectedTenantId };
            }
          } else if (!config.data) {
            config.data = { tenantId: selectedTenantId };
          }
        }
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
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        isRefreshing = false;
        onTokenRefreshed(accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed(refreshError);

        // Clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
