import { z } from 'zod';

export const InsightSeverity = z.enum(['info', 'warning', 'critical']);
export type InsightSeverity = z.infer<typeof InsightSeverity>;

export const InsightCategory = z.enum([
  'payroll',
  'liquidity',
  'compliance',
  'workforce',
  'schedule',
]);
export type InsightCategory = z.infer<typeof InsightCategory>;

export const InsightCard = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  category: InsightCategory,
  severity: InsightSeverity,
  metric: z.string().optional(),
  metricLabel: z.string().optional(),
  actionLabel: z.string().optional(),
  actionRoute: z.string().optional(),
  generatedAt: z.string().datetime(),
});
export type InsightCard = z.infer<typeof InsightCard>;

export const InsightCardsResponse = z.object({
  cards: z.array(InsightCard),
  generatedAt: z.string().datetime(),
  windowDays: z.number().int().positive(),
});
export type InsightCardsResponse = z.infer<typeof InsightCardsResponse>;

export const InsightCardsQuerySchema = z.object({
  windowDays: z.coerce.number().int().positive().max(90).default(30),
});
export type InsightCardsQuerySchema = z.infer<typeof InsightCardsQuerySchema>;
