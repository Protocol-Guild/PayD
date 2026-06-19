import { tenantQuotaService } from '../services/tenantQuotaService.js';
import { auditIntegrityService } from '../services/auditIntegrityService.js';
import logger from '../utils/logger.js';

/**
 * Persist daily usage snapshots for every active organisation.
 * Designed to run once per day at midnight UTC via setInterval or a cron library.
 *
 * Usage in index.ts / server bootstrap:
 *   scheduleDailyUsageSnapshots();
 *   scheduleNightlyIntegrityCheck();
 */
export function scheduleDailyUsageSnapshots(): NodeJS.Timeout {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Run once immediately on startup (catches any orgs that missed yesterday's snapshot)
  void runDailyUsageSnapshots();

  return setInterval(() => void runDailyUsageSnapshots(), TWENTY_FOUR_HOURS);
}

export function scheduleNightlyIntegrityCheck(): NodeJS.Timeout {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  void runNightlyIntegrityCheck();

  return setInterval(() => void runNightlyIntegrityCheck(), TWENTY_FOUR_HOURS);
}

async function runDailyUsageSnapshots(): Promise<void> {
  logger.info('Starting daily tenant usage snapshot job');
  try {
    await tenantQuotaService.snapshotAllTenants();
    logger.info('Daily tenant usage snapshot job completed');
  } catch (err) {
    logger.error('Daily tenant usage snapshot job failed', { err });
  }
}

async function runNightlyIntegrityCheck(): Promise<void> {
  logger.info('Starting nightly audit log integrity check');
  try {
    await auditIntegrityService.runScheduledCheck();
  } catch (err) {
    logger.error('Nightly audit integrity check failed', { err });
  }
}
