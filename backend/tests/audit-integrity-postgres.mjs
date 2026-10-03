// Run after npm run build against a fresh disposable PostgreSQL database:
// AUDIT_TEST_DATABASE_URL=... STAGING_DB_USER=... STAGING_DB_PASSWORD=...
// node tests/audit-integrity-postgres.mjs
// --pglite accepts the local harness's DATABASE_URL; it does not establish
// native PostgreSQL authentication or concurrent-session coverage.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const wasm = process.argv.includes('--pglite');
const ownerUrl = process.env.AUDIT_TEST_DATABASE_URL ?? (wasm ? process.env.DATABASE_URL : undefined);
assert.ok(ownerUrl && process.env.STAGING_DB_USER && process.env.STAGING_DB_PASSWORD,
  'An explicit disposable owner database and separate staging application role are required');
const ownerConnection = new URL(ownerUrl);
const preflight = new pg.Client({ connectionString: ownerUrl });
await preflight.connect();
try {
  const { rows: [existing] } = await preflight.query("SELECT to_regclass('public.api_audit_logs') AS audit_table");
  assert.equal(existing.audit_table, null, 'Use a fresh disposable database; existing audit data is not modified');
} finally {
  await preflight.end();
}

const bootstrap = spawnSync(process.execPath, [fileURLToPath(new URL('../staging/bootstrap.mjs', import.meta.url))], {
  env: {
    ...process.env,
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
  throw new Error('Disposable audit database bootstrap failed');
}

process.env.DATABASE_URL = ownerUrl;
const { pool } = await import('../dist/config/database.js');
const { auditIntegrityService } = await import('../dist/services/auditIntegrityService.js');
pool.options.max = 1;
const transportErrors = [];
pool.on('error', error => transportErrors.push(error.message));

const timestamps = [
  '2026-10-03 08:00:00',
  '2026-10-03 08:00:00.1',
  '2026-10-03 08:00:00.120000',
  '2026-10-03 08:00:00.123',
  '2026-10-03 08:00:00.123456',
  '2026-10-03 08:00:00.000001',
];

try {
  const { rows: [counts] } = await pool.query('SELECT COUNT(*)::int AS count FROM api_audit_logs');
  assert.equal(counts.count, 0);
  const rows = [];
  for (const timestamp of timestamps) {
    const { rows: [row] } = await pool.query(`
      INSERT INTO api_audit_logs (action, resource, method, path, response_status, created_at)
      VALUES ('read', 'audit-fixture', 'GET', '/audit-fixture', 200, $1::timestamp)
      RETURNING id, created_at::text AS timestamp, row_hash, chain_hash`, [timestamp]);
    assert.match(row.row_hash, /^[a-f0-9]{64}$/);
    rows.push(row);
  }
  assert.equal(rows[4].timestamp, timestamps[4]);
  assert.equal(rows[5].timestamp, timestamps[5]);

  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'America/New_York']) {
      process.env.TZ = timezone;
      const result = await auditIntegrityService.verifyIntegrity();
      assert.equal(result.passed, true, `Unchanged trigger-created rows must verify in ${timezone}: ${JSON.stringify(result)}`);
      assert.equal(result.checkedRows, timestamps.length);
      assert.equal(result.totalRows, timestamps.length);
      console.log(`Verified ${timestamps.length} actual PostgreSQL timestamp representations in ${timezone}`);
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
  const { rows: afterVerification } = await pool.query('SELECT id, created_at::text AS timestamp, row_hash, chain_hash FROM api_audit_logs ORDER BY id');
  assert.deepEqual(afterVerification, rows, 'Verification must preserve every stored timestamp and hash');

  // Deliberate privileged corruption applies only to this fresh fixture database.
  // Restore the append-only guard immediately before asking the service to check.
  const alterFixture = async (sql, params) => {
    const client = await pool.connect();
    try {
      await client.query('ALTER TABLE api_audit_logs DISABLE TRIGGER trg_deny_audit_update');
      try {
        await client.query(sql, params);
      } finally {
        await client.query('ALTER TABLE api_audit_logs ENABLE TRIGGER trg_deny_audit_update');
      }
    } finally {
      client.release();
    }
  };
  await alterFixture("UPDATE api_audit_logs SET path='/changed-fixture' WHERE id=$1", [rows[4].id]);
  const changedRow = await auditIntegrityService.verifyIntegrity();
  assert.equal(changedRow.passed, false);
  assert.equal(changedRow.brokenAt, rows[4].id);
  await alterFixture("UPDATE api_audit_logs SET path='/audit-fixture' WHERE id=$1", [rows[4].id]);
  assert.equal((await auditIntegrityService.verifyIntegrity()).passed, true);
  await alterFixture('UPDATE api_audit_logs SET chain_hash=$1 WHERE id=$2', ['f'.repeat(64), rows[5].id]);
  const changedChain = await auditIntegrityService.verifyIntegrity();
  assert.equal(changedChain.passed, false);
  assert.equal(changedChain.brokenAt, rows[5].id);
  console.log('Altered immutable data and an altered chain hash both remain detectable; verification itself changed no data');
  console.log(wasm ? 'Engine: PostgreSQL WASM through PGlite; no native auth/concurrency claim' : 'Engine: native PostgreSQL');
} finally {
  await pool.end();
}
assert.deepEqual(transportErrors, []);
