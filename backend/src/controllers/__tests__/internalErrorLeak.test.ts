/**
 * Regression tests for issue #495: controllers must not leak internal error
 * details (database messages, table names, SQL fragments) in 500 responses.
 *
 * Uses the real tax routes through a real Express app, with only the database
 * and logger mocked. The failing call is a genuine Postgres-style error whose
 * message contains schema information; production responses must contain none
 * of it.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.setTimeout(30_000);

const mockQuery = jest.fn<any>();

jest.unstable_mockModule('../../config/database.js', () => ({
  query: mockQuery,
  pool: { query: mockQuery },
  default: { query: mockQuery },
}));

const { config } = await import('../../config/env.js');
const taxRoutes = (await import('../../routes/taxRoutes.js')).default;
const { TOKEN_TYPE_ACCESS } = await import('../../services/authService.js');

const app = express();
app.use(express.json());
app.use('/api/taxes', taxRoutes);

/** A DB failure that looks exactly like the leak scenario from #495. */
function pgSchemaError() {
  return new Error(
    'insert into "tax_rules" ("organization_id", "name") returning "id" - relation "tax_rules" does not exist'
  );
}

function adminToken() {
  return jwt.sign(
    { id: 1, role: 'ADMIN', organizationId: 7, typ: TOKEN_TYPE_ACCESS },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('error detail leakage (#495)', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    mockQuery.mockReset();
  });

  it('500 responses never echo database/schema details to the client', async () => {
    mockQuery.mockRejectedValueOnce(pgSchemaError());

    const res = await request(app)
      .post('/api/taxes/rules')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ organization_id: 7, name: 'VAT', type: 'percentage', value: 5 });

    expect(res.status).toBe(500);
    const body = JSON.stringify(res.body);
    // None of the Postgres error text may reach the client.
    expect(body).not.toContain('tax_rules');
    expect(body).not.toContain('relation');
    expect(body).not.toContain('insert into');
  });

  it('logs the full error server-side instead of exposing it', async () => {
    mockQuery.mockRejectedValueOnce(pgSchemaError());

    await request(app)
      .post('/api/taxes/rules')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ organization_id: 7, name: 'VAT', type: 'percentage', value: 5 });

    const logged = consoleSpy.mock.calls.flat().join('\n');
    expect(logged).toContain('tax_rules');
  });
});
