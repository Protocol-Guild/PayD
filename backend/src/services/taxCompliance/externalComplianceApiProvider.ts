import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';

import type {
  TaxComplianceCalculationInput,
  TaxComplianceCalculationResult,
  TaxComplianceProvider,
} from './types.js';

const externalResponseSchema = z.object({
  grossAmount: z.number(),
  totalTax: z.number(),
  netAmount: z.number(),
  deductions: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['percentage', 'fixed']),
        value: z.number(),
        deductedAmount: z.number(),
      })
    )
    .default([]),
});

export interface ExternalComplianceApiProviderOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class ExternalComplianceApiProvider implements TaxComplianceProvider {
  readonly name = 'external_compliance_api';

  private readonly client: AxiosInstance;

  constructor(options: ExternalComplianceApiProviderOptions) {
    this.client = axios.create({
      baseURL: options.baseUrl,
      timeout: options.timeoutMs ?? 15000,
      headers: options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : undefined,
    });
  }

  async calculate(input: TaxComplianceCalculationInput): Promise<TaxComplianceCalculationResult> {
    const response = await this.client.post('/tax/calculate', {
      organization_id: input.organizationId,
      employee_id: input.employeeId,
      employee_residency_country: input.employeeResidencyCountry,
      gross_amount: input.grossAmount,
      currency: input.currency,
    });

    return externalResponseSchema.parse(response.data);
  }
}
