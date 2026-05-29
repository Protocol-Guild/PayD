/**
 * Integration tests for the DB Scaling endpoints (Parts 39 & 40).
 *
 * Issues #284 (Part 39) — lock contention, unused indexes
 * Issues #285 (Part 40) — replication lag, table sizes
 *
 * Strategy
 * ─────────
 * DbScalingService is instantiated at module level inside the controller.
 * We replace it with a Jest mock factory before importing the app so that
 * every method is a jest.fn() and no real PostgreSQL connection is needed.
 */

import request from 'supertest';
import app from '../app.js';

// ─── Mock DbScalingService ────────────────────────────────────────────────────

const mockGetLockContention   = jest.fn();
const mockGetUnusedIndexes    = jest.fn();
const mockGetReplicationLag   = jest.fn();
const mockGetTableSizes       = jest.fn();

// Also stub the methods used by existing controller handlers so the mock
// implementation is complete (prevents "not a function" errors from other routes
// if the test runner resolves them).
const mockGetPoolStats             = jest.fn();
const mockRunHealthCheck           = jest.fn();
const mockGetSlowQueries           = jest.fn();
const mockGetIndexUsage            = jest.fn();
const mockGetPoolConfig            = jest.fn();
const mockGetTableBloat            = jest.fn();
const mockGetCacheHitRate          = jest.fn();
const mockGetLongRunningTransactions = jest.fn();
const mockGetVacuumStats           = jest.fn();
const mockGetConnectionBreakdown   = jest.fn();
const mockGetDbSettings            = jest.fn();

jest.mock('../services/dbScalingService.js', () => ({
  DbScalingService: jest.fn().mockImplementation(() => ({
    getPoolStats:               mockGetPoolStats,
    runHealthCheck:             mockRunHealthCheck,
    getSlowQueries:             mockGetSlowQueries,
    getIndexUsage:              mockGetIndexUsage,
    getPoolConfig:              mockGetPoolConfig,
    getTableBloat:              mockGetTableBloat,
    getCacheHitRate:            mockGetCacheHitRate,
    getLongRunningTransactions: mockGetLongRunningTransactions,
    getVacuumStats:             mockGetVacuumStats,
    getConnectionBreakdown:     mockGetConnectionBreakdown,
    getDbSettings:              mockGetDbSettings,
    getLockContention:          mockGetLockContention,
    getUnusedIndexes:           mockGetUnusedIndexes,
    getReplicationLag:          mockGetReplicationLag,
    getTableSizes:              mockGetTableSizes,
  })),
}));

afterEach(() => jest.clearAllMocks());

// ─── Part 37: GET /api/v1/db-scaling/connection-breakdown ────────────────────

