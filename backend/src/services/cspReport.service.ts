import logger from '../utils/logger.js';

export interface CspViolation {
  documentUri: string;
  violatedDirective: string;
  blockedUri: string;
  sourceFile: string;
  lineNumber: number;
  receivedAt: string;
}

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const MAX_STORED_VIOLATIONS = 500;

// In-memory structured store for the violations dashboard/log-aggregation
// endpoint. A single process-local ring buffer is sufficient for the scope of
// this issue (out of scope: real-time alerting, third-party report services).
const violations: CspViolation[] = [];

// directive|blockedUri -> last-seen timestamp (ms), for de-duplication.
const lastSeenByFingerprint = new Map<string, number>();

function fingerprint(violatedDirective: string, blockedUri: string): string {
  return `${violatedDirective}|${blockedUri}`;
}

/** True if an identical (directive, blocked-uri) pair was recorded within the last 5 minutes. */
function isDuplicate(violatedDirective: string, blockedUri: string, now: number): boolean {
  const key = fingerprint(violatedDirective, blockedUri);
  const lastSeen = lastSeenByFingerprint.get(key);
  return lastSeen !== undefined && now - lastSeen < DEDUPE_WINDOW_MS;
}

/**
 * Records a CSP violation report: logs it with full context and stores it in
 * the queryable in-memory buffer, unless it duplicates a (directive,
 * blocked-uri) pair already seen within the last 5 minutes.
 *
 * Never throws — malformed/partial reports are logged and recorded with
 * whatever fields are present rather than crashing the request handler.
 */
export function recordCspViolation(rawReport: unknown): { deduped: boolean } {
  const report = extractReport(rawReport);
  const now = Date.now();

  if (isDuplicate(report.violatedDirective, report.blockedUri, now)) {
    return { deduped: true };
  }

  lastSeenByFingerprint.set(fingerprint(report.violatedDirective, report.blockedUri), now);

  const violation: CspViolation = { ...report, receivedAt: new Date(now).toISOString() };
  violations.push(violation);
  if (violations.length > MAX_STORED_VIOLATIONS) {
    violations.shift();
  }

  logger.warn('CSP violation reported', violation);
  return { deduped: false };
}

/** Returns the most recent stored violations, newest first — backs the review/dashboard endpoint. */
export function getRecentCspViolations(limit = 100): CspViolation[] {
  return violations.slice(-limit).reverse();
}

function extractReport(rawReport: unknown): Omit<CspViolation, 'receivedAt'> {
  // Browsers POST either the classic `{"csp-report": {...}}` envelope or,
  // under the newer Reporting API, an array of `{type: "csp-violation", body: {...}}`.
  const body: any =
    rawReport && typeof rawReport === 'object' && 'csp-report' in (rawReport as any)
      ? (rawReport as any)['csp-report']
      : Array.isArray(rawReport) && rawReport[0]?.body
        ? rawReport[0].body
        : (rawReport ?? {});

  return {
    documentUri: stringField(body, ['document-uri', 'documentURL']),
    violatedDirective: stringField(body, ['violated-directive', 'effectiveDirective']),
    blockedUri: stringField(body, ['blocked-uri', 'blockedURL']),
    sourceFile: stringField(body, ['source-file', 'sourceFile']),
    lineNumber: numberField(body, ['line-number', 'lineNumber']),
  };
}

function stringField(body: any, keys: string[]): string {
  for (const key of keys) {
    if (typeof body?.[key] === 'string') return body[key];
  }
  return 'unknown';
}

function numberField(body: any, keys: string[]): number {
  for (const key of keys) {
    if (typeof body?.[key] === 'number') return body[key];
  }
  return 0;
}
