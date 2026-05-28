/**
 * @file src/routes/scalingRoutes.ts
 * @description REST endpoints that expose DB connection-pool health and
 *              slow-query statistics.  Part of the API & Database Scaling
 *              effort (Issue #272 / Wave #717 – Part 27).
 *
 * Routes
 * ──────
 *   GET  /api/v1/scaling/health        – current pool snapshot
 *   GET  /api/v1/scaling/query-stats   – recent slow queries (admin only)
 *   POST /api/v1/scaling/refresh-view  – refresh the daily-summary mat-view
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getPool, getPoolStats } from '../services/dbPoolService.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';

const router = Router();

// ─── GET /scaling/health ──────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/scaling/health:
 *   get:
 *     summary: Database connection-pool health snapshot
 *     tags: [Scaling]
 *     responses:
 *       200:
 *         description: Current pool utilisation
 */
router.get('/health', (_req: Request, res: Response) => {
  try {
    const stats = getPoolStats();
    return res.status(200).json({
      success: true,
      data: {
        totalConnections: stats.totalConns,
        idleConnections: stats.idleConns,
        waitingClients: stats.waitingClients,
        recordedAt: stats.recordedAt,
        poolUtilisationPct:
          stats.totalConns > 0
            ? Math.round(((stats.totalConns - stats.idleConns) / stats.totalConns) * 100)
            : 0,
      },
    });
  } catch (err) {
    logger.error({ err }, '[scalingRoutes] Failed to read pool stats');
    return res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve pool health'),
    );
  }
});

// ─── GET /scaling/query-stats ────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/scaling/query-stats:
 *   get:
 *     summary: Recent slow-query statistics (admin only)
 *     tags: [Scaling]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: minMs
 *         schema: { type: integer, default: 200 }
 *     responses:
 *       200:
 *         description: List of recent slow queries
 */
router.get('/query-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const minMs = Number(req.query.minMs ?? 200);

    const pool = getPool();
    const { rows } = await pool.query<{
      endpoint: string;
      query_hash: string;
      execution_ms: number;
      rows_returned: number;
      cache_hit: boolean;
      recorded_at: Date;
    }>(
      `SELECT endpoint, query_hash, execution_ms, rows_returned, cache_hit, recorded_at
         FROM db_query_stats
        WHERE execution_ms >= $1
        ORDER BY recorded_at DESC
        LIMIT $2`,
      [minMs, limit],
    );

    return res.status(200).json({
      success: true,
      data: rows,
      meta: { limit, minMs, count: rows.length },
    });
  } catch (err) {
    logger.error({ err }, '[scalingRoutes] Failed to fetch query stats');
    next(err);
  }
});

// ─── POST /scaling/refresh-view ──────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/scaling/refresh-view:
 *   post:
 *     summary: Refresh the daily transaction summary materialised view
 *     tags: [Scaling]
 *     responses:
 *       200:
 *         description: View refreshed successfully
 */
router.post('/refresh-view', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    await pool.query(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_daily_tx_summary',
    );

    logger.info('[scalingRoutes] mv_org_daily_tx_summary refreshed');
    return res.status(200).json({
      success: true,
      message: 'Materialised view mv_org_daily_tx_summary refreshed successfully.',
    });
  } catch (err) {
    logger.error({ err }, '[scalingRoutes] Failed to refresh materialised view');
    next(err);
  }
});

export default router;
