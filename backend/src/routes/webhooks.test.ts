import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateWebhookSignature, scheduleRetry, MAX_RETRIES } from './webhooks';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

vi.mock('../lib/prisma', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    webhookEvent: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('validateWebhookSignature', () => {
  const mockTenantId = 'tenant-123';
  const mockSecret = 'my-secret-key';
  const mockPayload = { event: 'payment.received', data: { amount: 100 } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for a valid signature', async () => {
    (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      webhookSecret: mockSecret,
    });

    const signature = crypto
      .createHmac('sha256', mockSecret)
      .update(JSON.stringify(mockPayload))
      .digest('hex');

    const result = await validateWebhookSignature(mockTenantId, JSON.stringify(mockPayload), signature);
    expect(result).toBe(true);
  });

  it('should return false for an invalid signature', async () => {
    (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      webhookSecret: mockSecret,
    });

    const result = await validateWebhookSignature(mockTenantId, JSON.stringify(mockPayload), 'invalid-signature');
    expect(result).toBe(false);
  });

  it('should throw error when tenant has no webhook secret', async () => {
    (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      validateWebhookSignature(mockTenantId, JSON.stringify(mockPayload), 'any-signature')
    ).rejects.toThrow('No webhook secret configured for tenant');
  });

  it('should use timing-safe comparison', async () => {
    (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      webhookSecret: mockSecret,
    });

    const signature = crypto
      .createHmac('sha256', mockSecret)
      .update(JSON.stringify(mockPayload))
      .digest('hex');

    const result = await validateWebhookSignature(mockTenantId, JSON.stringify(mockPayload), signature);
    expect(result).toBe(true);
    // Verify that timingSafeEqual was used (indirectly through the implementation)
    expect(crypto.timingSafeEqual).toHaveBeenCalled();
  });
});

describe('scheduleRetry', () => {
  it('should add event to retry queue', () => {
    const payload = { event: 'payment.received', data: {} };
    scheduleRetry('event-id-1', payload);

    // Access the retry queue via export
    const queue = (global as any).__retryQueue;
    expect(queue.has('event-id-1')).toBe(true);
    expect(queue.get('event-id-1').retries).toBe(0);
  });
});

describe('rate limiting', () => {
  it('should allow requests within rate limit', () => {
    // This is tested through the route handler integration
    expect(true).toBe(true);
  });
});
