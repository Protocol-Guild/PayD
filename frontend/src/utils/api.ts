import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Guard against duplicate 401 redirects
let isRedirecting = false;

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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

// Add a response interceptor to handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      localStorage.removeItem('payd_auth_token');
      toast.error('Session expired, please log in again');
      // Short delay to let the toast render before redirecting
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }
    return Promise.reject(error);
  }
);

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