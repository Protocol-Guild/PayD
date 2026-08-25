/**
 * Insight Cards Service — unit tests with fixture data.
 *
 * Mocks the database pool and external services so tests run without Postgres.
 * Each test provides fixture data with known expected output.
 */

const mockQuery = jest.fn();

jest.mock('../../config/database.js', () => ({
  __esModule: true,
  pool: { query: mockQuery },
  default: { query: mockQuery },
}));

jest.mock('../tenantConfigService.js', () => ({
  __esModule: true,
  default: { getConfig: jest.fn() },
}));

jest.mock('../balanceService.js', () => ({
  __esModule: true,
  BalanceService: { preflightCheck: jest.fn() },
}));

import { InsightCardsService } from '../insightCardsService';
import tenantConfigService from '../tenantConfigService';
import { BalanceService } from '../balanceService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = 42;
const WINDOW_DAYS = 30;

function payrollRow(overrides: Record<string, string> = {}) {
  return {
    total: '10',
    completed: '8',
    failed: '2',
    total_disbursed: '5000.00',
    ...overrides,
  };
}

function employeeRow(overrides: Record<string, string> = {}) {
  return {
    total: '20',
    active: '18',
    inactive: '2',
    departments: '4',
    ...overrides,
  };
}

function scheduleRow(overrides: Record<string, string | null> = {}) {
  return {
    total: '3',
    active: '2',
    next_run: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InsightCardsService', () => {
  let service: InsightCardsService;

  beforeEach(() => {
    service = new InsightCardsService();
    jest.clearAllMocks();
  });

  // ---- Payroll insights ---------------------------------------------------

  test('generates payroll total-disbursed card with correct metric', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const payrollCard = result.cards.find((c) => c.id === 'payroll-total-disbursed');
    expect(payrollCard).toBeDefined();
    expect(payrollCard!.metric).toBe('5000.00');
    expect(payrollCard!.metricLabel).toBe('ORGUSD');
    expect(payrollCard!.severity).toBe('warning'); // 2 failures > 0
    expect(payrollCard!.category).toBe('payroll');
  });

  test('generates critical failure-rate card when >10% payments fail', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [payrollRow({ total: '10', failed: '5', completed: '5' })],
      })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const failCard = result.cards.find((c) => c.id === 'payroll-high-failure-rate');
    expect(failCard).toBeDefined();
    expect(failCard!.severity).toBe('critical');
    expect(failCard!.metric).toBe('50.0%');
  });

  test('does not generate failure-rate card when <=10% fail', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [payrollRow({ total: '100', failed: '5', completed: '95' })],
      })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const failCard = result.cards.find((c) => c.id === 'payroll-high-failure-rate');
    expect(failCard).toBeUndefined();
  });

  test('generates no-activity card when zero transactions', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          payrollRow({ total: '0', completed: '0', failed: '0', total_disbursed: '0' }),
        ],
      })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const noActivity = result.cards.find((c) => c.id === 'payroll-no-activity');
    expect(noActivity).toBeDefined();
    expect(noActivity!.severity).toBe('warning');
    expect(noActivity!.category).toBe('payroll');
  });

  // ---- Workforce insights -------------------------------------------------

  test('generates workforce headcount card', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const headcount = result.cards.find((c) => c.id === 'workforce-headcount');
    expect(headcount).toBeDefined();
    expect(headcount!.metric).toBe('18');
    expect(headcount!.metricLabel).toBe('Active Employees');
  });

  test('generates high-inactive warning when inactive >= active', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({
        rows: [employeeRow({ active: '5', inactive: '10', total: '15' })],
      })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const highInactive = result.cards.find((c) => c.id === 'workforce-high-inactive');
    expect(highInactive).toBeDefined();
    expect(highInactive!.severity).toBe('warning');
  });

  test('generates no-employees card when total is zero', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({
        rows: [employeeRow({ total: '0', active: '0', inactive: '0', departments: '0' })],
      })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const noEmp = result.cards.find((c) => c.id === 'workforce-no-employees');
    expect(noEmp).toBeDefined();
    expect(noEmp!.severity).toBe('info');
  });

  // ---- Liquidity insights -------------------------------------------------

  test('generates not-configured card when liquidity settings missing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const notConfigured = result.cards.find((c) => c.id === 'liquidity-not-configured');
    expect(notConfigured).toBeDefined();
    expect(notConfigured!.severity).toBe('info');
  });

  test('generates zero-balance critical card when balance is 0', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue({
      distributionAccount: 'GABC123',
      assetIssuer: 'GDEF456',
    });
    (BalanceService.preflightCheck as jest.Mock).mockResolvedValue({
      availableBalance: '0',
    });

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const zeroBalance = result.cards.find((c) => c.id === 'liquidity-zero-balance');
    expect(zeroBalance).toBeDefined();
    expect(zeroBalance!.severity).toBe('critical');
    expect(zeroBalance!.metric).toBe('0');
  });

  test('generates balance info card when balance is positive', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue({
      distributionAccount: 'GABC123',
      assetIssuer: 'GDEF456',
    });
    (BalanceService.preflightCheck as jest.Mock).mockResolvedValue({
      availableBalance: '15000.50',
    });

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const balanceCard = result.cards.find((c) => c.id === 'liquidity-balance');
    expect(balanceCard).toBeDefined();
    expect(balanceCard!.metric).toBe('15000.50');
    expect(balanceCard!.severity).toBe('info');
  });

  // ---- Schedule insights --------------------------------------------------

  test('generates schedule summary card', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const summary = result.cards.find((c) => c.id === 'schedule-summary');
    expect(summary).toBeDefined();
    expect(summary!.metric).toBe('2');
    expect(summary!.metricLabel).toBe('Active Schedules');
  });

  test('generates no-schedules card when total is zero', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({
        rows: [scheduleRow({ total: '0', active: '0' })],
      });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const noSched = result.cards.find((c) => c.id === 'schedule-none');
    expect(noSched).toBeDefined();
    expect(noSched!.severity).toBe('info');
  });

  test('generates upcoming-run warning when next run is within 24h', async () => {
    const fiveHoursFromNow = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({
        rows: [scheduleRow({ next_run: fiveHoursFromNow })],
      });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const upcoming = result.cards.find((c) => c.id === 'schedule-upcoming');
    expect(upcoming).toBeDefined();
    expect(upcoming!.severity).toBe('warning'); // < 6 hours
  });

  // ---- Sorting & structure ------------------------------------------------

  test('cards are sorted by severity: critical first, then warning, then info', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [payrollRow({ total: '10', failed: '5', completed: '5' })],
      })
      .mockResolvedValueOnce({
        rows: [employeeRow({ active: '5', inactive: '10', total: '15' })],
      })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < result.cards.length; i++) {
      expect(severityOrder[result.cards[i]!.severity]!).toBeGreaterThanOrEqual(
        severityOrder[result.cards[i - 1]!.severity]!
      );
    }
  });

  test('response includes generatedAt and windowDays', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [payrollRow()] })
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, 14);

    expect(result.windowDays).toBe(14);
    expect(result.generatedAt).toBeTruthy();
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
  });

  test('partial failures from individual builders do not crash the whole response', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ rows: [employeeRow()] })
      .mockResolvedValueOnce({ rows: [scheduleRow()] });

    (tenantConfigService.getConfig as jest.Mock).mockResolvedValue(null);

    const result = await service.generate(ORG_ID, WINDOW_DAYS);

    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.cards.some((c) => c.category === 'workforce')).toBe(true);
    expect(result.cards.some((c) => c.category === 'schedule')).toBe(true);
    expect(result.cards.some((c) => c.category === 'payroll')).toBe(false);
  });
});
