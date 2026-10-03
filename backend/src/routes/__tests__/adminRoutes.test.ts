import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { UserRole } from '../../types/auth.js';
import type { AuditIntegrityService } from '../../services/auditIntegrityService.js';
import type { TenantRateLimitService } from '../../services/tenantRateLimitService.js';
import type { TenantQuotaService } from '../../services/tenantQuotaService.js';
import type { DatabaseTenantContext } from '../../config/database.js';
import { TOKEN_TYPE_ACCESS, TOKEN_TYPE_2FA_CHALLENGE } from '../../services/authService.js';

const JWT_SECRET = 'admin-route-regression-test-secret';
const JUSTIFICATION = 'Investigating support ticket PAYD-530';

type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[]
) => Promise<{ rows: Array<{ count: string }>; rowCount: number }>;

const mockQuery = jest.fn<DatabaseQuery>().mockImplementation(async (sql) => ({
  rows: sql.includes('SELECT COUNT(*) FROM platform_admin_access_logs') ? [{ count: '0' }] : [],
  rowCount: 1,
}));
const mockVerifyIntegrity = jest.fn<AuditIntegrityService['verifyIntegrity']>().mockResolvedValue({
  passed: true,
  totalRows: 0,
  checkedRows: 0,
  checkedAt: new Date('2026-01-01T00:00:00Z'),
});
const mockGetOverrides = jest.fn<TenantRateLimitService['getOverrides']>().mockResolvedValue({});
const mockSetOverrides = jest.fn<TenantRateLimitService['setOverrides']>().mockResolvedValue(undefined);
const mockGetQuotas = jest.fn<TenantQuotaService['getQuotas']>().mockResolvedValue({
  maxEmployees: 100,
  maxMonthlyTransactions: 1000,
  maxStorageMb: 100,
  quotaAlertThreshold: 0.8,
});
const mockGetCurrentUsage = jest.fn<TenantQuotaService['getCurrentUsage']>().mockResolvedValue({
  employeeCount: 5,
  monthlyTransactionCount: 10,
  storageMb: 0,
});

// Keep JWT verification, role checks, justification, and auditing real. Only
// configuration and business/database boundaries are isolated from services.
jest.mock('../../config/env.js', () => ({
  config: { JWT_SECRET: 'admin-route-regression-test-secret', DATABASE_URL: 'postgres://localhost/payd_route_test' },
}));
jest.mock('../../config/database.js', () => ({
  __esModule: true,
  pool: { query: mockQuery },
  default: { query: mockQuery },
  runWithTenantContext: <T>(_context: DatabaseTenantContext, operation: () => T): T => operation(),
}));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../services/auditIntegrityService.js', () => ({
  auditIntegrityService: { verifyIntegrity: mockVerifyIntegrity },
}));
jest.mock('../../services/tenantRateLimitService.js', () => ({
  TenantRateLimitService: class {
    getOverrides = mockGetOverrides;
    setOverrides = mockSetOverrides;
  },
}));
jest.mock('../../services/tenantQuotaService.js', () => ({
  tenantQuotaService: { getQuotas: mockGetQuotas, getCurrentUsage: mockGetCurrentUsage },
}));

const app = express();
app.use(express.json());
beforeAll(async () => {
  const { default: adminRoutes } = await import('../adminRoutes.js');
  app.use('/api/admin', adminRoutes);
});

function makeToken(role: UserRole, tokenType = TOKEN_TYPE_ACCESS, secret = JWT_SECRET): string {
  return jwt.sign({ id: 7, organizationId: 42, role, typ: tokenType }, secret, { expiresIn: '5m' });
}

interface Endpoint {
  method: 'get' | 'patch';
  path: string;
  body?: Record<string, unknown>;
  expectBusinessOperation: () => void;
}