describe('GET /api/v1/db-scaling/connection-breakdown', () => {
  it('returns 200 with connection groups by state and application', async () => {
    mockGetConnectionBreakdown.mockResolvedValue([
      { state: 'active', applicationName: 'payd-api', count: 5 },
      { state: 'idle',   applicationName: 'payd-api', count: 12 },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/connection-breakdown');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ state: 'active', count: 5 });
  });

  it('returns 200 with empty array when no connections exist', async () => {
    mockGetConnectionBreakdown.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/db-scaling/connection-breakdown');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetConnectionBreakdown.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/connection-breakdown');

    expect(res.status).toBe(500);
  });
});

// ─── Part 37: GET /api/v1/db-scaling/db-settings ───────────────────────────

describe('GET /api/v1/db-scaling/db-settings', () => {
  it('returns 200 with scaling-relevant pg_settings', async () => {
    mockGetDbSettings.mockResolvedValue([
      { name: 'max_connections', setting: '100', unit: null, category: 'Connections and Authentication / Connection Settings' },
      { name: 'shared_buffers',  setting: '16384', unit: '8kB', category: 'Resource Usage / Memory' },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/db-settings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({ name: 'max_connections', setting: '100' });
  });

  it('returns 500 when the service throws', async () => {
    mockGetDbSettings.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/db-settings');

    expect(res.status).toBe(500);
  });
});

// ─── Part 39: GET /api/v1/db-scaling/lock-contention ─────────────────────────

describe('GET /api/v1/db-scaling/lock-contention', () => {
  it('returns 200 with an array of lock-wait rows', async () => {
    mockGetLockContention.mockResolvedValue([
      {
        waitingPid:   1234,
        blockingPid:  5678,
        lockType:     'relation',
        relation:     'employees',
        waitingQuery: 'UPDATE employees SET ...',
        waitDuration: '00:00:05.123',
      },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/lock-contention');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      waitingPid:  1234,
      blockingPid: 5678,
      lockType:    'relation',
      relation:    'employees',
    });
  });

  it('returns 200 with an empty array when no lock waits exist', async () => {
    mockGetLockContention.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/db-scaling/lock-contention');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetLockContention.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/lock-contention');

    expect(res.status).toBe(500);
  });
});

// ─── Part 39: GET /api/v1/db-scaling/unused-indexes ─────────────────────────

describe('GET /api/v1/db-scaling/unused-indexes', () => {
  it('returns 200 with a list of unused indexes', async () => {
    mockGetUnusedIndexes.mockResolvedValue([
      { table: 'transactions', index: 'idx_tx_ref_old', indexSizeBytes: 8192 },
      { table: 'employees',    index: 'idx_emp_dept',   indexSizeBytes: 4096 },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/unused-indexes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      table:          'transactions',
      index:          'idx_tx_ref_old',
      indexSizeBytes: 8192,
    });
  });

  it('returns 200 with empty array when all indexes are used', async () => {
    mockGetUnusedIndexes.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/db-scaling/unused-indexes');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetUnusedIndexes.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/unused-indexes');

    expect(res.status).toBe(500);
  });
});

// ─── Part 40: GET /api/v1/db-scaling/replication-lag ────────────────────────

describe('GET /api/v1/db-scaling/replication-lag', () => {
  it('returns 200 with replication lag rows for each replica', async () => {
    mockGetReplicationLag.mockResolvedValue([
      {
        clientAddr:     '10.0.0.2',
        state:          'streaming',
        sentLsn:        '0/5000000',
        writeLsn:       '0/4FFF000',
        flushLsn:       '0/4FFE000',
        replayLsn:      '0/4FFD000',
        writeLagBytes:  4096,
        flushLagBytes:  8192,
        replayLagBytes: 12288,
      },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/replication-lag');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      clientAddr:     '10.0.0.2',
      state:          'streaming',
      replayLagBytes: 12288,
    });
  });

  it('returns 200 with empty array when no replicas are configured', async () => {
    mockGetReplicationLag.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/db-scaling/replication-lag');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetReplicationLag.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/replication-lag');

    expect(res.status).toBe(500);
  });
});

// ─── Part 40: GET /api/v1/db-scaling/table-sizes ────────────────────────────

describe('GET /api/v1/db-scaling/table-sizes', () => {
  const fakeTables = [
    {
      table:       'transactions',
      totalBytes:  1073741824,
      tableBytes:  536870912,
      indexBytes:  268435456,
      toastBytes:  268435456,
      totalPretty: '1024 MB',
    },
    {
      table:       'employees',
      totalBytes:  52428800,
      tableBytes:  26214400,
      indexBytes:  16777216,
      toastBytes:  9437184,
      totalPretty: '50 MB',
    },
  ];

  it('returns 200 with table size breakdown', async () => {
    mockGetTableSizes.mockResolvedValue(fakeTables);

    const res = await request(app).get('/api/v1/db-scaling/table-sizes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      table:       'transactions',
      totalBytes:  1073741824,
      totalPretty: '1024 MB',
    });
  });

  it('respects the ?limit query parameter', async () => {
    mockGetTableSizes.mockResolvedValue(fakeTables.slice(0, 1));

    const res = await request(app).get('/api/v1/db-scaling/table-sizes?limit=1');

    expect(res.status).toBe(200);
    expect(mockGetTableSizes).toHaveBeenCalledWith(1);
  });

  it('caps limit at 100', async () => {
    mockGetTableSizes.mockResolvedValue([]);

    await request(app).get('/api/v1/db-scaling/table-sizes?limit=999');

    expect(mockGetTableSizes).toHaveBeenCalledWith(100);
  });

  it('returns 400 for a non-numeric limit', async () => {
    const res = await request(app).get('/api/v1/db-scaling/table-sizes?limit=abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the service throws', async () => {
    mockGetTableSizes.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/table-sizes');

    expect(res.status).toBe(500);
  });
});
