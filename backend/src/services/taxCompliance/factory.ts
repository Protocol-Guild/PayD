import { ExternalComplianceApiProvider } from './externalComplianceApiProvider.js';
import { LocalRuleBasedProvider } from './localRuleBasedProvider.js';
import type { RuleBasedCalculator } from './localRuleBasedProvider.js';
import type { TaxComplianceProvider } from './types.js';

export function createTaxComplianceProvider(ruleBasedCalculator: RuleBasedCalculator): TaxComplianceProvider {
  const providerName = process.env.TAX_COMPLIANCE_PROVIDER || 'local_rule_based';

  if (providerName === 'external_compliance_api') {
    const baseUrl = process.env.TAX_COMPLIANCE_API_BASE_URL;
    if (!baseUrl) {
      throw new Error('TAX_COMPLIANCE_API_BASE_URL must be set when TAX_COMPLIANCE_PROVIDER=external_compliance_api');
    }

    return new ExternalComplianceApiProvider({
      baseUrl,
      apiKey: process.env.TAX_COMPLIANCE_API_KEY,
      timeoutMs: process.env.TAX_COMPLIANCE_API_TIMEOUT_MS
        ? Number.parseInt(process.env.TAX_COMPLIANCE_API_TIMEOUT_MS, 10)
        : undefined,
    });
  }

  return new LocalRuleBasedProvider(ruleBasedCalculator);
}
