export interface TaxComplianceCalculationInput {
  organizationId: number;
  employeeId?: number;
  employeeResidencyCountry?: string | null;
  grossAmount: number;
  currency?: string;
}

export interface TaxComplianceDeductionLine {
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  deductedAmount: number;
}

export interface TaxComplianceCalculationResult {
  grossAmount: number;
  deductions: TaxComplianceDeductionLine[];
  totalTax: number;
  netAmount: number;
}

export interface TaxComplianceProvider {
  readonly name: string;

  calculate(input: TaxComplianceCalculationInput): Promise<TaxComplianceCalculationResult>;
}
