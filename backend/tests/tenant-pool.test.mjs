// Run after npm run build: node --test tests/tenant-pool.test.mjs
// These tests exercise the compiled wrapper and inherited pg-pool.query. The
// controlled transport models checkout/query ordering, not PostgreSQL SQL or
// native connection concurrency; those need separate database integration tests.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, test } from 'node:test';
import { Pool } from 'pg';
import { TenantPool, runWithTenantContext } from '../dist/config/database.js';

const READ_CONTEXT = `SELECT
  current_setting('app.current_tenant_id', true) AS tenant_id,
  current_setting('app.current_user_id', true) AS user_id`;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function assignments(operation) {
  return [...operation.text.matchAll(
    /\bset_config\(\s*'([^']+)'\s*,\s*\$(\d+)\s*,\s*(true|false)\s*\)/gi,
  )].map((match) => ({
    name: match[1],
    value: String(operation.values[Number(match[2]) - 1]),
    local: match[3].toLowerCase() === 'true',
  }));
}

function isContextWrite(operation) {
  return assignments(operation).length > 0;
}

function isReset(operation) {
  const settings = assignments(operation);
  return settings.length > 0 && settings.every(({ value }) => value === '');
}

class FakeClient extends EventEmitter {
  constructor(id) {
    super();
    this.id = id;
    this.settings = new Map();
    this.localSettings = new Map();
    this.inTransaction = false;
    this.committedValues = [];
    this.pendingValues = [];
    this.operations = [];
    this.failures = [];
    this.gates = [];
    this.destroyed = false;
    this.tail = Promise.resolve();
  }

  get context() {
    const setting = (name) => this.localSettings.get(name) ?? this.settings.get(name) ?? '';
    return {
      tenant_id: setting('app.current_tenant_id'),
      user_id: setting('app.current_user_id'),
    };
  }

  failNext(matches, error) {
    this.failures.push({ matches, error });
  }

  blockNext(matches) {
    const entered = deferred();
    const gate = deferred();
    this.gates.push({ matches, entered, gate });
    return { entered: entered.promise, resume: gate.resolve };
  }

  // pg clients support both Promise and callback query APIs and serialize work
  // on a physical connection. Keep both behaviors in the transport substitute.
  query(textOrConfig, values, callback) {
    if (typeof values === 'function') {
      callback = values;
      values = undefined;
    }
    const operation = {
      text: typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text,
      values: [...(values ?? textOrConfig.values ?? [])],
    };
    const result = this.tail.then(() => this.execute(operation));
    this.tail = result.catch(() => {});
    if (callback) {
      void result.then((value) => callback(undefined, value), (error) => callback(error));
      return undefined;
    }
    return result;
  }

  async execute(operation) {
    if (this.destroyed) throw new Error('Transport connection is destroyed');
    this.operations.push(operation);

    const gateIndex = this.gates.findIndex(({ matches }) => matches(operation));
    if (gateIndex !== -1) {
      const { entered, gate } = this.gates.splice(gateIndex, 1)[0];
      entered.resolve(operation);
      await gate.promise;
    }
    const failureIndex = this.failures.findIndex(({ matches }) => matches(operation));
    if (failureIndex !== -1) throw this.failures.splice(failureIndex, 1)[0].error;

    const result = { rows: [], rowCount: 0, fields: [] };
    const settings = assignments(operation);
    if (settings.length) {
      for (const { name, value, local } of settings) {
        if (!local) this.settings.set(name, value);
        else if (this.inTransaction) this.localSettings.set(name, value);
      }
    } else if (/^\s*BEGIN\b/i.test(operation.text)) {
      assert.equal(this.inTransaction, false, 'The wrapper must not nest an implicit transaction');
      this.inTransaction = true;
      this.settingsBeforeTransaction = new Map(this.settings);
      this.pendingValues = [];
    } else if (/^\s*COMMIT\b/i.test(operation.text)) {
      this.committedValues.push(...this.pendingValues);
      this.pendingValues = [];
      this.localSettings.clear();
      this.inTransaction = false;
    } else if (/^\s*ROLLBACK\b/i.test(operation.text)) {
      if (this.inTransaction) this.settings = new Map(this.settingsBeforeTransaction);
      this.pendingValues = [];
      this.localSettings.clear();
      this.inTransaction = false;
    } else if (/\bcurrent_setting\s*\(/i.test(operation.text)) {
      result.rows = [{ ...this.context }];
      result.rowCount = 1;
    } else if (/^\s*INSERT INTO lifecycle_values\b/i.test(operation.text)) {
      (this.inTransaction ? this.pendingValues : this.committedValues).push(operation.values[0]);
      result.rowCount = 1;
    } else {
      throw new Error(`Unsupported test transport query: ${operation.text}`);
    }
    return result;
  }
}

class FakeTransport extends EventEmitter {
  constructor() {
    super();
    this.clients = [new FakeClient(1)];
    this.idle = this.clients[0];
    this.busy = undefined;
    this.pending = [];
    this.releases = [];
  }

