import { createServer, type Server as HttpServer } from 'node:http';
import { io as connect } from 'socket.io-client';
import type { Server as SocketServer } from 'socket.io';

describe('Socket.IO origin policy', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCorsOrigin = process.env.CORS_ORIGIN;
  let httpServer: HttpServer;
  let socketServer: SocketServer;
  let url: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://payd.example, https://admin.payd.example';
    const { initializeSocket } = await import('../socketService.js');
    httpServer = createServer();
    socketServer = initializeSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (socketServer) await new Promise<void>((resolve) => socketServer.close(() => resolve()));
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = originalCorsOrigin;
  });

  const canConnect = (transport: 'websocket' | 'polling', origin?: string): Promise<boolean> =>
    new Promise((resolve) => {
      const client = connect(url, {
        transports: [transport],
        extraHeaders: origin === undefined ? undefined : { Origin: origin },
        reconnection: false,
        timeout: 1500,
        forceNew: true,
        autoConnect: false,
      });
      client.once('connect', () => {
        client.disconnect();
        resolve(true);
      });
      client.once('connect_error', () => {
        client.disconnect();
        resolve(false);
      });
      client.connect();
    });

  describe.each(['websocket', 'polling'] as const)('%s handshakes', (transport) => {
    it.each(['https://payd.example', 'https://admin.payd.example'])('accepts configured origin %s', async (origin) => {
      expect(await canConnect(transport, origin)).toBe(true);
    });

    it('rejects an unlisted origin', async () => {
      expect(await canConnect(transport, 'https://unlisted.example')).toBe(false);
    });

    it('preserves non-browser clients without an Origin header', async () => {
      expect(await canConnect(transport)).toBe(true);
    });
  });

  it('preserves credentialed preflight for an allowed origin', async () => {
    const response = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://payd.example',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://payd.example');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
