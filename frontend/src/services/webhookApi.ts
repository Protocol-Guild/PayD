import api from '../utils/api';
import { API_ROOT_URL } from '../utils/api';

const WEBHOOKS_URL = API_ROOT_URL + '/webhooks';

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
  const { data } = await api.get<WebhookSubscription[]>(`${WEBHOOKS_URL}/subscriptions`);
  return data;
}

export async function createWebhookSubscription(
  input: CreateWebhookSubscriptionInput
): Promise<WebhookSubscription> {
  const { data } = await api.post<WebhookSubscription>(`${WEBHOOKS_URL}/subscribe`, input);
  return data;
}

export async function deleteWebhookSubscription(id: string): Promise<void> {
  await api.delete(`${WEBHOOKS_URL}/subscriptions/${id}`);
}
