import { EventEmitter, once } from 'node:events';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requestTimeoutMiddleware } from '../requestTimeout.js';

const scheduleTimeout = setTimeout;
const cancelTimeout = clearTimeout;

function mount(path: string) {
  const response = Object.assign(new EventEmitter(), {
    headersSent: false,
    status: jest.fn(),
    json: jest.fn(),
    destroy: jest.fn(),
    setHeader: jest.fn(),
  });
  response.status.mockReturnValue(response);
  const next = jest.fn();

  requestTimeoutMiddleware(
    { path } as Request,
    response as unknown as Response,
    next as NextFunction
  );

  expect(next).toHaveBeenCalledTimes(1);
  return response;
}

describe('requestTimeoutMiddleware', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns a clear 504 after 30 seconds on a regular route', () => {
    const response = mount('/api/employees');

    jest.advanceTimersByTime(29_999);
    expect(response.status).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(response.status).toHaveBeenCalledWith(504);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Gateway Timeout',
      message: 'Request exceeded the 30s timeout',
    });
  });

  it('allows 120 seconds for a bulk route', () => {
    const response = mount('/api/payroll/bulk');

    jest.advanceTimersByTime(30_000);
    expect(response.status).not.toHaveBeenCalled();
    jest.advanceTimersByTime(90_000);
    expect(response.status).toHaveBeenCalledWith(504);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Gateway Timeout',
      message: 'Request exceeded the 120s timeout',
    });
  });

  it.each(['finish', 'close'])('clears the timer on %s', (event) => {
    const response = mount('/api/employees');
    response.emit(event);

    jest.advanceTimersByTime(30_000);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.destroy).not.toHaveBeenCalled();
  });

  it('closes a response that already started streaming', () => {
    const response = mount('/api/export');
    response.headersSent = true;

    jest.advanceTimersByTime(120_000);
    expect(response.destroy).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });
});

it('flushes the 504 and closes a connection with an incomplete request body', async () => {
  // Keep socket I/O real while advancing only the middleware's deadline.
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  const app = express();
  let incoming: Request | undefined;
  let bodyStarted: () => void = () => {};
  const bodyReceived = new Promise<void>((resolve) => {
    bodyStarted = resolve;
  });
  const handler = jest.fn((_req: Request, res: Response) => res.json({ success: true }));
  const errors: Error[] = [];
  app.use((req, _res, next) => {
    incoming = req;
    req.once('data', bodyStarted);
    next();
  });
  app.use(requestTimeoutMiddleware);
  app.use(express.json());
  app.post('/api/employees', handler);
  app.use((error: Error, _req: Request, _res: Response, _next: NextFunction) => {
    errors.push(error);
  });

  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  const client = createConnection(address.port, '127.0.0.1');
  let response = '';
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  client.setEncoding('utf8');
  client.on('data', (chunk) => {
    response += chunk;
  });
  const closed = once(client, 'close').then(() => true);

  try {
    await once(client, 'connect');
    const body = JSON.stringify({ employee: 'late body' });
    client.write(
      'POST /api/employees HTTP/1.1\r\n' +
        'Host: localhost\r\n' +
        'Content-Type: application/json\r\n' +
        `Content-Length: ${Buffer.byteLength(body)}\r\n` +
        'Connection: keep-alive\r\n\r\n' +
        body.slice(0, 1)
    );
    await bodyReceived;
    expect(incoming?.complete).toBe(false);
    jest.advanceTimersByTime(30_000);

    const closedPromptly = await Promise.race([
      closed,
      new Promise<boolean>((resolve) => {
        watchdog = scheduleTimeout(() => resolve(false), 1000);
      }),
    ]);
    expect(closedPromptly).toBe(true);
    expect(response).toMatch(/^HTTP\/1\.1 504 Gateway Timeout\r\n/);
    expect(response).toMatch(/\r\nConnection: close\r\n/i);
    expect(JSON.parse(response.split('\r\n\r\n')[1] ?? '')).toEqual({
      error: 'Gateway Timeout',
      message: 'Request exceeded the 30s timeout',
    });
    expect(incoming?.socket.destroyed).toBe(true);
    expect(incoming?.destroyed).toBe(true);
    expect(errors).toEqual([expect.objectContaining({ type: 'request.aborted' })]);
    expect(handler).not.toHaveBeenCalled();
  } finally {
    cancelTimeout(watchdog);
    client.destroy();
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
    jest.useRealTimers();
  }
});
