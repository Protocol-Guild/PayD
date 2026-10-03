// Run only against a disposable PostgreSQL database, after npm run build and
// the staging image's SQL-copy step. This script initializes its schema/seed.
// RLS_TEST_DATABASE_URL=... STAGING_DB_USER=... STAGING_DB_PASSWORD=... node tests/tenant-rls-postgres.mjs
// --pglite uses the local harness's DATABASE_URL and explicitly sets the test
// role: PGlite's socket adapter ignores startup login credentials. It does not
// establish native PostgreSQL authentication or concurrency coverage.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const wasm = process.argv.includes('--pglite');
const ownerUrl = process.env.RLS_TEST_DATABASE_URL ?? (wasm ? process.env.DATABASE_URL : undefined);
const appUser = process.env.STAGING_DB_USER;
const appPassword = process.env.STAGING_DB_PASSWORD;
assert.ok(ownerUrl && appUser && appPassword, 'Explicit disposable database and test application role are required');
const root = process.env.PAYD_BACKEND_ROOT
  ? pathToFileURL(resolve(process.env.PAYD_BACKEND_ROOT) + sep)
  : new URL('../', import.meta.url);
const ownerConnection = new URL(ownerUrl);
const bootstrap = spawnSync(process.execPath, [fileURLToPath(new URL('staging/bootstrap.mjs', root))], {
  env: {
    ...process.env,
    DATABASE_URL: ownerUrl,
    PGHOST: ownerConnection.hostname,
    PGPORT: ownerConnection.port || '5432',
    STAGING_DB_NAME: decodeURIComponent(ownerConnection.pathname.slice(1)),
    STAGING_DB_ADMIN_USER: decodeURIComponent(ownerConnection.username) || 'postgres',
    STAGING_DB_ADMIN_PASSWORD: decodeURIComponent(ownerConnection.password),
  },
  encoding: 'utf8',
});
if (bootstrap.status !== 0) {
  process.stderr.write(bootstrap.stdout + bootstrap.stderr);
  throw new Error('Disposable database bootstrap failed');
}

const owner = new pg.Client({ connectionString: ownerUrl });
await owner.connect();
const { rows: [own] } = await owner.query("SELECT id FROM organizations WHERE name='Acme Corp' ORDER BY id LIMIT 1");
const { rows: [other] } = await owner.query("INSERT INTO organizations (name) VALUES ('RLS regression second tenant') RETURNING id");
await owner.query("INSERT INTO employees (organization_id,first_name,last_name,email) VALUES ($1,'Other','Tenant','rls-other@example.invalid')", [other.id]);
const { rows: [ownUser] } = await owner.query("INSERT INTO users (email,organization_id,role) VALUES ('rls-owner@example.invalid',$1,'EMPLOYER') RETURNING id", [own.id]);
const { rows: [otherUser] } = await owner.query("INSERT INTO users (email,organization_id,role) VALUES ('rls-other-user@example.invalid',$1,'EMPLOYER') RETURNING id", [other.id]);
await owner.query(`CREATE TABLE rls_transaction_probe (organization_id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  ALTER TABLE rls_transaction_probe ENABLE ROW LEVEL SECURITY;
  ALTER TABLE rls_transaction_probe FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_probe ON rls_transaction_probe
    USING (organization_id=current_tenant_id()) WITH CHECK (organization_id=current_tenant_id());`);
