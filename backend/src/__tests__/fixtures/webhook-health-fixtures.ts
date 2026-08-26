/**
 * Webhook Health Report Fixtures
 * 
 * Test data for webhook delivery health report agent
 */

import { WebhookDeliveryHealthReport, WebhookSubscriptionSummary } from '../../services/types/webhook-health-report.types.js';

// Mock webhook subscriptions for organization 10
export const mockSubscriptions = [
  {
    id: 'sub_001',
    url: 'https://webhook.example.com/payments',
    secret: 'secret_001',
    events: ['payment.completed', 'payment.failed'],
    organizationId: 10,
  },
  {
    id: 'sub_002', 
    url: 'https://another-webhook.example.com/events',
    secret: 'secret_002',
    events: ['*'],
    organizationId: 10,
  },
  {
    id: 'sub_003',
    url: 'https://third-webhook.example.com/alerts',
    secret: 'secret_003',
    events: ['liquidity.insufficient', 'wallet.frozen'],
    organizationId: 10,
  },
];

// Mock delivery metrics data (simulating database records)
export const mockDeliveryMetrics = [
  // Subscription 1 - Mostly successful with some failures
  {
    id: 1,
    subscription_id: 'sub_001',
    event_type: 'payment.completed',
    attempt_number: 1,
    url: 'https://webhook.example.com/payments',
    status: 'success',
    http_status: 200,
    response_time_ms: 150,
    created_at: new Date('2026-08-20T10:00:00Z'),
  },
  {
    id: 2,
    subscription_id: 'sub_001',
    event_type: 'payment.completed',
    attempt_number: 1,
    url: 'https://webhook.example.com/payments',
    status: 'success',
    http_status: 200,
    response_time_ms: 120,
    created_at: new Date('2026-08-20T11:00:00Z'),
  },
  {
    id: 3,
    subscription_id: 'sub_001',
    event_type: 'payment.failed',
    attempt_number: 1,
    url: 'https://webhook.example.com/payments',
    status: 'failure',
    http_status: 500,
    response_time_ms: 300,
    error_code: 'SERVER_ERROR',
    error_message: 'Internal server error',
    retry_count: 1,
    created_at: new Date('2026-08-20T12:00:00Z'),
  },
  {
    id: 4,
    subscription_id: 'sub_001',
    event_type: 'payment.failed',
    attempt_number: 2,
    url: 'https://webhook.example.com/payments',
    status: 'success',
    http_status: 200,
    response_time_ms: 180,
    retry_count: 1,
    created_at: new Date('2026-08-20T12:05:00Z'),
  },
  
  // Subscription 2 - Perfect success rate
  {
    id: 5,
    subscription_id: 'sub_002',
    event_type: 'payment.completed',
    attempt_number: 1,
    url: 'https://another-webhook.example.com/events',
    status: 'success',
    http_status: 201,
    response_time_ms: 200,
    created_at: new Date('2026-08-21T09:00:00Z'),
  },
  {
    id: 6,
    subscription_id: 'sub_002',
    event_type: 'employee.created',
    attempt_number: 1,
    url: 'https://another-webhook.example.com/events',
    status: 'success',
    http_status: 200,
    response_time_ms: 180,
    created_at: new Date('2026-08-21T10:00:00Z'),
  },
  {
    id: 7,
    subscription_id: 'sub_002',
    event_type: 'wallet.activated',
    attempt_number: 1,
    url: 'https://another-webhook.example.com/events',
    status: 'success',
    http_status: 200,
    response_time_ms: 220,
    created_at: new Date('2026-08-21T11:00:00Z'),
  },
  
  // Subscription 3 - All failures with retries scheduled
  {
    id: 8,
    subscription_id: 'sub_003',
    event_type: 'liquidity.insufficient',
    attempt_number: 1,
    url: 'https://third-webhook.example.com/alerts',
    status: 'failure',
    http_status: 404,
    response_time_ms: 500,
    error_code: 'ENDPOINT_NOT_FOUND',
    error_message: 'Endpoint not found',
    retry_count: 2,
    next_retry_at: new Date('2026-08-22T10:00:00Z'),
    created_at: new Date('2026-08-22T09:00:00Z'),
  },
  {
    id: 9,
    subscription_id: 'sub_003',
    event_type: 'liquidity.insufficient',
    attempt_number: 2,
    url: 'https://third-webhook.example.com/alerts',
    status: 'failure',
    http_status: 404,
    response_time_ms: 520,
    error_code: 'ENDPOINT_NOT_FOUND',
    error_message: 'Endpoint not found',
    retry_count: 2,
    next_retry_at: new Date('2026-08-22T11:00:00Z'),
    created_at: new Date('2026-08-22T10:00:00Z'),
  },
  {
    id: 10,
    subscription_id: 'sub_003',
    event_type: 'wallet.frozen',
    attempt_number: 1,
    url: 'https://third-webhook.example.com/alerts',
    status: 'retry_scheduled',
    http_status: 503,
    response_time_ms: 1000,
    error_code: 'SERVICE_UNAVAILABLE',
    error_message: 'Service temporarily unavailable',
    retry_count: 1,
    next_retry_at: new Date('2026-08-22T12:00:00Z'),
    created_at: new Date('2026-08-22T11:30:00Z'),
  },
];