  connect(callback) {
    const connection = deferred();
    this.pending.push(connection);
    this.drain();
    if (callback) {
      void connection.promise.then(
        (client) => callback(undefined, client, client.release),
        (error) => callback(error, undefined, () => {}),
      );
      return undefined;
    }
    return connection.promise;
  }

  drain() {
    if (this.busy || this.pending.length === 0) return;
    const client = this.idle ?? new FakeClient(this.clients.length + 1);
    if (!this.idle) this.clients.push(client);
    this.idle = undefined;
    this.busy = client;
    let released = false;
    // Real pg-pool installs a new one-shot release closure on every checkout.
    client.release = (error) => {
      assert.equal(released, false, 'Raw connection was released twice');
      assert.equal(this.busy, client, 'A stale release reached another checkout');
      released = true;
      this.releases.push({ client, error, context: { ...client.context }, inTransaction: client.inTransaction });
      this.busy = undefined;
      if (error) client.destroyed = true;
      else this.idle = client;
      this.emit('release');
      // Deliberately resolve queued acquisitions in the releasing caller's
      // execution context. Tenant identity must belong to the requester.
      this.drain();
    };
    this.pending.shift().resolve(client);
  }

  waitForReleases(count) {
    if (this.releases.length >= count) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this.releases.length < count) return;
        this.removeListener('release', check);
        resolve();
      };
      this.on('release', check);
    });
  }
}

