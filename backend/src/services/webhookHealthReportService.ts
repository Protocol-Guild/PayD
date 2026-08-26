/**
 * Webhook Health Report Service
 * 
 * Service for generating webhook delivery health reports
 */

import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { WebhookService } from './webhook.service.js';
import {
  WebhookDeliveryHealthReport,
  WebhookHealthReportOptions,
  WebhookSubscriptionSummary,
  WebhookEventTypeSummary,
} from './types/webhook-health-report.types.js';

export class WebhookHealthReportService {
  /**
   * Generate a comprehensive webhook delivery health report
   */
  async generateReport(options: WebhookHealthReportOptions): Promise<WebhookDeliveryHealthReport> {
    try {
      const {
        organizationId,
        timeRange = this.getDefaultTimeRange(),
        includeHourlyTrends = false,
        maxSubscriptions = 50,
        maxEventTypes = 20,
      } = options;

      logger.info('Generating webhook health report', { 
        organizationId, 
        timeRange,
        includeHourlyTrends 
      });

      // Fetch subscriptions for the organization
      const subscriptions = await WebhookService.listSubscriptions(organizationId);

      // Generate report ID
      const reportId = `whr_${organizationId}_${Date.now()}`;

      // Get overall statistics
      const overallStats = await this.getOverallStats(organizationId, timeRange);

      // Get subscription breakdown
      const bySubscription = await this.getSubscriptionBreakdown(
        organizationId, 
        subscriptions, 
        timeRange, 
        maxSubscriptions
      );

      // Get event type breakdown
      const byEventType = await this.getEventTypeBreakdown(
        organizationId, 
        timeRange, 
        maxEventTypes
      );

      // Analyze failure patterns
      const failurePatterns = await this.analyzeFailurePatterns(
        organizationId, 
        timeRange
      );

      // Generate recommendations based on data
      const recommendations = this.generateRecommendations(
        bySubscription,
        byEventType,
        failurePatterns
      );

      // Get hourly trends if requested
      const hourlyTrends = includeHourlyTrends
        ? await this.getHourlyTrends(organizationId, timeRange)
        : undefined;

      const report: WebhookDeliveryHealthReport = {
        reportId,
        organizationId,
        generatedAt: new Date(),
        timeRange,
        overallStats,
        bySubscription,
        byEventType,
        failurePatterns,
        recommendations,
        hourlyTrends,
      };

      logger.info('Webhook health report generated successfully', { 
        reportId, 
        organizationId,
        overallStats 
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate webhook health report', { 
        error, 
        organizationId: options.organizationId 
      });
      throw new Error(`Failed to generate webhook health report: ${error.message}`);
    }
  }

