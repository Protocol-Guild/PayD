import { pool } from '../config/database.js';
import { BalanceService } from './balanceService.js';
import tenantConfigService from './tenantConfigService.js';
import logger from '../utils/logger.js';
import type { InsightCard, InsightCardsResponse } from '../schemas/insightCardsSchema.js';

const DEFAULT_WINDOW_DAYS = 30;

export class InsightCardsService {
  async generate(
    organizationId: number,
    windowDays: number = DEFAULT_WINDOW_DAYS
  ): Promise<InsightCardsResponse> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const [payrollInsights, workforceInsights, liquidityInsights, scheduleInsights] =
      await Promise.allSettled([
        this.buildPayrollInsights(organizationId, windowStart, now),
        this.buildWorkforceInsights(organizationId),
        this.buildLiquidityInsights(organizationId),
        this.buildScheduleInsights(organizationId, windowStart, now),
      ]);

    const cards: InsightCard[] = [];

    if (payrollInsights.status === 'fulfilled') cards.push(...payrollInsights.value);
    if (workforceInsights.status === 'fulfilled') cards.push(...workforceInsights.value);
    if (liquidityInsights.status === 'fulfilled') cards.push(...liquidityInsights.value);
    if (scheduleInsights.status === 'fulfilled') cards.push(...scheduleInsights.value);

