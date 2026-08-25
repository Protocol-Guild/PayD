import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export type InsightSeverity = 'info' | 'warning' | 'critical';
export type InsightCategory = 'payroll' | 'liquidity' | 'compliance' | 'workforce' | 'schedule';

export interface InsightCard {
  id: string;
  title: string;
  body: string;
  category: InsightCategory;
  severity: InsightSeverity;
  metric?: string;
  metricLabel?: string;
  actionLabel?: string;
  actionRoute?: string;
  generatedAt: string;
}

export interface InsightCardsResponse {
  cards: InsightCard[];
  generatedAt: string;
  windowDays: number;
}

function authHeaders() {
  const token = localStorage.getItem('payd_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export const getInsightCards = async (windowDays: number = 30): Promise<InsightCardsResponse> => {
  const { data } = await axios.get<{ success: boolean; data: InsightCardsResponse }>(
    `${API_BASE_URL}/insight-cards`,
    {
      params: { windowDays },
      headers: authHeaders(),
    }
  );
  return data.data;
};