  /**
   * Get detailed summary for a specific subscription
   */
  async getSubscriptionSummary(
    organizationId: number,
    subscriptionId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<WebhookSubscriptionSummary> {
    try {
      const range = timeRange || this.getDefaultTimeRange();
      
      // Get subscription details
      const subscriptions = await WebhookService.listSubscriptions(organizationId);
      const subscription = subscriptions.find(s => s.id === subscriptionId);
      
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found for organization ${organizationId}`);
      }

      // Get subscription metrics
      const result = await pool.query(
        `SELECT * FROM webhook_delivery_health_summary
         WHERE organization_id = $1 AND subscription_id = $2
         AND last_attempt >= $3`,
        [organizationId, subscriptionId, range.start]
      );

      if (result.rows.length === 0) {
        // Return empty summary if no metrics found
        return {
          subscriptionId,
          url: subscription.url,
          events: subscription.events,
          organizationId,
          totalAttempts: 0,
          successfulAttempts: 0,
          failedAttempts: 0,
          pendingRetries: 0,
          successRatePercent: 0,
          avgResponseTimeMs: undefined,
          firstAttempt: new Date(),
          lastAttempt: new Date(),
          mostCommonErrorCode: undefined,
          recentFailures24h: 0,
        };
      }

      const metrics = result.rows[0];
      
      return {
        subscriptionId,
        url: subscription.url,
        events: subscription.events,
        organizationId,
        totalAttempts: parseInt(metrics.total_attempts, 10) || 0,
        successfulAttempts: parseInt(metrics.successful_attempts, 10) || 0,
        failedAttempts: parseInt(metrics.failed_attempts, 10) || 0,
        pendingRetries: parseInt(metrics.pending_retries, 10) || 0,
        successRatePercent: parseFloat(metrics.success_rate_percent) || 0,
        avgResponseTimeMs: metrics.avg_response_time_ms ? parseFloat(metrics.avg_response_time_ms) : undefined,
        firstAttempt: new Date(metrics.first_attempt),
        lastAttempt: new Date(metrics.last_attempt),
        mostCommonErrorCode: metrics.most_common_error_code || undefined,
        recentFailures24h: parseInt(metrics.recent_failures_24h, 10) || 0,
      };
    } catch (error) {
      logger.error('Failed to get subscription summary', { 
        error, 
        organizationId, 
        subscriptionId 
      });
      throw new Error(`Failed to get subscription summary: ${error.message}`);
    }
  }

  /**
   * Get summary for a specific event type
   */
  async getEventTypeSummary(
    organizationId: number,
    eventType: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<WebhookEventTypeSummary> {
    try {
      const range = timeRange || this.getDefaultTimeRange();
      
      const result = await pool.query(
        `SELECT 
          event_type,
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_attempts,
          COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed_attempts,
          AVG(response_time_ms) as avg_response_time_ms,
          COUNT(DISTINCT subscription_id) as subscriptions_count
         FROM webhook_delivery_metrics
         WHERE organization_id = $1 
           AND event_type = $2
           AND created_at BETWEEN $3 AND $4
         GROUP BY event_type`,
        [organizationId, eventType, range.start, range.end]
      );

      if (result.rows.length === 0) {
        return {
          eventType,
          totalAttempts: 0,
          successfulAttempts: 0,
          failedAttempts: 0,
          successRatePercent: 0,
          avgResponseTimeMs: undefined,
          subscriptionsCount: 0,
        };
      }

      const row = result.rows[0];
      const totalAttempts = parseInt(row.total_attempts, 10) || 0;
      const successfulAttempts = parseInt(row.successful_attempts, 10) || 0;
      const successRatePercent = totalAttempts > 0 
        ? (successfulAttempts / totalAttempts) * 100 
        : 0;

      return {
        eventType,
        totalAttempts,
        successfulAttempts,
        failedAttempts: parseInt(row.failed_attempts, 10) || 0,
        successRatePercent,
        avgResponseTimeMs: row.avg_response_time_ms ? parseFloat(row.avg_response_time_ms) : undefined,
        subscriptionsCount: parseInt(row.subscriptions_count, 10) || 0,
      };
    } catch (error) {
      logger.error('Failed to get event type summary', { 
        error, 
        organizationId, 
        eventType 
      });
      throw new Error(`Failed to get event type summary: ${error.message}`);
    }
  }

  // Private helper methods

  private getDefaultTimeRange(): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7); // Last 7 days by default
    return { start, end };
  }

  private async getOverallStats(
    organizationId: number,
    timeRange: { start: Date; end: Date }
  ) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_attempts,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed_attempts,
        COUNT(CASE WHEN status = 'retry_scheduled' THEN 1 END) as pending_retries,
        AVG(response_time_ms) as avg_response_time_ms
       FROM webhook_delivery_metrics
       WHERE organization_id = $1 
         AND created_at BETWEEN $2 AND $3`,
      [organizationId, timeRange.start, timeRange.end]
    );

    const row = result.rows[0] || {};
    const totalAttempts = parseInt(row.total_attempts, 10) || 0;
    const successfulAttempts = parseInt(row.successful_attempts, 10) || 0;
    const successRatePercent = totalAttempts > 0 
      ? (successfulAttempts / totalAttempts) * 100 
      : 0;

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts: parseInt(row.failed_attempts, 10) || 0,
      pendingRetries: parseInt(row.pending_retries, 10) || 0,
      overallSuccessRatePercent: successRatePercent,
      avgResponseTimeMs: row.avg_response_time_ms ? parseFloat(row.avg_response_time_ms) : undefined,
    };
  }

  private async getSubscriptionBreakdown(
    organizationId: number,
    subscriptions: any[],
    timeRange: { start: Date; end: Date },
    maxSubscriptions: number
  ): Promise<WebhookSubscriptionSummary[]> {
    if (subscriptions.length === 0) {
      return [];
    }

    const subscriptionIds = subscriptions.map(s => s.id);
    const placeholders = subscriptionIds.map((_, i) => `$${i + 2}`).join(',');
    
    const result = await pool.query(
      `SELECT * FROM webhook_delivery_health_summary
       WHERE organization_id = $1 
         AND subscription_id IN (${placeholders})
         AND last_attempt >= $${subscriptionIds.length + 2}
       ORDER BY success_rate_percent ASC, total_attempts DESC
       LIMIT $${subscriptionIds.length + 3}`,
      [organizationId, ...subscriptionIds, timeRange.start, maxSubscriptions]
    );

    return result.rows.map(row => {
      const subscription = subscriptions.find(s => s.id === row.subscription_id);
      
      return {
        subscriptionId: row.subscription_id,
        url: subscription?.url || row.url,
        events: subscription?.events || [],
        organizationId,
        totalAttempts: parseInt(row.total_attempts, 10) || 0,
        successfulAttempts: parseInt(row.successful_attempts, 10) || 0,
        failedAttempts: parseInt(row.failed_attempts, 10) || 0,
        pendingRetries: parseInt(row.pending_retries, 10) || 0,
        successRatePercent: parseFloat(row.success_rate_percent) || 0,
        avgResponseTimeMs: row.avg_response_time_ms ? parseFloat(row.avg_response_time_ms) : undefined,
        firstAttempt: new Date(row.first_attempt),
        lastAttempt: new Date(row.last_attempt),
        mostCommonErrorCode: row.most_common_error_code || undefined,
        recentFailures24h: parseInt(row.recent_failures_24h, 10) || 0,
      };
    });
  }

