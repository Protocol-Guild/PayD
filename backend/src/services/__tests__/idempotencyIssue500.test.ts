import {
  claimKey,
  completeKey,
  IdempotencyConflictError,
} from '../idempotencyService.js';
import { query } from '../../config/database.js';

jest.mock('../../config/database.js');
jest.mock('../../utils/logger.js');

/**
 * Regression tests for issue #500 follow-ups.
 *
 * These target two behaviors that the pre-fix code got wrong:
 *
 * 1. Lost insert race: when two concurrent requests pass the WHERE NOT EXISTS
 *    check, the database's UNIQUE constraint rejects the second INSERT with
 *    Postgres error 23505. claimKey must translate that into
 *    IdempotencyConflictError instead of letting a raw 500 escape.
 * 2. Completion of an expired key: completeKey must not write a response into
 *    a row whose claim has already expired (another request may now own it).
 *
 * Both are simulated at the query-mock level, matching the existing test
 * style in this directory (the unit suite runs without a live Postgres).
 */
describe('issue #500 regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('claimKey lost-race handling', () => {
    it('translates unique violation (23505) into IdempotencyConflictError', async () => {
      // Simulate: our INSERT lost the race against a concurrent claim.
      const pgUniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint "idempotency_keys_organization_id_idempotency_key_key"'), { code: '23505' });
      (query as jest.Mock).mockRejectedValueOnce(pgUniqueViolation);

      await expect(claimKey(1, 'race-key')).rejects.toThrow(IdempotencyConflictError);
    });

    it('does NOT swallow other insert errors', async () => {
      const connectionFailure = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
      (query as jest.Mock).mockRejectedValueOnce(connectionFailure);

      await expect(claimKey(1, 'key-err')).rejects.toThrow(/ECONNREFUSED/);
    });
  });

  describe('completeKey expiry guard', () => {
    it('only completes keys that have not expired', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await completeKey(1, 'expiring-key', 201, { ok: true });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('expires_at > NOW()'),
        [1, 'expiring-key', 201, JSON.stringify({ ok: true })]
      );
    });
  });
});
