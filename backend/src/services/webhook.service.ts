import axios from 'axios';
import CryptoJS from 'crypto-js';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export interface WebhookSubscription {
  id: string;
  url: string;
  secret: string;
  events: string[];
  organizationId: number;
}

// In-memory storage for demonstration (in a real app, this would be a database)
const subscriptions: WebhookSubscription[] = [];

export class WebhookService {
  static async subscribe(
    organizationId: number,
    url: string,
    secret: string,
    events: string[]
  ): Promise<WebhookSubscription> {
    const subscription: WebhookSubscription = {
      id: Math.random().toString(36).substring(2, 11),
      url,
      secret,
      events,
      organizationId,
    };
    subscriptions.push(subscription);
    return subscription;
  }

  static listSubscriptions(organizationId: number): WebhookSubscription[] {
    return subscriptions.filter((s) => s.organizationId === organizationId);
  }

  static deleteSubscription(id: string, organizationId: number): boolean {
    const index = subscriptions.findIndex(
      (s) => s.id === id && s.organizationId === organizationId
    );
    if (index !== -1) {
      subscriptions.splice(index, 1);
      return true;
    }
    return false;
  }

  static async dispatch(eventType: string, payload: any): Promise<void> {
    const relevantSubscriptions = subscriptions.filter(
      (s) => s.events.includes(eventType) || s.events.includes('*')
    );

    const dispatchPromises = relevantSubscriptions.map(async (sub) => {
      const timestamp = Date.now().toString();
      const payloadString = JSON.stringify(payload);
      const signature = this.generateSignature(payloadString, sub.secret, timestamp);

      try {
        const startTime = Date.now();
        await this.sendWithRetry(sub, eventType, payload, {
          'X-PayD-Event': eventType,
          'X-PayD-Signature': signature,
          'X-PayD-Timestamp': timestamp,
        });
        const responseTime = Date.now() - startTime;
        
        // Record successful delivery
        await this.recordDeliveryAttempt({
          organizationId: sub.organizationId,
          subscriptionId: sub.id,
          eventType,
          eventId: payload.id,
          url: sub.url,
          status: 'success',
          httpStatus: 200,
          responseTimeMs: responseTime,
          attemptNumber: 1,
        });
        
        logger.info(`Webhook dispatched successfully to ${sub.url}`, { 
          eventType, 
          subscriptionId: sub.id,
          organizationId: sub.organizationId,
          responseTime 
        });
      } catch (error: any) {
        // Record failed delivery
        await this.recordDeliveryAttempt({
          organizationId: sub.organizationId,
          subscriptionId: sub.id,
          eventType,
          eventId: payload.id,
          url: sub.url,
          status: 'failure',
          httpStatus: error.response?.status || 0,
          responseTimeMs: Date.now() - Date.now(), // Would need actual timing
          errorCode: this.extractErrorCode(error),
          errorMessage: error.message,
          errorDetails: {
            response: error.response?.data,
            stack: error.stack,
          },
          attemptNumber: 1,
          retryCount: 0,
        });
        
        logger.error(`Failed to dispatch webhook to ${sub.url}:`, { 
          error: error.message, 
          eventType, 
          subscriptionId: sub.id,
          organizationId: sub.organizationId 
        });
      }
    });

    await Promise.allSettled(dispatchPromises);
  }

  private static async sendWithRetry(
    subscription: WebhookSubscription,
    eventType: string,
    data: any,
    headers: any,
    retries = 3,
    delay = 1000,
    attemptNumber = 1
  ): Promise<void> {
    try {
      const startTime = Date.now();
      const response = await axios.post(subscription.url, data, { 
        headers, 
        timeout: 5000 
      });
      const responseTime = Date.now() - startTime;
      
      if (response.status >= 200 && response.status < 300) {
        // Success
        return;
      } else {
        // HTTP error (4xx, 5xx)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      if (retries > 0) {
        // Record retry attempt
        await this.recordDeliveryAttempt({
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          eventType,
          url: subscription.url,
          status: 'retry_scheduled',
          httpStatus: error.response?.status || 0,
          responseTimeMs: Date.now() - Date.now(),
          errorCode: this.extractErrorCode(error),
          errorMessage: error.message,
          attemptNumber,
          retryCount: retries - 1,
          nextRetryAt: new Date(Date.now() + delay),
        });
        
        logger.warn(`Retrying webhook to ${subscription.url} (${retries} attempts left)...`, {
          eventType,
          subscriptionId: subscription.id,
          attemptNumber,
          delay
        });
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWithRetry(
          subscription, 
          eventType, 
          data, 
          headers, 
          retries - 1, 
          delay * 2,
          attemptNumber + 1
        );
      }
      
      // Final failure after all retries
      throw error;
    }
  }

  private static generateSignature(payload: string, secret: string, timestamp: string): string {
    const message = `${timestamp}.${payload}`;
    return CryptoJS.HmacSHA256(message, secret).toString(CryptoJS.enc.Hex);
  }

  private static extractErrorCode(error: any): string {
    if (error.code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
    if (error.code === 'ETIMEDOUT') return 'TIMEOUT';
    if (error.code === 'ENOTFOUND') return 'DNS_ERROR';
    if (error.response?.status === 404) return 'ENDPOINT_NOT_FOUND';
    if (error.response?.status === 500) return 'SERVER_ERROR';
    if (error.response?.status === 503) return 'SERVICE_UNAVAILABLE';
    if (error.response?.status === 429) return 'RATE_LIMITED';
    return 'UNKNOWN_ERROR';
  }

  private static async recordDeliveryAttempt(params: {
    organizationId: number;
    subscriptionId: string;
    eventType: string;
    eventId?: string;
    url: string;
    status: 'pending' | 'success' | 'failure' | 'retry_scheduled';
    httpStatus?: number;
    responseTimeMs?: number;
    errorCode?: string;
    errorMessage?: string;
    errorDetails?: Record<string, any>;
    attemptNumber: number;
    retryCount?: number;
    nextRetryAt?: Date;
    requestId?: string;
  }): Promise<void> {
    try {
      await pool.query(
        `SELECT log_webhook_delivery(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )`,
        [
          params.organizationId,
          params.subscriptionId,
          params.eventType,
          params.eventId,
          params.attemptNumber,
          params.url,
          params.status,
          params.httpStatus,
          params.responseTimeMs,
          params.errorCode,
          params.errorMessage,
          params.errorDetails ? JSON.stringify(params.errorDetails) : '{}',
          params.retryCount || 0,
          params.nextRetryAt,
          params.requestId,
          '{}', // metadata
        ]
      );
    } catch (error) {
      logger.error('Failed to record webhook delivery attempt', { 
        error, 
        subscriptionId: params.subscriptionId,
        organizationId: params.organizationId 
      });
    }
  }
}
