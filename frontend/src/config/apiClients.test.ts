import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('API clients with a separately hosted backend', () => {
  let server: Server;
  let origin: string;
  const requests: Array<{ path: string; authorization: string | undefined }> = [];

  beforeAll(async () => {
    // These paths mirror the distinct mounts in backend/src/app.ts and routes/v1/index.ts.
    // The server supplies fixture responses; no database, signing or payment handler runs.
    const responses: Record<string, unknown> = {
      '/api/schedules': { schedules: [], pagination: { page: 1, limit: 10, total: 0 } },
      '/api/v1/benefits/me/deductions': { success: true, data: { gross_amount: 100 } },
      '/api/v1/forecast': { success: true, data: { monthly: [] } },
      '/api/v1/audit': { data: [], total: 0, page: 1, totalPages: 0 },
      '/api/v1/contracts': { success: true, data: [] },
      '/api/auth/2fa/status': { enabled: false },
      '/webhooks/subscriptions': [],
      '/api/contracts': {
        contracts: [
          {
            contractId: 'C_TEST_CONTRACT',
            network: 'testnet',
            contractType: 'bulk_payment',
            version: '1',
            deployedAt: 1,
          },
        ],
        timestamp: '2026-01-01T00:00:00Z',
        count: 1,
      },
      '/api/events/C_TEST_CONTRACT': { data: [] },
    };
    server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', origin).pathname;
      requests.push({ path, authorization: request.headers.authorization });
      response.setHeader('Content-Type', 'application/json');
      if (!(path in responses)) {
        response.writeHead(404).end(JSON.stringify({ error: `No route: ${path}` }));
        return;
      }
      response.end(JSON.stringify(responses[path]));
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing HTTP test address');
    origin = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    requests.length = 0;
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_BACKEND_URL', '');
    vi.stubGlobal('localStorage', { getItem: () => 'local-test-token' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it.each(['', '/api/', '/api/v1/'])(
    'sends actual axios/fetch requests to the mounted routes with base suffix %s',
    async (suffix) => {
      vi.stubEnv('VITE_API_URL', `${origin}${suffix}`);
      const schedules = await import('../services/scheduleApi');
      const benefits = await import('../services/benefitsApi');
      const forecast = await import('../services/forecastApi');
      const audit = await import('../services/auditApi');
      const upgrades = await import('../services/contractUpgrade');
      const twoFactor = await import('../services/twoFactorApi');
      const webhooks = await import('../services/webhookApi');
      const history = await import('../services/transactionHistory');

      expect((await schedules.getSchedules()).schedules).toEqual([]);
      expect((await benefits.getMyDeductionsDraftPayslip()).gross_amount).toBe(100);
      expect((await forecast.getForecast()).monthly).toEqual([]);
      expect((await audit.fetchAuditLogs()).total).toBe(0);
      expect(await upgrades.fetchContracts()).toEqual([]);
      expect((await twoFactor.fetchTwoFactorStatus()).enabled).toBe(false);
      expect(await webhooks.fetchWebhookSubscriptions()).toEqual([]);
      expect(
        await history.fetchHistoryPage({
          page: 1,
          limit: 10,
          filters: { search: '', status: '', employee: '', asset: '', startDate: '', endDate: '' },
        })
      ).toEqual({
        items: [],
        hasMore: false,
      });

      expect(requests.map(({ path }) => path)).toEqual([
        '/api/schedules',
        '/api/v1/benefits/me/deductions',
        '/api/v1/forecast',
        '/api/v1/audit',
        '/api/v1/contracts',
        '/api/auth/2fa/status',
        '/webhooks/subscriptions',
        '/api/v1/audit',
        '/api/contracts',
        '/api/events/C_TEST_CONTRACT',
      ]);
      for (const path of [
        '/api/v1/benefits/me/deductions',
        '/api/v1/forecast',
        '/api/auth/2fa/status',
        '/webhooks/subscriptions',
      ]) {
        expect(requests.find((request) => request.path === path)?.authorization).toBe(
          'Bearer local-test-token'
        );
      }
    }
  );
});