// Expected report output for organization 10 (last 7 days)
export const expectedHealthReport: WebhookDeliveryHealthReport = {
  reportId: 'test-report-001',
  organizationId: 10,
  generatedAt: new Date('2026-08-26T10:00:00Z'),
  timeRange: {
    start: new Date('2026-08-19T00:00:00Z'),
    end: new Date('2026-08-26T10:00:00Z'),
  },
  
  overallStats: {
    totalAttempts: 10,
    successfulAttempts: 6,
    failedAttempts: 3,
    pendingRetries: 1,
    overallSuccessRatePercent: 60.0,
    avgResponseTimeMs: 337,
  },
  
  bySubscription: [
    {
      subscriptionId: 'sub_001',
      url: 'https://webhook.example.com/payments',
      events: ['payment.completed', 'payment.failed'],
      organizationId: 10,
      totalAttempts: 4,
      successfulAttempts: 3,
      failedAttempts: 1,
      pendingRetries: 0,
      successRatePercent: 75.0,
      avgResponseTimeMs: 187.5,
      firstAttempt: new Date('2026-08-20T10:00:00Z'),
      lastAttempt: new Date('2026-08-20T12:05:00Z'),
      mostCommonErrorCode: 'SERVER_ERROR',
      recentFailures24h: 0,
    },
    {
      subscriptionId: 'sub_002',
      url: 'https://another-webhook.example.com/events',
      events: ['*'],
      organizationId: 10,
      totalAttempts: 3,
      successfulAttempts: 3,
      failedAttempts: 0,
      pendingRetries: 0,
      successRatePercent: 100.0,
      avgResponseTimeMs: 200,
      firstAttempt: new Date('2026-08-21T09:00:00Z'),
      lastAttempt: new Date('2026-08-21T11:00:00Z'),
      mostCommonErrorCode: undefined,
      recentFailures24h: 0,
    },
    {
      subscriptionId: 'sub_003',
      url: 'https://third-webhook.example.com/alerts',
      events: ['liquidity.insufficient', 'wallet.frozen'],
      organizationId: 10,
      totalAttempts: 3,
      successfulAttempts: 0,
      failedAttempts: 2,
      pendingRetries: 1,
      successRatePercent: 0.0,
      avgResponseTimeMs: 673.33,
      firstAttempt: new Date('2026-08-22T09:00:00Z'),
      lastAttempt: new Date('2026-08-22T11:30:00Z'),
      mostCommonErrorCode: 'ENDPOINT_NOT_FOUND',
      recentFailures24h: 3,
    },
  ],
  
  byEventType: [
    {
      eventType: 'payment.completed',
      totalAttempts: 3,
      successfulAttempts: 3,
      failedAttempts: 0,
      successRatePercent: 100.0,
      avgResponseTimeMs: 156.67,
      subscriptionsCount: 2,
    },
    {
      eventType: 'payment.failed',
      totalAttempts: 2,
      successfulAttempts: 1,
      failedAttempts: 1,
      successRatePercent: 50.0,
      avgResponseTimeMs: 240,
      subscriptionsCount: 1,
    },
    {
      eventType: 'employee.created',
      totalAttempts: 1,
      successfulAttempts: 1,
      failedAttempts: 0,
      successRatePercent: 100.0,
      avgResponseTimeMs: 180,
      subscriptionsCount: 1,
    },
    {
      eventType: 'wallet.activated',
      totalAttempts: 1,
      successfulAttempts: 1,
      failedAttempts: 0,
      successRatePercent: 100.0,
      avgResponseTimeMs: 220,
      subscriptionsCount: 1,
    },
    {
      eventType: 'liquidity.insufficient',
      totalAttempts: 2,
      successfulAttempts: 0,
      failedAttempts: 2,
      successRatePercent: 0.0,
      avgResponseTimeMs: 510,
      subscriptionsCount: 1,
    },
    {
      eventType: 'wallet.frozen',
      totalAttempts: 1,
      successfulAttempts: 0,
      failedAttempts: 0,
      pendingRetries: 1,
      successRatePercent: 0.0,
      avgResponseTimeMs: 1000,
      subscriptionsCount: 1,
    },
  ],
  
  failurePatterns: {
    mostCommonErrorCodes: [
      { errorCode: 'ENDPOINT_NOT_FOUND', count: 2, percentage: 66.67 },
      { errorCode: 'SERVER_ERROR', count: 1, percentage: 33.33 },
      { errorCode: 'SERVICE_UNAVAILABLE', count: 1, percentage: 33.33 },
    ],
    recurringFailures: [
      {
        subscriptionId: 'sub_003',
        url: 'https://third-webhook.example.com/alerts',
        errorCode: 'ENDPOINT_NOT_FOUND',
        failureCount: 2,
        lastFailure: new Date('2026-08-22T10:00:00Z'),
      },
    ],
    timeoutFailures: 0,
    networkErrorFailures: 0,
    httpErrorFailures: 4, // 404, 404, 500, 503
  },
  
  hourlyTrends: [
    {
      hour: '2026-08-20 10:00',
      attempts: 1,
      successRatePercent: 100.0,
      avgResponseTimeMs: 150,
    },
    {
      hour: '2026-08-20 11:00',
      attempts: 1,
      successRatePercent: 100.0,
      avgResponseTimeMs: 120,
    },
    {
      hour: '2026-08-20 12:00',
      attempts: 2,
      successRatePercent: 50.0,
      avgResponseTimeMs: 240,
    },
    {
      hour: '2026-08-21 09:00',
      attempts: 1,
      successRatePercent: 100.0,
      avgResponseTimeMs: 200,
    },
    {
      hour: '2026-08-21 10:00',
      attempts: 1,
      successRatePercent: 100.0,
      avgResponseTimeMs: 180,
    },
    {
      hour: '2026-08-21 11:00',
      attempts: 1,
      successRatePercent: 100.0,
      avgResponseTimeMs: 220,
    },
    {
      hour: '2026-08-22 09:00',
      attempts: 1,
      successRatePercent: 0.0,
      avgResponseTimeMs: 500,
    },
    {
      hour: '2026-08-22 10:00',
      attempts: 1,
      successRatePercent: 0.0,
      avgResponseTimeMs: 520,
    },
    {
      hour: '2026-08-22 11:30',
      attempts: 1,
      successRatePercent: 0.0,
      avgResponseTimeMs: 1000,
    },
  ],
  
  recommendations: [
    {
      type: 'critical',
      message: 'Subscription sub_003 has 0% success rate with recurring ENDPOINT_NOT_FOUND errors. Consider updating the webhook URL or investigating the endpoint.',
      action: 'Review webhook endpoint configuration for https://third-webhook.example.com/alerts',
    },
    {
      type: 'warning',
      message: 'Subscription sub_001 experienced a SERVER_ERROR (500) for payment.failed events. Monitor for recurrence.',
      action: 'Check webhook receiver service health',
    },
    {
      type: 'suggestion',
      message: 'Consider implementing exponential backoff for retries to reduce load on failing endpoints.',
      action: 'Update retry strategy configuration',
    },
  ],
};

// Helper function to calculate expected values for assertions
export function calculateExpectedValues(metrics: typeof mockDeliveryMetrics) {
  const totalAttempts = metrics.length;
  const successfulAttempts = metrics.filter(m => m.status === 'success').length;
  const failedAttempts = metrics.filter(m => m.status === 'failure').length;
  const pendingRetries = metrics.filter(m => m.status === 'retry_scheduled').length;
  const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;
  
  const responseTimes = metrics.filter(m => m.response_time_ms).map(m => m.response_time_ms!);
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
    : undefined;
    
  return {
    totalAttempts,
    successfulAttempts,
    failedAttempts,
    pendingRetries,
    successRate,
    avgResponseTime,
  };
}