    cards.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return {
      cards,
      generatedAt: now.toISOString(),
      windowDays,
    };
  }

  private async buildPayrollInsights(
    organizationId: number,
    windowStart: Date,
    now: Date
  ): Promise<InsightCard[]> {
    const cards: InsightCard[] = [];

    const result = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS total_disbursed
       FROM transactions
       WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3`,
      [organizationId, windowStart, now]
    );

    const row = result.rows[0];
    const total = parseInt(row.total, 10);
    const failed = parseInt(row.failed, 10);
    const completed = parseInt(row.completed, 10);
    const totalDisbursed = parseFloat(row.total_disbursed);

    if (total === 0) {
      cards.push({
        id: 'payroll-no-activity',
        title: 'No payroll activity',
        body: `No transactions recorded in the last ${Math.round((now.getTime() - windowStart.getTime()) / 86400000)} days. Verify schedules are configured.`,
        category: 'payroll',
        severity: 'warning',
        actionLabel: 'View Schedules',
        actionRoute: '/payroll',
        generatedAt: now.toISOString(),
      });
      return cards;
    }

    cards.push({
      id: 'payroll-total-disbursed',
      title: 'Total disbursed',
      body: `${completed} payments completed${failed > 0 ? `, ${failed} failed` : ''} this period.`,
      category: 'payroll',
      severity: failed > 0 ? 'warning' : 'info',
      metric: totalDisbursed.toFixed(2),
      metricLabel: 'ORGUSD',
      actionLabel: 'View Transactions',
      actionRoute: '/transaction-history',
      generatedAt: now.toISOString(),
    });

    if (total > 0) {
      const failRate = (failed / total) * 100;
      if (failRate > 10) {
        cards.push({
          id: 'payroll-high-failure-rate',
          title: 'High payment failure rate',
          body: `${failRate.toFixed(1)}% of payments failed (${failed}/${total}). Review failed transactions for common errors.`,
          category: 'payroll',
          severity: 'critical',
          metric: `${failRate.toFixed(1)}%`,
          metricLabel: 'Failure Rate',
          actionLabel: 'View Failed',
          actionRoute: '/transaction-history',
          generatedAt: now.toISOString(),
        });
      }
    }

    return cards;
  }

  private async buildWorkforceInsights(organizationId: number): Promise<InsightCard[]> {
    const cards: InsightCard[] = [];
    const now = new Date();

    const result = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS active,
         COUNT(CASE WHEN status = 'inactive' THEN 1 END) AS inactive,
         COUNT(DISTINCT department) AS departments
       FROM employees
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [organizationId]
    );

    const row = result.rows[0];
    const total = parseInt(row.total, 10);
    const active = parseInt(row.active, 10);
    const inactive = parseInt(row.inactive, 10);

    if (total === 0) {
      cards.push({
        id: 'workforce-no-employees',
        title: 'No employees on record',
        body: 'Add employees to start managing payroll and distributions.',
        category: 'workforce',
        severity: 'info',
        actionLabel: 'Add Employees',
        actionRoute: '/employee',
        generatedAt: now.toISOString(),
      });
      return cards;
    }

    cards.push({
      id: 'workforce-headcount',
      title: 'Workforce overview',
      body: `${active} active, ${inactive} inactive across ${row.departments} department${row.departments === 1 ? '' : 's'}.`,
      category: 'workforce',
      severity: 'info',
      metric: String(active),
      metricLabel: 'Active Employees',
      actionLabel: 'View Employees',
      actionRoute: '/employee',
      generatedAt: now.toISOString(),
    });

    if (inactive > 0 && inactive >= active) {
      cards.push({
        id: 'workforce-high-inactive',
        title: 'High inactive employee count',
        body: `${inactive} inactive employees outnumber the ${active} active ones. Consider archiving stale records.`,
        category: 'workforce',
        severity: 'warning',
        generatedAt: now.toISOString(),
      });
    }

    return cards;
  }

  private async buildLiquidityInsights(organizationId: number): Promise<InsightCard[]> {
    const cards: InsightCard[] = [];
    const now = new Date();

    try {
      const config = await tenantConfigService.getConfig(organizationId, 'liquidity_settings');
      if (!config?.distributionAccount || !config?.assetIssuer) {
        cards.push({
          id: 'liquidity-not-configured',
          title: 'Liquidity monitoring unavailable',
          body: 'Configure a distribution account and asset issuer to enable balance monitoring.',
          category: 'liquidity',
          severity: 'info',
          actionLabel: 'Configure',
          actionRoute: '/settings',
          generatedAt: now.toISOString(),
        });
        return cards;
      }

      const preflight = await BalanceService.preflightCheck(
        config.distributionAccount,
        config.assetIssuer,
        []
      );

      const balance = parseFloat(preflight.availableBalance);

      if (balance === 0) {
        cards.push({
          id: 'liquidity-zero-balance',
          title: 'Distribution account empty',
          body: 'The distribution account has zero ORGUSD balance. Fund it before the next payroll run.',
          category: 'liquidity',
          severity: 'critical',
          metric: '0',
          metricLabel: 'ORGUSD Balance',
          actionLabel: 'View Forecast',
          actionRoute: '/forecasting',
          generatedAt: now.toISOString(),
        });
      } else {
        cards.push({
          id: 'liquidity-balance',
          title: 'Distribution balance',
          body: `Distribution account holds ${preflight.availableBalance} ORGUSD.`,
          category: 'liquidity',
          severity: 'info',
          metric: parseFloat(preflight.availableBalance).toFixed(2),
          metricLabel: 'ORGUSD',
          actionLabel: 'View Forecast',
          actionRoute: '/forecasting',
          generatedAt: now.toISOString(),
        });
      }
    } catch (err) {
      logger.warn('Could not build liquidity insight', err);
    }

    return cards;
  }

  private async buildScheduleInsights(
    organizationId: number,
    windowStart: Date,
    now: Date
  ): Promise<InsightCard[]> {
    const cards: InsightCard[] = [];

    const result = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS active,
         MIN(next_run_at) AS next_run
       FROM payroll_schedules
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [organizationId]
    );

    const row = result.rows[0];
    const total = parseInt(row.total, 10);
    const active = parseInt(row.active, 10);

    if (total === 0) {
      cards.push({
        id: 'schedule-none',
        title: 'No payroll schedules',
        body: 'Create a schedule to automate recurring payroll runs.',
        category: 'schedule',
        severity: 'info',
        actionLabel: 'Create Schedule',
        actionRoute: '/payroll',
        generatedAt: now.toISOString(),
      });
      return cards;
    }

    cards.push({
      id: 'schedule-summary',
      title: 'Payroll schedules',
      body: `${active} active schedule${active === 1 ? '' : 's'} out of ${total} total.`,
      category: 'schedule',
      severity: 'info',
      metric: String(active),
      metricLabel: 'Active Schedules',
      actionLabel: 'View Schedules',
      actionRoute: '/payroll',
      generatedAt: now.toISOString(),
    });

    if (row.next_run) {
      const nextRun = new Date(row.next_run);
      const hoursUntil = (nextRun.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil > 0 && hoursUntil < 24) {
        cards.push({
          id: 'schedule-upcoming',
          title: 'Payroll run approaching',
          body: `Next scheduled run in ${Math.round(hoursUntil)} hour${Math.round(hoursUntil) === 1 ? '' : 's'}. Verify account balance is sufficient.`,
          category: 'schedule',
          severity: hoursUntil < 6 ? 'warning' : 'info',
          actionLabel: 'View Forecast',
          actionRoute: '/forecasting',
          generatedAt: now.toISOString(),
        });
      }
    }

    return cards;
  }
}

export const insightCardsService = new InsightCardsService();
