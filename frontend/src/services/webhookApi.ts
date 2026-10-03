import axios from 'axios';
import { API_ORIGIN } from '../config/api';

const WEBHOOKS_URL = `${API_ORIGIN}/webhooks`;

function authHeaders() {
  const token = localStorage.getItem('payd_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  organizationId: number;
}

export interface CreateWebhookSubscriptionInput {
  url: string;
  secret: string;
  events: string[];
}

export async function fetchWebhookSubscriptions(): Promise<WebhookSubscription[]> {
  const { data } = await axios.get<WebhookSubscription[]>(`${WEBHOOKS_URL}/subscriptions`, {
    headers: authHeaders(),
  });
  return data;
}

export async function createWebhookSubscription(
  input: CreateWebhookSubscriptionInput
): Promise<WebhookSubscription> {
  const { data } = await axios.post<WebhookSubscription>(`${WEBHOOKS_URL}/subscribe`, input, {
    headers: authHeaders(),
  });
  return data;
}

export async function deleteWebhookSubscription(id: string): Promise<void> {
  await axios.delete(`${WEBHOOKS_URL}/subscriptions/${id}`, {
    headers: authHeaders(),
  });
}
