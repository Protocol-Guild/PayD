import { z } from 'zod';

export const createInvoiceSchema = z.object({
  hours: z.number().positive('Hours must be positive'),
  rate: z.number().positive('Rate must be positive'),
  currency: z.string().max(12).optional().default('USDC'),
  description: z.string().max(2000).optional(),
  attachment_url: z.string().url().max(500).optional(),
});

export const reviewInvoiceSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejection_reason: z.string().max(500).optional(),
}).refine(
  (data) => data.status !== 'rejected' || data.rejection_reason,
  { message: 'Rejection reason is required when rejecting', path: ['rejection_reason'] }
);

export const invoiceQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1' as any),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10' as any),
  status: z.enum(['pending', 'approved', 'rejected', 'paid']).optional(),
  contractor_id: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type ReviewInvoiceInput = z.infer<typeof reviewInvoiceSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
