import { useState, useEffect, useCallback } from 'react';
import { pathPaymentService } from '../services/pathPaymentService';
import type { PathPaymentConfig, PayrollRunStatus } from '../types/pathPaymentTypes';

export const usePathPayments = (organizationId?: number) => {
  const [config, setConfig] = useState<PathPaymentConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await pathPaymentService.getOrganizationConfig();
      setConfig(response.success ? response.config || null : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateConfig = useCallback(async (newConfig: Partial<PathPaymentConfig>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await pathPaymentService.configureOrganization(newConfig as any);
      if (response.success) {
        setConfig(response.config || null);
      } else {
        throw new Error(response.message || 'Failed to update configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    config,
    loading,
    error,
    loadConfig,
    updateConfig,
    isConfigured: !!config?.isActive,
  };
};

export const usePayrollRuns = (organizationId?: number) => {
  const [runs, setRuns] = useState<PayrollRunStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async (limit = 50, offset = 0) => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await pathPaymentService.getPayrollRunsHistory({ limit, offset });
      setRuns(response.success ? response.payrollRuns || [] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  return {
    runs,
    loading,
    error,
    loadRuns,
    refresh: () => loadRuns(),
  };
};