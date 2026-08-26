/**
 * Webhook Delivery Health Report Types
 * 
 * Types for webhook delivery health reporting agent
 */

export interface WebhookDeliveryAttempt {
  id: string;
  subscriptionId: string;
  eventType: string;
  eventId?: string;
  attemptNumber: number;
  url: string;
  status: 'pending' | 'success' | 'failure' | 'retry_scheduled';
  httpStatus?: number;
  responseTimeMs?: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  nextRetryAt?: Date;
  requestId?: string;
  createdAt: Date;
}

export interface WebhookSubscriptionSummary {
  subscriptionId: string;
  url: string;
  events: string[];
  organizationId: number;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  pendingRetries: number;
  successRatePercent: number;
  avgResponseTimeMs?: number;
  firstAttempt: Date;
  lastAttempt: Date;
  mostCommonErrorCode?: string;
  recentFailures24h: number;
}

export interface WebhookEventTypeSummary {
  eventType: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRatePercent: number;
  avgResponseTimeMs?: number;
  subscriptionsCount: number;
}

export interface WebhookDeliveryHealthReport {
  // Report metadata
  reportId: string;
  organizationId: number;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  
  // Overall statistics
  overallStats: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    pendingRetries: number;
    overallSuccessRatePercent: number;
    avgResponseTimeMs?: number;
  };
  
  // Breakdowns
  bySubscription: WebhookSubscriptionSummary[];
  byEventType: WebhookEventTypeSummary[];
  
  // Failure analysis
  failurePatterns: {
    mostCommonErrorCodes: Array<{errorCode: string; count: number; percentage: number}>;
    recurringFailures: Array<{
      subscriptionId: string;
      url: string;
      errorCode: string;
      failureCount: number;
      lastFailure: Date;
    }>;
    timeoutFailures: number;
    networkErrorFailures: number;
    httpErrorFailures: number;
  };
  
  // Time-based trends
  hourlyTrends?: Array<{
    hour: string;
    attempts: number;
    successRatePercent: number;
    avgResponseTimeMs?: number;
  }>;
  
  // Recommendations
  recommendations: Array<{
    type: 'warning' | 'suggestion' | 'critical';
    message: string;
    action?: string;
  }>;
}

export interface WebhookHealthReportOptions {
  organizationId: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
  includeHourlyTrends?: boolean;
  maxSubscriptions?: number;
  maxEventTypes?: number;
}

export interface WebhookHealthReportService {
  generateReport(options: WebhookHealthReportOptions): Promise<WebhookDeliveryHealthReport>;
  getSubscriptionSummary(organizationId: number, subscriptionId: string, timeRange?: {start: Date; end: Date}): Promise<WebhookSubscriptionSummary>;
  getEventTypeSummary(organizationId: number, eventType: string, timeRange?: {start: Date; end: Date}): Promise<WebhookEventTypeSummary>;
}