const overrides = { api: { windowMs: 60_000, maxRequests: 100 } };
const endpoints: Endpoint[] = [
  {
    method: 'get',
    path: '/audit/integrity',
    expectBusinessOperation: () => expect(mockVerifyIntegrity).toHaveBeenCalledWith({ limit: undefined }),
  },
  {
    method: 'get',
    path: '/tenants/42/rate-limits',
    expectBusinessOperation: () => expect(mockGetOverrides).toHaveBeenCalledWith(42),
  },
  {
    method: 'patch',
    path: '/tenants/42/rate-limits',
    body: overrides,
    expectBusinessOperation: () => expect(mockSetOverrides).toHaveBeenCalledWith(42, overrides),
  },
  {
    method: 'get',
    path: '/access-logs',
    expectBusinessOperation: () => expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*) FROM platform_admin_access_logs'),
      []
    ),
  },
  {
    method: 'get',
    path: '/tenants/42/quotas',
    expectBusinessOperation: () => {
      expect(mockGetQuotas).toHaveBeenCalledWith(42);
      expect(mockGetCurrentUsage).toHaveBeenCalledWith(42);
    },
  },
  {
    method: 'patch',
    path: '/tenants/42/quotas',
    body: { maxEmployees: 100 },
    expectBusinessOperation: () => expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organization_settings'),
      [42, 100, null, null]
    ),
  },
];

function callEndpoint(endpoint: Endpoint, token?: string, justification?: string): request.Test {
  let call = request(app)[endpoint.method](`/api/admin${endpoint.path}`);
  if (token) call = call.set('Authorization', `Bearer ${token}`);
  if (justification) call = call.set('X-Admin-Reason', justification);
  if (endpoint.body) call = call.send(endpoint.body);
  return call;
}

function expectNoBusinessOrAuditCalls(): void {
  for (const operation of [
    mockQuery,
    mockVerifyIntegrity,
    mockGetOverrides,
    mockSetOverrides,
    mockGetQuotas,
    mockGetCurrentUsage,
  ]) {
    expect(operation).not.toHaveBeenCalled();
  }
}

describe.each(endpoints)('admin authorization: $method $path', (endpoint) => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires authentication even when a justification is supplied', async () => {
    const response = await callEndpoint(endpoint, undefined, JUSTIFICATION);
    expect(response.status).toBe(401);
    expectNoBusinessOrAuditCalls();
  });

  it.each<UserRole>(['EMPLOYER', 'EMPLOYEE'])('rejects an authenticated %s', async (role) => {
    const response = await callEndpoint(endpoint, makeToken(role), JUSTIFICATION);
    expect(response.status).toBe(403);
    expectNoBusinessOrAuditCalls();
  });

  it('rejects an ADMIN token signed with another key', async () => {
    const response = await callEndpoint(endpoint, makeToken('ADMIN', TOKEN_TYPE_ACCESS, 'wrong-key'), JUSTIFICATION);
    expect(response.status).toBe(403);
    expectNoBusinessOrAuditCalls();
  });

  it('rejects an ADMIN challenge token signed with the access-token key', async () => {
    const response = await callEndpoint(endpoint, makeToken('ADMIN', TOKEN_TYPE_2FA_CHALLENGE), JUSTIFICATION);
    expect(response.status).toBe(403);
    expectNoBusinessOrAuditCalls();
  });

  it('requires a justification from an authenticated ADMIN', async () => {
    const response = await callEndpoint(endpoint, makeToken('ADMIN'));
    expect(response.status).toBe(403);
    expectNoBusinessOrAuditCalls();
  });

  it('allows and audits an authenticated ADMIN with a justification', async () => {
    const response = await callEndpoint(endpoint, makeToken('ADMIN'), JUSTIFICATION);
    expect(response.status).toBe(200);
    endpoint.expectBusinessOperation();

    const auditCall = mockQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO platform_admin_access_logs'));
    expect(auditCall?.[1]?.[0]).toBe(7);
    expect(auditCall?.[1]?.[3]).toBe(JUSTIFICATION);
  });
});