function fixture(t) {
  const transport = new FakeTransport();
  const descriptor = Object.getOwnPropertyDescriptor(Pool.prototype, 'connect');
  const pool = new TenantPool({ max: 1 });
  // Leave Pool.query completely untouched: its callback-based connect/query,
  // error-listener management, and release behavior are part of each test.
  Object.defineProperty(Pool.prototype, 'connect', {
    configurable: true,
    writable: true,
    value(callback) {
      assert.equal(this, pool, 'Unexpected pool tried to use the test transport');
      return transport.connect(callback);
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(Pool.prototype, 'connect', descriptor);
    else delete Pool.prototype.connect;
  });
  return { pool, transport, raw: transport.clients[0] };
}

async function readContext(client) {
  return (await client.query(READ_CONTEXT)).rows[0];
}

function callbackQuery(pool, withValues) {
  return new Promise((resolve, reject) => {
    const callback = (error, result) => error ? reject(error) : resolve(result);
    const returned = withValues
      ? pool.query(READ_CONTEXT, [], callback)
      : pool.query(READ_CONTEXT, callback);
    assert.equal(returned, undefined, 'Callback query must retain the pg API return value');
  });
}

describe('TenantPool lifecycle with a controlled pg transport', { concurrency: false, timeout: 5000 }, () => {
  test('inherited pool.query preserves Promise, QueryConfig, and both callback APIs', async (t) => {
    const { pool, transport, raw } = fixture(t);
    const queries = [
      () => pool.query(READ_CONTEXT),
      () => pool.query({ text: READ_CONTEXT, values: [] }),
      () => callbackQuery(pool, false),
      () => callbackQuery(pool, true),
    ];
    for (const [index, execute] of queries.entries()) {
      const tenantId = 101 + index;
      const userId = 1001 + index;
      const result = await runWithTenantContext({ tenantId, userId }, execute);
      assert.deepEqual(result.rows[0], { tenant_id: String(tenantId), user_id: String(userId) });
    }
    assert.deepEqual(await readContext(pool), { tenant_id: '', user_id: '' });
    await transport.waitForReleases(queries.length + 1);
    assert.equal(transport.clients.length, 1, 'Successful checkouts should reuse the physical connection');
    assert.deepEqual(raw.context, { tenant_id: '', user_id: '' });
    assert.equal(raw.listenerCount('error'), 0, 'Query/setup/cleanup error listeners must be removed');
  });

  test('connect callback receives its lease and done(error) destroys exactly that checkout', async (t) => {
    const { pool, transport, raw } = fixture(t);
    const connected = deferred();
    let callbacks = 0;
    const returned = runWithTenantContext({ tenantId: 21, userId: 201 }, () => pool.connect((error, client, done) => {
      callbacks++;
      if (error) connected.reject(error);
      else connected.resolve({ client, done });
    }));
    assert.equal(returned, undefined);
    const { client, done } = await connected.promise;
    assert.equal(callbacks, 1);
    assert.equal(done, client.release);
    const listener = () => {};
    assert.equal(client.once('probe', listener), client, 'EventEmitter chaining must not expose the raw client');
    client.removeListener('probe', listener);
    assert.deepEqual(await readContext(client), { tenant_id: '21', user_id: '201' });
    const failure = new Error('Discard this connection');
    done(failure);
    await transport.waitForReleases(1);
    assert.equal(transport.releases[0].error, failure);
    assert.equal(raw.destroyed, true);
    assert.throws(() => done(), /already.*released/i);
    const replacement = await runWithTenantContext({ tenantId: 22 }, () => pool.connect());
    assert.equal(transport.clients.length, 2);
    assert.deepEqual(await readContext(replacement), { tenant_id: '22', user_id: '' });
    replacement.release();
    await transport.waitForReleases(2);
  });

  test('queued checkouts retain each requesting tenant and an immutable context snapshot', async (t) => {
    const { pool, transport } = fixture(t);
    const first = await runWithTenantContext({ tenantId: 31, userId: 301 }, () => pool.connect());
    const secondContext = { tenantId: 32, userId: 302 };
    const secondConnection = runWithTenantContext(secondContext, () => pool.connect());
    const thirdConnection = runWithTenantContext({ tenantId: 33, userId: 303 }, () => pool.connect());
    secondContext.tenantId = 999;
    secondContext.userId = 999;
    assert.equal(transport.pending.length, 2);
    runWithTenantContext({ tenantId: 99, userId: 909 }, () => first.release());
    const second = await secondConnection;
    assert.deepEqual(await readContext(second), { tenant_id: '32', user_id: '302' });
    second.release();
    const third = await thirdConnection;
    assert.deepEqual(await readContext(third), { tenant_id: '33', user_id: '303' });
    third.release();
    await transport.waitForReleases(3);
    assert.equal(transport.clients.length, 1);
  });

  test('reset must complete before the raw connection can satisfy a queued checkout', async (t) => {
    const { pool, transport, raw } = fixture(t);
    const first = await runWithTenantContext({ tenantId: 41, userId: 401 }, () => pool.connect());
    const reset = raw.blockNext(isReset);
    first.release();
    await reset.entered;
    const nextConnection = runWithTenantContext({ tenantId: 42, userId: 402 }, () => pool.connect());
    let nextSettled = false;
    void nextConnection.then(() => { nextSettled = true; });
    await Promise.resolve();
    assert.equal(nextSettled, false);
    assert.equal(transport.pending.length, 1);
    assert.equal(transport.releases.length, 0);
    assert.deepEqual(raw.context, { tenant_id: '41', user_id: '401' });
    reset.resume();
    const next = await nextConnection;
    assert.deepEqual(transport.releases[0].context, { tenant_id: '', user_id: '' });
    assert.equal(transport.releases[0].inTransaction, false);
    assert.deepEqual(await readContext(next), { tenant_id: '42', user_id: '402' });
    next.release();
    await transport.waitForReleases(2);
  });

  test('setup failure rejects the Promise and destroys the uninitialized connection', async (t) => {
    const { pool, transport, raw } = fixture(t);
    const failure = new Error('Context setup failed');
    raw.failNext(isContextWrite, failure);
    await assert.rejects(runWithTenantContext({ tenantId: 51 }, () => pool.connect()), (error) => error === failure);
    assert.equal(transport.releases.length, 1);
    assert.equal(transport.releases[0].error, failure);
    assert.equal(raw.destroyed, true);
    assert.equal(raw.listenerCount('error'), 0);
    const replacement = await runWithTenantContext({ tenantId: 52, userId: 502 }, () => pool.connect());
    assert.equal(transport.clients.length, 2);
    assert.deepEqual(await readContext(replacement), { tenant_id: '52', user_id: '502' });
    replacement.release();
    await transport.waitForReleases(2);
  });

  test('setup failure calls the connect callback once with no usable client', async (t) => {
    const { pool, transport, raw } = fixture(t);
    const failure = new Error('Callback context setup failed');
    raw.failNext(isContextWrite, failure);
    const connected = deferred();
    let callbacks = 0;
    const returned = runWithTenantContext({ tenantId: 61 }, () => pool.connect((error, client, done) => {
      callbacks++;
      connected.resolve({ error, client, done });
    }));
    assert.equal(returned, undefined);
    const { error, client, done } = await connected.promise;
    assert.equal(error, failure);
    assert.equal(client, undefined);
    assert.equal(typeof done, 'function');
    assert.doesNotThrow(() => done());
    assert.equal(callbacks, 1);
    assert.equal(transport.releases.length, 1);
    assert.equal(transport.releases[0].error, failure);
    assert.equal(raw.destroyed, true);
  });

  for (const [name, matches] of [
    ['rollback', (operation) => /^\s*ROLLBACK\b/i.test(operation.text)],
    ['session reset', isReset],
  ]) {
    test(`${name} failure during release destroys the connection before replacement`, async (t) => {
      const { pool, transport, raw } = fixture(t);
      const first = await runWithTenantContext({ tenantId: 71, userId: 701 }, () => pool.connect());
      const failure = new Error(`${name} failed`);
      raw.failNext(matches, failure);
      const nextConnection = runWithTenantContext({ tenantId: 72, userId: 702 }, () => pool.connect());
      first.release();
      const next = await nextConnection;
      assert.equal(transport.releases.length, 1);
      assert.equal(transport.releases[0].error, failure);
      assert.equal(raw.destroyed, true);
      assert.equal(transport.clients.length, 2);
      assert.equal(raw.listenerCount('error'), 0);
      assert.deepEqual(await readContext(next), { tenant_id: '72', user_id: '702' });
      next.release();
      await transport.waitForReleases(2);
    });
  }

  test('stale leases and previously captured methods cannot affect the next checkout', async (t) => {
    const { pool, transport, raw } = fixture(t);
    const first = await runWithTenantContext({ tenantId: 81, userId: 801 }, () => pool.connect());
    const staleQuery = first.query;
    const staleRelease = first.release;
    first.release();
    const second = await runWithTenantContext({ tenantId: 82, userId: 802 }, () => pool.connect());
    assert.notEqual(first, second);
    assert.equal(transport.clients.length, 1, 'The stale lease must reference the same reused raw connection');
    const operationCount = raw.operations.length;
    assert.throws(() => first.query(READ_CONTEXT), /released/i);
    assert.throws(() => staleQuery(READ_CONTEXT), /released/i);
    assert.throws(() => first.release(), /already.*released/i);
    assert.throws(() => staleRelease(new Error('Stale caller')), /already.*released/i);
    assert.equal(raw.operations.length, operationCount);
    assert.equal(transport.releases.length, 1);
    assert.equal(raw.destroyed, false);
    assert.deepEqual(await readContext(second), { tenant_id: '82', user_id: '802' });
    second.release();
    await transport.waitForReleases(2);
  });

  test('explicit transactions remain caller-owned and abandoned work rolls back on release', async (t) => {
    const { pool, transport, raw } = fixture(t);
    const client = await runWithTenantContext({ tenantId: 91, userId: 901 }, () => pool.connect());
    assert.equal(raw.inTransaction, false, 'Checkout must not begin an implicit transaction');
    await client.query('BEGIN');
    await client.query('INSERT INTO lifecycle_values(value) VALUES ($1)', ['committed']);
    assert.equal(raw.inTransaction, true);
    assert.deepEqual(raw.committedValues, [], 'The wrapper must not commit caller work');
    await client.query('COMMIT');
    assert.equal(raw.inTransaction, false);
    assert.deepEqual(raw.committedValues, ['committed']);
    assert.deepEqual(await readContext(client), { tenant_id: '91', user_id: '901' });

    await client.query('BEGIN');
    await client.query('INSERT INTO lifecycle_values(value) VALUES ($1)', ['rolled back']);
    await client.query('ROLLBACK');
    assert.equal(raw.inTransaction, false);
    assert.deepEqual(raw.committedValues, ['committed']);
    assert.deepEqual(await readContext(client), { tenant_id: '91', user_id: '901' });

    await client.query('BEGIN');
    await client.query('INSERT INTO lifecycle_values(value) VALUES ($1)', ['abandoned']);
    client.release();
    await transport.waitForReleases(1);
    assert.equal(raw.inTransaction, false);
    assert.deepEqual(raw.committedValues, ['committed']);
    assert.deepEqual(raw.pendingValues, []);
    assert.deepEqual(raw.context, { tenant_id: '', user_id: '' });
    assert.equal(raw.operations.filter(({ text }) => /^\s*BEGIN\b/i.test(text)).length, 3);
    assert.equal(raw.operations.filter(({ text }) => /^\s*COMMIT\b/i.test(text)).length, 1);
  });
});
