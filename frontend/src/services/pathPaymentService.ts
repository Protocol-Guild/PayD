/**
 * Path Payment Service for PayD Frontend
 * Handles all API interactions for Stellar path payment operations
 */

import { apiClient } from './apiClient';
import type {
  PathPaymentConfig,
  PayrollExecutionRequest,
  PayrollExecutionResponse,
  CostEstimateRequest,
  CostEstimateResponse,
  PathDiscoveryRequest,
  PathDiscoveryResponse,
  PayrollRunStatus,
  SupportedAssetsResponse,
  LiquidityStatsResponse,
} from '../types/pathPaymentTypes';

export interface AssetInfo {
  code: string;
  issuer: string | null;
  isNative: boolean;
}

export interface EmployeePaymentRequest {
  employeeId: number;
  employeeAddress: string;
  destinationAsset: AssetInfo;
  destinationAmount: string;
}

export class PathPaymentService {
  private readonly baseUrl = '/api/v1/path-payments';

  /**
   * Configure organization for path payment payrolls
   */
  async configureOrganization(config: {
    employerAddress: string;
    defaultSourceAsset: AssetInfo;
    maxSlippageBps: number;
    maxPriceImpactBps: number;
    autoApproveThreshold: string;
    isActive: boolean;
  }): Promise<{
    success: boolean;
    config?: PathPaymentConfig;
    message?: string;
    errors?: string[];
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/configure`, config);
      return response.data;
    } catch (error) {
      console.error('Failed to configure organization:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get organization path payment configuration
   */
  async getOrganizationConfig(): Promise<{
    success: boolean;
    config?: PathPaymentConfig;
    message?: string;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/config`);
      return response.data;
    } catch (error) {
      console.error('Failed to get organization config:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Execute payroll using path payments
   */
  async executePayrollRun(request: {
    employees: EmployeePaymentRequest[];
    paymentType?: 'strict_send' | 'strict_receive';
    sourceAsset?: AssetInfo;
    maxSlippageBps?: number;
    maxPriceImpactBps?: number;
  }): Promise<PayrollExecutionResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/payroll/execute`, request);
      return response.data;
    } catch (error) {
      console.error('Failed to execute payroll:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Estimate payroll costs with path payments
   */
  async estimatePayrollCosts(request: {
    sourceAsset: AssetInfo;
    employees: Array<{
      destinationAsset: AssetInfo;
      destinationAmount: string;
    }>;
    paymentType?: 'strict_send' | 'strict_receive';
    maxSlippageBps?: number;
    maxPriceImpactBps?: number;
  }): Promise<CostEstimateResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/payroll/estimate`, request);
      return response.data;
    } catch (error) {
      console.error('Failed to estimate payroll costs:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get payroll run status and details
   */
  async getPayrollRunStatus(runId: string): Promise<{
    success: boolean;
    payrollRun?: PayrollRunStatus;
    employeePayments?: Array<{
      id: string;
      employeeId: number;
      employeeAddress: string;
      destinationAsset: AssetInfo;
      destinationAmount: string;
      actualDestinationAmount?: string;
      status: string;
      errorMessage?: string;
    }>;
    message?: string;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/payroll/runs/${runId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get payroll run status:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get organization payroll runs history
   */
  async getPayrollRunsHistory(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    payrollRuns?: PayrollRunStatus[];
    pagination?: {
      limit: number;
      offset: number;
      total: number;
    };
    message?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const url = `${this.baseUrl}/payroll/runs${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get payroll runs history:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Find optimal paths for asset conversion
   */
  async findOptimalPaths(request: {
    sourceAsset: AssetInfo;
    destinationAsset: AssetInfo;
    amount: string;
    amountType: 'source' | 'destination';
    maxPathLength?: number;
    maxSlippageBps?: number;
    maxPriceImpactBps?: number;
  }): Promise<PathDiscoveryResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/paths/find`, request);
      return response.data;
    } catch (error) {
      console.error('Failed to find optimal paths:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get supported assets for path payments
   */
  async getSupportedAssets(): Promise<SupportedAssetsResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/assets`);
      return response.data;
    } catch (error) {
      console.error('Failed to get supported assets:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get liquidity pool statistics
   */
  async getLiquidityPoolStats(): Promise<LiquidityStatsResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/liquidity/stats`);
      return response.data;
    } catch (error) {
      console.error('Failed to get liquidity stats:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Subscribe to real-time payroll run updates
   */
  subscribeToPayrollUpdates(runId: string, callback: (update: any) => void): () => void {
    // WebSocket or Server-Sent Events implementation
    const eventSource = new EventSource(`${this.baseUrl}/payroll/runs/${runId}/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Failed to parse payroll update:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Payroll update stream error:', error);
    };

    return () => {
      eventSource.close();
    };
  }

  /**
   * Validate asset information
   */
  validateAsset(asset: AssetInfo): boolean {
    if (!asset.code || asset.code.length > 12) {
      return false;
    }

    if (asset.isNative || asset.code === 'XLM') {
      return asset.issuer === null;
    }

    return asset.issuer !== null && asset.issuer.length === 56;
  }

  /**
   * Format asset display name
   */
  formatAssetName(asset: AssetInfo): string {
    if (asset.isNative || asset.code === 'XLM') {
      return 'XLM (Native Stellar Lumens)';
    }

    return `${asset.code} (${asset.issuer?.substring(0, 8)}...${asset.issuer?.substring(-8)})`;
  }

  /**
   * Calculate estimated execution time based on batch size
   */
  estimateExecutionTime(employeeCount: number, averagePathLength: number = 2): number {
    // Base time for transaction processing
    const baseTimePerEmployee = 2; // seconds
    
    // Additional time for path complexity
    const pathComplexityFactor = averagePathLength * 0.5;
    
    // Network congestion factor
    const networkFactor = 1.2;
    
    return Math.ceil(employeeCount * (baseTimePerEmployee + pathComplexityFactor) * networkFactor);
  }

  /**
   * Generate payment summary for display
   */
  generatePaymentSummary(employees: EmployeePaymentRequest[]): {
    totalEmployees: number;
    uniqueAssets: AssetInfo[];
    totalAmountsByAsset: Map<string, string>;
    averagePayment: string;
  } {
    const uniqueAssetsMap = new Map<string, AssetInfo>();
    const totalAmountsByAsset = new Map<string, string>();

    employees.forEach(emp => {
      const assetKey = emp.destinationAsset.isNative 
        ? 'XLM' 
        : `${emp.destinationAsset.code}:${emp.destinationAsset.issuer}`;
      
      uniqueAssetsMap.set(assetKey, emp.destinationAsset);
      
      const currentTotal = parseFloat(totalAmountsByAsset.get(assetKey) || '0');
      const employeeAmount = parseFloat(emp.destinationAmount);
      totalAmountsByAsset.set(assetKey, (currentTotal + employeeAmount).toString());
    });

    const totalValue = Array.from(totalAmountsByAsset.values())
      .reduce((sum, amount) => sum + parseFloat(amount), 0);
    
    return {
      totalEmployees: employees.length,
      uniqueAssets: Array.from(uniqueAssetsMap.values()),
      totalAmountsByAsset,
      averagePayment: (totalValue / employees.length).toFixed(2),
    };
  }

  /**
   * Check if payroll execution is feasible
   */
  async checkPayrollFeasibility(request: {
    sourceAsset: AssetInfo;
    employees: EmployeePaymentRequest[];
    paymentType: 'strict_send' | 'strict_receive';
  }): Promise<{
    feasible: boolean;
    issues: string[];
    recommendations: string[];
    estimatedCost?: string;
    estimatedDuration?: number;
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check batch size
    if (request.employees.length > 100) {
      issues.push('Batch size exceeds maximum limit of 100 employees');
      recommendations.push('Consider splitting the payroll into smaller batches');
    }

    // Check asset diversity
    const uniqueAssets = new Set(request.employees.map(emp => 
      emp.destinationAsset.isNative ? 'XLM' : `${emp.destinationAsset.code}:${emp.destinationAsset.issuer}`
    ));

    if (uniqueAssets.size > 10) {
      issues.push('High asset diversity may impact execution efficiency');
      recommendations.push('Consider consolidating to fewer destination assets');
    }

    // Validate all assets
    const invalidAssets = request.employees.filter(emp => !this.validateAsset(emp.destinationAsset));
    if (invalidAssets.length > 0) {
      issues.push(`${invalidAssets.length} employees have invalid destination assets`);
      recommendations.push('Verify all asset codes and issuers');
    }

    try {
      // Get cost estimate for feasibility check
      const estimate = await this.estimatePayrollCosts({
        sourceAsset: request.sourceAsset,
        employees: request.employees.map(emp => ({
          destinationAsset: emp.destinationAsset,
          destinationAmount: emp.destinationAmount,
        })),
        paymentType: request.paymentType,
      });

      if (estimate.success && estimate.estimate) {
        if (estimate.estimate.infeasibleEmployees.length > 0) {
          issues.push(`${estimate.estimate.infeasibleEmployees.length} employees have infeasible payment requirements`);
          recommendations.push('Check liquidity for problematic asset pairs');
        }

        return {
          feasible: issues.length === 0 && estimate.estimate.feasibleEmployees > 0,
          issues,
          recommendations,
          estimatedCost: estimate.estimate.totalEstimatedSourceCost,
          estimatedDuration: this.estimateExecutionTime(request.employees.length),
        };
      }
    } catch (error) {
      issues.push('Unable to estimate payroll costs');
      recommendations.push('Check network connectivity and try again');
    }

    return {
      feasible: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Handle API errors consistently
   */
  private handleError(error: any): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    
    if (error.message) {
      return new Error(error.message);
    }
    
    return new Error('An unexpected error occurred');
  }
}

// Create singleton instance
export const pathPaymentService = new PathPaymentService();