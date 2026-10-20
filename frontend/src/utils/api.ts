import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('payd_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
);

const AUTH_TOKEN_KEY = 'payd_auth_token';
const LOGIN_PATH = '/login';

function handleUnauthorized(error: AxiosError) {
  if (error.response?.status !== 401) {
    return Promise.reject(error);
  }

  // Skip auth endpoints (login itself may legitimately return 401 for bad credentials).
  const requestUrl = error.config?.url ?? '';
  if (requestUrl.includes('/auth/')) {
    return Promise.reject(error);
  }

  const hadToken = Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
  localStorage.removeItem(AUTH_TOKEN_KEY);

  const currentPath = window.location.pathname;

  if (hadToken && currentPath !== LOGIN_PATH) {
    toast.error('Session expired, please log in again');
    window.location.assign(LOGIN_PATH);
  }

  return Promise.reject(error);
}

// Register the 401 handler on the shared axios instance.
api.interceptors.response.use((response) => response, handleUnauthorized);

// Also handle 401 globally for every bare `axios.*` call across the app so an
// expired session never surfaces as a silent spinner/empty table.
axios.interceptors.response.use((response) => response, handleUnauthorized);

export default api;

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export function createApiError(message: string, status?: number, code?: string): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Wrapper to ensure Promise rejection reasons are Error instances.
 */
export function safeReject<T>(reason: unknown): Promise<T> {
  let message: string;
  if (reason instanceof Error) {
    message = reason.message;
  } else if (typeof reason === 'object' && reason !== null) {
    message = JSON.stringify(reason);
  } else {
    message = String(reason);
  }
  return Promise.reject(reason instanceof Error ? reason : new Error(message));
}
