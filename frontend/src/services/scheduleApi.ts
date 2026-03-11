import axios from 'axios';

const rawApiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const API_BASE_URL = rawApiBaseUrl.replace(/\/api\/v1\/?$/, '/api').replace(/\/$/, '');

function authHeaders() {
  const token = localStorage.getItem('payd_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
}

export interface PaymentRecipient {
  walletAddress: string;
  amount: string;
  assetCode: string;
}

export interface PaymentConfig {
  recipients: PaymentRecipient[];
  memo?: string;
}

export interface CreateScheduleInput {
  frequency: 'once' | 'weekly' | 'biweekly' | 'monthly';
  timeOfDay: string;
  startDate: string;
  endDate?: string;
  paymentConfig: PaymentConfig;
}

export interface ScheduleRecord {
  id: number;
  frequency: string;
  timeOfDay: string;
  startDate: string;
  endDate?: string;
  nextRunTimestamp: string;
  lastRunTimestamp?: string;
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  paymentConfig: PaymentConfig;
  createdAt: string;
}

export interface CreateScheduleResponse {
  id: number;
  frequency: string;
  timeOfDay: string;
  startDate: string;
  endDate?: string;
  nextRunTimestamp: string;
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  createdAt: string;
}

export interface GetSchedulesResponse {
  schedules: ScheduleRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export const createSchedule = async (
  input: CreateScheduleInput
): Promise<CreateScheduleResponse> => {
  const { data } = await axios.post<CreateScheduleResponse>(`${API_BASE_URL}/schedules`, input, {
    headers: authHeaders(),
  });
  return data;
};

export const getSchedules = async (
  params: { status?: string; page?: number; limit?: number } = {}
): Promise<GetSchedulesResponse> => {
  const { data } = await axios.get<GetSchedulesResponse>(`${API_BASE_URL}/schedules`, {
    params,
    headers: authHeaders(),
  });
  return data;
};

export const deleteSchedule = async (id: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/schedules/${id}`, {
    headers: authHeaders(),
  });
};