await owner.query("INSERT INTO rls_transaction_probe VALUES ($1,'initial'),($2,'other')", [own.id, other.id]);
await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON rls_transaction_probe TO ${pg.escapeIdentifier(appUser)}`);
await owner.end();

const appUrl = new URL(ownerUrl);
appUrl.username = appUser;
appUrl.password = appPassword;
process.env.DATABASE_URL = appUrl.toString();
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-rls-regression-test-secret';
const { pool, runWithTenantContext } = await import(new URL('dist/config/database.js', root));
// Force reuse and ensure the legacy request-client facade cannot pin the only
// connection while ordinary service queries wait for it.
pool.options.max = 1;
const idleErrors = [];
pool.on('error', (error) => { idleErrors.push(error.message); });
if (wasm) {
  pool.on('connect', (client) => {
    void client.query(`SET ROLE ${pg.escapeIdentifier(appUser)}`).catch(() => {});
  });
}
const scope = (tenant, user, callback) => runWithTenantContext({ tenantId: tenant, userId: user }, callback);
let server;
try {
  const { rows: [role] } = await pool.query('SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user');
  assert.deepEqual(role, { name: appUser, rolsuper: false, rolbypassrls: false });
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM employees')).rows[0].count, 0);
  assert.equal((await scope(own.id, ownUser.id, () => pool.query('SELECT COUNT(*)::int AS count FROM employees'))).rows[0].count, 5);
  const callbackRows = await scope(other.id, otherUser.id, () => new Promise((resolve, reject) => {
    pool.query('SELECT COUNT(*)::int AS count FROM employees', (error, result) => error ? reject(error) : resolve(result.rows));
  }));
  assert.equal(callbackRows[0].count, 1);
  console.log('SQL scoped Promise/callback queries passed');

  await scope(own.id, ownUser.id, async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE rls_transaction_probe SET value='rolled-back'");
      await client.query('ROLLBACK');
      assert.equal((await client.query('SELECT value FROM rls_transaction_probe')).rows[0].value, 'initial');
      console.log('SQL explicit rollback passed');
      await client.query('BEGIN');
      await client.query("UPDATE rls_transaction_probe SET value='committed'");
      await client.query('COMMIT');
      assert.equal((await client.query('SELECT value FROM rls_transaction_probe')).rows[0].value, 'committed');
      console.log('SQL explicit commit passed');
      await client.query('BEGIN');
      // PGlite's socket adapter emits duplicate ReadyForQuery messages after a
      // failed extended-protocol statement followed by Sync. Use simple protocol
      // only for this controlled error fixture in WASM, so a duplicate response
      // cannot falsely complete cleanup. Native PostgreSQL exercises parameters.
      const foreignInsert = "INSERT INTO employees (organization_id,first_name,last_name,email) VALUES ($1,'Wrong','Tenant','rls-wrong@example.invalid')";
      const deniedInsert = wasm
        ? client.query(foreignInsert.replace('$1', `${pg.escapeLiteral(String(other.id))}::integer`))
        : client.query(foreignInsert, [other.id]);
      await assert.rejects(deniedInsert, { code: '42501' });
      console.log('SQL foreign insert rejected');
    } finally {
      const returned = once(pool, 'release');
      // Queue an ordinary base-pool checkout before returning this lease. It
      // owns the same connection but bypasses TenantPool's setup, allowing us
      // to observe cleanup without another checkout clearing the settings.
      const inspectionLease = pg.Pool.prototype.connect.call(pool);
      client.release(); // Must roll back the failed transaction and clear context.
      const [[error, releasedRaw], inspection] = await Promise.all([returned, inspectionLease]);
      try {
        assert.equal(Boolean(error), false);
        assert.equal(inspection, releasedRaw, 'Inspect the released connection, without creating or rebinding one');
        const { rows: [cleared] } = await inspection.query("SELECT current_setting('app.current_tenant_id',true) AS tenant, current_setting('app.current_user_id',true) AS actor");
        assert.deepEqual(cleared, { tenant: '', actor: '' });
        console.log('SQL failed transaction release completed; same checked-out session has empty tenant and actor');
      } finally {
        inspection.release();
      }
      assert.throws(() => client.query('SELECT 1'), /released/);
    }
  });
  assert.equal((await scope(other.id, otherUser.id, () => pool.query('SELECT value FROM rls_transaction_probe'))).rows[0].value, 'other');
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM employees')).rows[0].count, 0);
  console.log('SQL: restricted role; no-context deny; both tenant scopes; callback API; explicit commit/rollback; failed-transaction cleanup; stale lease rejection passed');

  const { default: app } = await import(new URL('dist/app.js', root));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const token = (id, organizationId) => jwt.sign({ id, organizationId, role: 'EMPLOYER' }, process.env.JWT_SECRET);
  const request = async (path, user, tenant, extra = {}) => {
    const response = await fetch(base + path, { headers: { Authorization: `Bearer ${token(user, tenant)}`, ...extra } });
    return { status: response.status, body: await response.json() };
  };
  const first = await request('/api/employees', ownUser.id, own.id);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.length, 5);
  assert.ok(first.body.data.every((employee) => employee.organization_id === own.id));
  const second = await request('/api/employees', otherUser.id, other.id);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.data.length, 1);
  assert.equal(second.body.data[0].organization_id, other.id);
  const foreignHeader = await request('/api/employees', ownUser.id, own.id, { 'x-organization-id': String(other.id) });
  assert.equal(foreignHeader.status, 403);
  const search = await request(`/api/search/organizations/${own.id}/employees`, ownUser.id, own.id);
  assert.equal(search.status, 200, JSON.stringify(search.body));
  const foreignPath = await request(`/api/search/organizations/${other.id}/employees`, ownUser.id, own.id);
  assert.equal(foreignPath.status, 403);
  await pool.query('SELECT 1'); // Drain audit queries queued by completed responses.
  console.log('HTTP: actual employee services returned 5 own/1 other rows; conflicting header/path denied; search RLS middleware works with pool max=1');
  console.log(wasm ? 'Engine: PostgreSQL WASM through PGlite; role selected by test hook; no native auth/concurrency claim' : 'Engine: native PostgreSQL using restricted application login');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
}
assert.deepEqual(idleErrors, [], 'The database transport must complete without idle errors');
process.exit(0);
