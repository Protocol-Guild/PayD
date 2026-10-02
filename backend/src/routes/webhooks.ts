import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const router = Router();

// In-memory retry queue (replace with Redis in production)
const retryQueue = new Map<string, { payload: any; retries: number; lastAttempt: Date }>();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// Rate limiting state (replace with Redis-based implementation in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

function getRateLimitKey(ip: string, tenantId: string): string {
  return `rate_limit:${tenantId}:${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  return true;
}

function scheduleRetry(webhookEventId: string, payload: any) {
  retryQueue.set(webhookEventId, {
    payload,
    retries: 0,
    lastAttempt: new Date(),
  });
}

async function processRetryQueue() {
  for (const [eventId, record] of retryQueue.entries()) {
    if (record.retries >= MAX_RETRIES) {
      retryQueue.delete(eventId);
      continue;
    }
    try {
      const updated = await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: 'pending' },
      });
      if (updated) {
        await handleWebhookEvent(eventId);
      }
    } catch (error) {
      record.retries += 1;
      record.lastAttempt = new Date();
    }
  }
}

// Start retry interval
setInterval(processRetryQueue, RETRY_DELAY_MS);

const WEBHOOK_SECRET_HEADER = 'x-payd-webhook-secret';
const WEBHOOK_SIGNATURE_HEADER = 'x-payd-webhook-signature';

// Helper: validate webhook signature using stored tenant secret
async function validateWebhookSignature(
  tenantId: string,
  payload: string,
  signature: string
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { webhookSecret: true },
  });

  if (!tenant?.webhookSecret) {
    throw new AppError('No webhook secret configured for tenant', 400);
  }

  const expectedSignature = crypto
    .createHmac('sha256', tenant.webhookSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

const webhookBodySchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
});

/**
 * POST /webhooks/:tenantId
 * Receives and validates webhook events with signature verification and retry logic.
 */
router.post('/:tenantId', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // Multi-tenant isolation: reject if tenant doesn't exist
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // Rate limiting with multi-tenant key
  const rateLimitKey = getRateLimitKey(ip, tenantId);
  if (!checkRateLimit(rateLimitKey)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const rawBody = req.body;
  const signature = req.headers[WEBHOOK_SIGNATURE_HEADER] as string | undefined;
  const storedSecret = req.headers[WEBHOOK_SECRET_HEADER] as string | undefined;

  // Validate signature
  if (!signature) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  let isValid: boolean;
  try {
    isValid = await validateWebhookSignature(tenantId, JSON.stringify(rawBody), signature);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Parse and validate payload
  let parsed;
  try {
    parsed = webhookBodySchema.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  // Upsert webhook event
  const eventId = crypto.randomUUID();
  try {
    await prisma.webhookEvent.upsert({
      where: { id: eventId },
      update: {
        status: 'processing',
        payload: parsed as any,
        processedAt: new Date(),
      },
      create: {
        id: eventId,
        tenantId,
        eventType: parsed.event,
        payload: parsed as any,
        status: 'processing',
      },
    });
  } catch (error) {
    // In case of unique constraint or DB error, schedule retry
    scheduleRetry(eventId, parsed);
    return res.status(202).json({ accepted: true, message: 'Event queued for processing' });
  }

  // Process the webhook event asynchronously
  handleWebhookEvent(eventId).catch((error) => {
    console.error(`Webhook processing failed for event ${eventId}:`, error);
    scheduleRetry(eventId, parsed);
  });

  res.status(202).json({ accepted: true });
});

/**
 * GET /webhooks/:tenantId/events
 * Audit log: list webhook events for a tenant (multi-tenant isolation).
 */
router.get('/:tenantId/events', async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  const events = await prisma.webhookEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json(events);
});

/**
 * Retry a specific webhook event
 */
router.post('/:tenantId/events/:eventId/retry', async (req: Request, res: Response) => {
  const { tenantId, eventId } = req.params;

  const event = await prisma.webhookEvent.findFirst({
    where: { id: eventId, tenantId },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (event.retries >= MAX_RETRIES) {
    return res.status(400).json({ error: 'Max retries exceeded' });
  }

  try {
    await handleWebhookEvent(eventId);
    res.json({ success: true });
  } catch (error) {
    scheduleRetry(eventId, event.payload);
    res.status(500).json({ error: 'Retry scheduled' });
  }
});

// Internal: process a single webhook event
async function handleWebhookEvent(eventId: string): Promise<void> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) return;

  try {
    // Route to appropriate handler based on eventType
    switch (event.eventType) {
      case 'payment.received':
        // TODO: Implement payment processing logic
        break;
      case 'payment.failed':
        // TODO: Implement payment failure handling
        break;
      case 'invoice.paid':
        // TODO: Implement invoice paid handling
        break;
      default:
        console.warn(`Unhandled webhook event type: ${event.eventType}`);
    }

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'processed', processedAt: new Date() },
    });
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retries: { increment: 1 },
      },
    });
    throw error;
  }
}

export { router as webhookRouter };
export { MAX_RETRIES, RETRY_DELAY_MS, retryQueue };