  private async getEventTypeBreakdown(
    organizationId: number,
    timeRange: { start: Date; end: Date },
    maxEventTypes: number
  ): Promise<WebhookEventTypeSummary[]> {
    const result = await pool.query(
      `SELECT 
        event_type,
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_attempts,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed_attempts,
        AVG(response_time_ms) as avg_response_time_ms,
        COUNT(DISTINCT subscription_id) as subscriptions_count
       FROM webhook_delivery_metrics
       WHERE organization_id = $1 
         AND created_at BETWEEN $2 AND $3
       GROUP BY event_type
       ORDER BY total_attempts DESC
       LIMIT $4`,
      [organizationId, timeRange.start, timeRange.end, maxEventTypes]
    );

    return result.rows.map(row => {
      const totalAttempts = parseInt(row.total_attempts, 10) || 0;
      const successfulAttempts = parseInt(row.successful_attempts, 10) || 0;
      const successRatePercent = totalAttempts > 0 
        ? (successfulAttempts / totalAttempts) * 100 
        : 0;

      return {
        eventType: row.event_type,
        totalAttempts,
        successfulAttempts,
        failedAttempts: parseInt(row.failed_attempts, 10) || 0,
        successRatePercent,
        avgResponseTimeMs: row.avg_response_time_ms ? parseFloat(row.avg_response_time_ms) : undefined,
        subscriptionsCount: parseInt(row.subscriptions_count, 10) || 0,
      };
    });
  }

  private async analyzeFailurePatterns(
    organizationId: number,
    timeRange: { start: Date; end: Date }
  ) {
    // Get most common error codes
    const errorCodesResult = await pool.query(
      `SELECT 
        error_code,
        COUNT(*) as count
       FROM webhook_delivery_metrics
       WHERE organization_id = $1 
         AND created_at BETWEEN $2 AND $3
         AND status = 'failure'
         AND error_code IS NOT NULL
       GROUP BY error_code
       ORDER BY count DESC
       LIMIT 10`,
      [organizationId, timeRange.start, timeRange.end]
    );

    const totalFailures = errorCodesResult.rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);
    const mostCommonErrorCodes = errorCodesResult.rows.map(row => ({
      errorCode: row.error_code,
      count: parseInt(row.count, 10),
      percentage: totalFailures > 0 ? (parseInt(row.count, 10) / totalFailures) * 100 : 0,
    }));

    // Get recurring failures (same subscription, same error multiple times)
    const recurringResult = await pool.query(
      `SELECT 
        subscription_id,
        url,
        error_code,
        COUNT(*) as failure_count,
        MAX(created_at) as last_failure
       FROM webhook_delivery_metrics
       WHERE organization_id = $1 
         AND created_at BETWEEN $2 AND $3
         AND status = 'failure'
         AND error_code IS NOT NULL
       GROUP BY subscription_id, url, error_code
       HAVING COUNT(*) > 1
       ORDER BY failure_count DESC`,
      [organizationId, timeRange.start, timeRange.end]
    );

    const recurringFailures = recurringResult.rows.map(row => ({
      subscriptionId: row.subscription_id,
      url: row.url,
      errorCode: row.error_code,
      failureCount: parseInt(row.failure_count, 10),
      lastFailure: new Date(row.last_failure),
    }));

    // Categorize failures
    const failureTypesResult = await pool.query(
      `SELECT 
        COUNT(CASE WHEN error_code = 'TIMEOUT' THEN 1 END) as timeout_failures,
        COUNT(CASE WHEN error_code IN ('CONNECTION_REFUSED', 'DNS_ERROR') THEN 1 END) as network_error_failures,
        COUNT(CASE WHEN error_code LIKE '%ERROR' AND error_code NOT IN ('TIMEOUT', 'CONNECTION_REFUSED', 'DNS_ERROR') THEN 1 END) as http_error_failures
       FROM webhook_delivery_metrics
       WHERE organization_id = $1 
         AND created_at BETWEEN $2 AND $3
         AND status = 'failure'`,
      [organizationId, timeRange.start, timeRange.end]
    );

