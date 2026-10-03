import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversionPath, PathfindRequest } from './crossAssetPayment';

describe('cross-asset quotes from the configured backend', () => {
  let server: Server;
  let origin: string;
  let statusCode: number;
  let responseBody: string;
  let delayResponse: boolean;
  let requestStarted: () => void;
  const requested: Array<{ method: string | undefined; path: string | undefined; body: string }> =
    [];
  const request: PathfindRequest = { fromAsset: 'USDC', toAsset: 'XLM', amount: 10 };
  const quote: ConversionPath = {
    id: 'provider-route-1',
    sourceAsset: 'USDC',
    destinationAsset: 'XLM',
    rate: 2,
    fee: 0,
    slippage: 0.1,
    estimatedDestinationAmount: 20,
    hops: ['USDC', 'XLM'],
  };

  beforeAll(async () => {
    // Fixture responses exercise real HTTP and client parsing. No quote provider,
    // simulation, wallet or transaction-submission endpoint runs here.
    server = createServer(async (incoming, response) => {
      let body = '';
      for await (const chunk of incoming) body += chunk.toString();
      requested.push({ method: incoming.method, path: incoming.url, body });
      requestStarted();
      if (delayResponse) return;
      response.writeHead(statusCode, { 'Content-Type': 'application/json' }).end(responseBody);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing local HTTP address');
    origin = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    statusCode = 200;
    responseBody = JSON.stringify({ paths: [quote] });
    delayResponse = false;
    requestStarted = () => {};
    requested.length = 0;
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', origin);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('returns only the provider quote and sends the current request', async () => {
    const { fetchConversionPaths } = await import('./crossAssetPayment');
    expect(await fetchConversionPaths(request)).toEqual([quote]);
    expect(requested).toEqual([
      {
        method: 'POST',
        path: '/api/v1/payments/pathfind',
        body: JSON.stringify(request),
      },
    ]);
  });

  it.each([401, 404, 503])(
    'rejects HTTP %s instead of inventing exchange rates',
    async (status) => {
      statusCode = status;
      const { fetchConversionPaths } = await import('./crossAssetPayment');
      await expect(fetchConversionPaths(request)).rejects.toThrow(`(${status})`);
    }
  );

  it('preserves an actual empty route set', async () => {
    responseBody = JSON.stringify({ paths: [] });
    const { fetchConversionPaths } = await import('./crossAssetPayment');
    expect(await fetchConversionPaths(request)).toEqual([]);
  });

  it.each([
    ['invalid JSON', '<html>backend unavailable</html>'],
    ['missing paths', JSON.stringify({})],
    ['non-array paths', JSON.stringify({ paths: 'not a path list' })],
    ['null path', JSON.stringify({ paths: [null] })],
    ['non-numeric rate', JSON.stringify({ paths: [{ ...quote, rate: '2' }] })],
    [
      'overflowing numeric rate',
      JSON.stringify({ paths: [{ ...quote, rate: 'overflow' }] }).replace('"overflow"', '1e400'),
    ],
    ['negative fee', JSON.stringify({ paths: [{ ...quote, fee: -1 }] })],
    ['wrong asset pair', JSON.stringify({ paths: [{ ...quote, destinationAsset: 'NGN' }] })],
    ['invalid hops', JSON.stringify({ paths: [{ ...quote, hops: [null] }] })],
    ['duplicate identifiers', JSON.stringify({ paths: [quote, quote] })],
  ])('rejects %s without a selectable fallback', async (_name, body) => {
    responseBody = body;
    const { fetchConversionPaths } = await import('./crossAssetPayment');
    await expect(fetchConversionPaths(request)).rejects.toThrow();
  });

  it('propagates a network failure', async () => {
    const unreachable = createServer();
    await new Promise<void>((resolve) => unreachable.listen(0, '127.0.0.1', resolve));
    const address = unreachable.address();
    if (!address || typeof address === 'string') throw new Error('Missing unused HTTP address');
    await new Promise<void>((resolve, reject) => {
      unreachable.close((error) => (error ? reject(error) : resolve()));
    });
    vi.stubEnv('VITE_API_URL', `http://127.0.0.1:${address.port}`);
    const { fetchConversionPaths } = await import('./crossAssetPayment');
    await expect(fetchConversionPaths(request)).rejects.toThrow();
  });

  it('aborts an in-flight HTTP request without manufacturing replacement paths', async () => {
    delayResponse = true;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const controller = new AbortController();
    const { fetchConversionPaths } = await import('./crossAssetPayment');
    const pending = fetchConversionPaths(request, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await started;
    controller.abort();
    await rejected;
  });
});
