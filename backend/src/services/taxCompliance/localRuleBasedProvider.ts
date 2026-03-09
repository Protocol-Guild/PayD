import type {
  TaxComplianceCalculationInput,
  TaxComplianceCalculationResult,
  TaxComplianceProvider,
} from './types.js';

export type RuleBasedCalculator = (
  organizationId: number,
  grossAmount: number
) => Promise<TaxComplianceCalculationResult>;

export class LocalRuleBasedProvider implements TaxComplianceProvider {
  readonly name = 'local_rule_based';

  private readonly calculator: RuleBasedCalculator;

  constructor(calculator: RuleBasedCalculator) {
    this.calculator = calculator;
  }

  async calculate(input: TaxComplianceCalculationInput): Promise<TaxComplianceCalculationResult> {
    return this.calculator(input.organizationId, input.grossAmount);
  }
}
