import axios from 'axios';
// import Cookies from 'js-cookie';

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

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

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

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
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
