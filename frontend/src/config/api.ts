import { resolveApiOrigin } from './apiOrigin';

export const API_ORIGIN = resolveApiOrigin(import.meta.env);
export const API_BASE_URL = `${API_ORIGIN}/api`;
export const API_V1_BASE_URL = `${API_ORIGIN}/api/v1`;
