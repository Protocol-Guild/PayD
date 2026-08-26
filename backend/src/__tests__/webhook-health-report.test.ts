/**
 * Webhook Health Report Agent Tests
 * 
 * Tests for webhook delivery health report generation
 */

import { WebhookHealthReportService } from '../services/webhookHealthReportService.js';
import { 
  mockDeliveryMetrics, 
  mockSubscriptions,
  expectedHealthReport,
  calculateExpectedValues 
} from './fixtures/webhook-health-fixtures.js';

// Mock database queries
jest.mock('../config/database.js', () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock webhook service
jest.mock('../services/webhook.service.js', () => ({
  WebhookService: {
    listSubscriptions: jest.fn(),
  },
}));

import { pool } from '../config/database.js';
import { WebhookService } from '../services/webhook.service.js';

const mockedPool = pool as jest.Mocked<typeof pool>;
const mockedWebhookService = WebhookService as jest.Mocked<typeof WebhookService>;

describe('WebhookHealthReportService', () => {
  let service: WebhookHealthReportService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookHealthReportService();
    
    // Setup default mocks
    mockedWebhookService.listSubscriptions.mockResolvedValue(mockSubscriptions);
  });
  
  describe('generateReport', () => {
    it('should generate correct health report for organization', async () => {
      // Mock database queries
      mockedPool.query.mockImplementation(async (query: string, params: any[]) => {
        // Mock delivery metrics query
        if (query.includes('webhook_delivery_metrics') && query.includes('COUNT')) {
          return {
            rows: [{ 
              total_attempts: '10', 
              successful_attempts: '6', 
              failed_attempts: '3',
              pending_retries: '1',
              avg_response_time_ms: '337'
            }],
          };
        }
        
        // Mock subscription summary query
        if (query.includes('webhook_delivery_health_summary')) {
          return {
            rows: mockDeliveryMetrics.map(m => ({
              subscription_id: m.subscription_id,
              url: m.url,
              event_type: m.event_type,
              total_attempts: '1',
              successful_attempts: m.status === 'success' ? '1' : '0',
              failed_attempts: m.status === 'failure' ? '1' : '0',
              pending_retries: m.status === 'retry_scheduled' ? '1' : '0',
              avg_response_time_ms: m.response_time_ms?.toString(),
              first_attempt: m.created_at,
              last_attempt: m.created_at,
              success_rate_percent: m.status === 'success' ? '100' : '0',
              most_common_error_code: m.error_code,
              recent_failures_24h: m.status === 'failure' ? '1' : '0',
            })),
          };
        }
        
        // Mock error analysis query
        if (query.includes('error_code') && query.includes('GROUP BY')) {
          return {
            rows: [
              { error_code: 'ENDPOINT_NOT_FOUND', count: '2' },
              { error_code: 'SERVER_ERROR', count: '1' },
              { error_code: 'SERVICE_UNAVAILABLE', count: '1' },
            ],
          };
        }
        
        // Mock hourly trends query
        if (query.includes('DATE_TRUNC')) {
          return {
            rows: expectedHealthReport.hourlyTrends!.map(t => ({
              hour: t.hour,
              attempts: t.attempts,
              success_rate_percent: t.successRatePercent,
              avg_response_time_ms: t.avgResponseTimeMs,
            })),
          };
        }
        
        return { rows: [] };
      });
      
      const report = await service.generateReport({
        organizationId: 10,
        timeRange: {
          start: new Date('2026-08-19T00:00:00Z'),
          end: new Date('2026-08-26T10:00:00Z'),
        },
        includeHourlyTrends: true,
      });
      
      // Verify overall structure
      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('organizationId', 10);
      expect(report).toHaveProperty('overallStats');
      expect(report).toHaveProperty('bySubscription');
      expect(report).toHaveProperty('byEventType');
      expect(report).toHaveProperty('failurePatterns');
      expect(report).toHaveProperty('recommendations');
      
      // Verify overall statistics
      const expectedValues = calculateExpectedValues(mockDeliveryMetrics);
      expect(report.overallStats.totalAttempts).toBe(expectedValues.totalAttempts);
      expect(report.overallStats.successfulAttempts).toBe(expectedValues.successfulAttempts);
      expect(report.overallStats.failedAttempts).toBe(expectedValues.failedAttempts);
      expect(report.overallStats.successRatePercent).toBeCloseTo(expectedValues.successRate, 1);
      
      // Verify subscription breakdown has correct count
      expect(report.bySubscription).toHaveLength(mockSubscriptions.length);
      
      // Verify event type breakdown
      const uniqueEventTypes = [...new Set(mockDeliveryMetrics.map(m => m.event_type))];
      expect(report.byEventType).toHaveLength(uniqueEventTypes.length);
      
      // Verify failure patterns
      expect(report.failurePatterns.mostCommonErrorCodes).toHaveLength(3);
      expect(report.failurePatterns.recurringFailures.length).toBeGreaterThan(0);
      
      // Verify recommendations based on failure patterns
      expect(report.recommendations.length).toBeGreaterThan(0);
      const criticalRecs = report.recommendations.filter(r => r.type === 'critical');
      expect(criticalRecs.length).toBeGreaterThan(0);
    });
    
    it('should handle empty data gracefully', async () => {
      mockedPool.query.mockResolvedValue({ rows: [] });
      mockedWebhookService.listSubscriptions.mockResolvedValue([]);
      
      const report = await service.generateReport({
        organizationId: 999, // Non-existent organization
        timeRange: {
          start: new Date('2026-08-19T00:00:00Z'),
          end: new Date('2026-08-26T10:00:00Z'),
        },
      });
      
      expect(report.overallStats.totalAttempts).toBe(0);
      expect(report.overallStats.successRatePercent).toBe(0);
      expect(report.bySubscription).toHaveLength(0);
      expect(report.byEventType).toHaveLength(0);
      expect(report.failurePatterns.mostCommonErrorCodes).toHaveLength(0);
      expect(report.failurePatterns.recurringFailures).toHaveLength(0);
      expect(report.recommendations).toHaveLength(0);
    });
    
    it('should respect time range parameters', async () => {
      const startDate = new Date('2026-08-25T00:00:00Z');
      const endDate = new Date('2026-08-26T00:00:00Z');
      
      const report = await service.generateReport({
        organizationId: 10,
        timeRange: { start: startDate, end: endDate },
      });
      
      // Verify time range in report
      expect(report.timeRange.start).toEqual(startDate);
      expect(report.timeRange.end).toEqual(endDate);
      
      // Verify database was queried with correct date range
      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining('BETWEEN'),
        expect.arrayContaining([10, startDate, endDate])
      );
    });
    
    it('should exclude hourly trends when not requested', async () => {
      mockedPool.query.mockResolvedValue({ rows: [] });
      
      const report = await service.generateReport({
        organizationId: 10,
        includeHourlyTrends: false,
      });
      
      expect(report.hourlyTrends).toBeUndefined();
    });
  });
  
  describe('getSubscriptionSummary', () => {
    it('should return detailed summary for specific subscription', async () => {
      const subscriptionId = 'sub_001';
      
      // Mock metrics for specific subscription
      const subMetrics = mockDeliveryMetrics.filter(m => m.subscription_id === subscriptionId);
      mockedPool.query.mockResolvedValue({
        rows: subMetrics.map(m => ({
          subscription_id: m.subscription_id,
          url: m.url,
          total_attempts: '1',
          successful_attempts: m.status === 'success' ? '1' : '0',
          failed_attempts: m.status === 'failure' ? '1' : '0',
          pending_retries: m.status === 'retry_scheduled' ? '1' : '0',
          avg_response_time_ms: m.response_time_ms?.toString(),
          first_attempt: m.created_at,
          last_attempt: m.created_at,
          success_rate_percent: m.status === 'success' ? '100' : '0',
          most_common_error_code: m.error_code,
          recent_failures_24h: m.status === 'failure' ? '1' : '0',
        })),
      });
      
      mockedWebhookService.listSubscriptions.mockResolvedValue(
        mockSubscriptions.filter(s => s.id === subscriptionId)
      );
      
      const summary = await service.getSubscriptionSummary(
        10,
        subscriptionId,
        {
          start: new Date('2026-08-19T00:00:00Z'),
          end: new Date('2026-08-26T10:00:00Z'),
        }
      );
      
      expect(summary.subscriptionId).toBe(subscriptionId);
      expect(summary.totalAttempts).toBe(subMetrics.length);
      expect(summary.successfulAttempts).toBe(subMetrics.filter(m => m.status === 'success').length);
      expect(summary.failedAttempts).toBe(subMetrics.filter(m => m.status === 'failure').length);
      
      const subscription = mockSubscriptions.find(s => s.id === subscriptionId)!;
      expect(summary.events).toEqual(subscription.events);
      expect(summary.url).toBe(subscription.url);
    });
  });
  
  describe('getEventTypeSummary', () => {
    it('should return summary for specific event type', async () => {
      const eventType = 'payment.completed';
      
      // Mock metrics for specific event type
      const eventMetrics = mockDeliveryMetrics.filter(m => m.event_type === eventType);
      mockedPool.query.mockResolvedValue({
        rows: [{
          event_type: eventType,
          total_attempts: eventMetrics.length.toString(),
          successful_attempts: eventMetrics.filter(m => m.status === 'success').length.toString(),
          failed_attempts: eventMetrics.filter(m => m.status === 'failure').length.toString(),
          avg_response_time_ms: '156.67',
          subscriptions_count: '2',
        }],
      });
      
      const summary = await service.getEventTypeSummary(
        10,
        eventType,
        {
          start: new Date('2026-08-19T00:00:00Z'),
          end: new Date('2026-08-26T10:00:00Z'),
        }
      );
      
      expect(summary.eventType).toBe(eventType);
      expect(summary.totalAttempts).toBe(eventMetrics.length);
      expect(summary.successfulAttempts).toBe(eventMetrics.filter(m => m.status === 'success').length);
      expect(summary.subscriptionsCount).toBeGreaterThan(0);
    });
  });
  
  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockedPool.query.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(
        service.generateReport({ organizationId: 10 })
      ).rejects.toThrow('Failed to generate webhook health report');
    });
    
    it('should handle missing subscriptions gracefully', async () => {
      mockedWebhookService.listSubscriptions.mockResolvedValue([]);
      mockedPool.query.mockResolvedValue({ rows: [] });
      
      const report = await service.generateReport({ organizationId: 10 });
      
      expect(report.bySubscription).toHaveLength(0);
      expect(report.recommendations).toHaveLength(0);
    });
  });
});