    const failureTypes = failureTypesResult.rows[0] || {};

    return {
      mostCommonErrorCodes,
      recurringFailures,
      timeoutFailures: parseInt(failureTypes.timeout_failures, 10) || 0,
      networkErrorFailures: parseInt(failureTypes.network_error_failures, 10) || 0,
      httpErrorFailures: parseInt(failureTypes.http_error_failures, 10) || 0,
    };
  }

  private async getHourlyTrends(
    organizationId: number,
    timeRange: { start: Date; end: Date }
  ) {
    const result = await pool.query(
      `SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as attempts,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_attempts,
        AVG(response_time_ms) as avg_response_time_ms
       FROM webhook_delivery_metrics
       WHERE organization_id = $1 
         AND created_at BETWEEN $2 AND $3
       GROUP BY DATE_TRUNC('hour', created_at)
       ORDER BY hour DESC`,
      [organizationId, timeRange.start, timeRange.end]
    );

    return result.rows.map(row => {
      const attempts = parseInt(row.attempts, 10) || 0;
      const successfulAttempts = parseInt(row.successful_attempts, 10) || 0;
      const successRatePercent = attempts > 0 
        ? (successfulAttempts / attempts) * 100 
        : 0;

      return {
        hour: row.hour.toISOString(),
        attempts,
        successRatePercent,
        avgResponseTimeMs: row.avg_response_time_ms ? parseFloat(row.avg_response_time_ms) : undefined,
      };
    });
  }

  private generateRecommendations(
    subscriptions: WebhookSubscriptionSummary[],
    eventTypes: WebhookEventTypeSummary[],
    failurePatterns: any
  ) {
    const recommendations: Array<{
      type: 'warning' | 'suggestion' | 'critical';
      message: string;
      action?: string;
    }> = [];

    // Check for critical failures (0% success rate)
    const criticalSubscriptions = subscriptions.filter(
      sub => sub.totalAttempts > 0 && sub.successRatePercent === 0
    );
    
    criticalSubscriptions.forEach(sub => {
      recommendations.push({
        type: 'critical',
        message: `Subscription ${sub.subscriptionId} has 0% success rate with ${sub.recentFailures24h} recent failures.`,
        action: `Review webhook endpoint configuration for ${sub.url}`,
      });
    });

    // Check for warning-level failures (< 80% success rate)
    const warningSubscriptions = subscriptions.filter(
      sub => sub.totalAttempts > 10 && sub.successRatePercent < 80 && sub.successRatePercent > 0
    );
    
    warningSubscriptions.forEach(sub => {
      recommendations.push({
        type: 'warning',
        message: `Subscription ${sub.subscriptionId} has low success rate (${sub.successRatePercent.toFixed(1)}%).`,
        action: 'Monitor for improvement or investigate endpoint reliability',
      });
    });

    // Check for recurring error patterns
    if (failurePatterns.recurringFailures.length > 0) {
      failurePatterns.recurringFailures.forEach((failure: any) => {
        if (failure.failureCount >= 3) {
          recommendations.push({
            type: 'critical',
            message: `Recurring ${failure.errorCode} errors (${failure.failureCount} failures) for subscription ${failure.subscriptionId}.`,
            action: `Investigate endpoint ${failure.url} for persistent issues`,
          });
        }
      });
    }

    // Check for timeout failures
    if (failurePatterns.timeoutFailures > 5) {
      recommendations.push({
        type: 'warning',
        message: `Multiple timeout failures detected (${failurePatterns.timeoutFailures}). Consider increasing timeout settings.`,
        action: 'Review webhook timeout configuration',
      });
    }

    // Check for slow response times
    const slowSubscriptions = subscriptions.filter(
      sub => sub.avgResponseTimeMs && sub.avgResponseTimeMs > 1000
    );
    
    if (slowSubscriptions.length > 0) {
      recommendations.push({
        type: 'suggestion',
        message: `${slowSubscriptions.length} subscription(s) have average response times over 1 second.`,
        action: 'Consider optimizing webhook receiver performance',
      });
    }

    // Check for retry patterns
    const highRetrySubscriptions = subscriptions.filter(
      sub => sub.pendingRetries > 0
    );
    
    if (highRetrySubscriptions.length > 0) {
      recommendations.push({
        type: 'suggestion',
        message: `${highRetrySubscriptions.length} subscription(s) have pending retries.`,
        action: 'Review retry strategy and exponential backoff configuration',
      });
    }

    // If no critical issues, add general suggestions
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'suggestion',
        message: 'Webhook delivery health is good. Consider setting up proactive monitoring alerts.',
        action: 'Configure alerting for success rate drops below 95%',
      });
    }

    return recommendations;
  }
}

export const webhookHealthReportService = new WebhookHealthReportService();