import api from '../utils/api';

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

export interface GetSchedulesResponse {
  schedules: ScheduleRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export const createSchedule = async (input: CreateScheduleInput): Promise<ScheduleRecord> => {
  const { data } = await api.post<ScheduleRecord>('/v1/schedules', input);
  return data;
};

export const getSchedules = async (
  params: { status?: string; page?: number; limit?: number } = {}
): Promise<GetSchedulesResponse> => {
  const { data } = await api.get<GetSchedulesResponse>('/v1/schedules', {
    params,
  });
  return data;
};

export const deleteSchedule = async (id: number): Promise<void> => {
  await api.delete(`/v1/schedules/${id}`);
};
