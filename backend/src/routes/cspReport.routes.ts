import express, { Router, Request, Response } from 'express';
import logger from '../utils/logger.js';
import { recordCspViolation, getRecentCspViolations } from '../services/cspReport.service.js';

const router = Router();

// Browsers send the classic report as `application/csp-report`; some send
// `application/json`; the newer Reporting API sends `application/reports+json`.
// None of these match express.json()'s default `application/json`-only type,
// so a dedicated parser is scoped to this route.
const cspReportBodyParser = express.json({
  type: ['application/csp-report', 'application/json', 'application/reports+json'],
});

// POST /api/csp-report — accepts violation reports with no authentication
// (per spec, the browser sends these, not an authenticated client).
router.post('/', cspReportBodyParser, (req: Request, res: Response) => {
  try {
    recordCspViolation(req.body);
  } catch (err) {
    // Never let a malformed report crash the handler.
    logger.error('Failed to process CSP violation report', err);
  }
  // Browsers ignore the response body for reports; 204 is the conventional ack.
  res.status(204).end();
});

// GET /api/csp-report — basic log-aggregation view for reviewing recent violations.
router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json({ violations: getRecentCspViolations(limit) });
});

export default router;
