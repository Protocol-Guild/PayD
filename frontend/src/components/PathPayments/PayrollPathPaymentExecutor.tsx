import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { pathPaymentService } from '@/services/pathPaymentService';

interface Employee {
  employeeId: number;
  employeeAddress: string;
  destinationAsset: {
    code: string;
    issuer: string | null;
    isNative: boolean;
  };
  destinationAmount: string;
}

interface PayrollPathPaymentExecutorProps {
  employees: Employee[];
  sourceAsset?: {
    code: string;
    issuer: string | null;
    isNative: boolean;
  };
  paymentType?: 'strict_send' | 'strict_receive';
  onExecutionComplete?: (result: any) => void;
  onExecutionStart?: () => void;
}

interface ExecutionResult {
  success: boolean;
  batchId?: string;
  contractBatchId?: number;
  totalEmployees: number;
  successfulPayments: number;
  failedPayments: number;
  totalSourceAmount?: string;
  totalDestinationAmount?: string;
  errors?: Array<{
    employeeId: string;
    error: string;
  }>;
}

interface CostEstimate {
  totalEstimatedSourceCost: string;
  totalDestinationAmount: string;
  averageSlippage: number;
  averagePriceImpact: number;
  feasibleEmployees: number;
  infeasibleEmployees: Array<{
    index: number;
    reason: string;
  }>;
  confidenceScore: number;
  warnings?: string[];
}

export const PayrollPathPaymentExecutor: React.FC<PayrollPathPaymentExecutorProps> = ({
  employees,
  sourceAsset,
  paymentType = 'strict_send',
  onExecutionComplete,
  onExecutionStart,
}) => {
  const { toast } = useToast();
  const [estimating, setEstimating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'estimating' | 'ready' | 'executing' | 'completed' | 'failed'>('idle');

  useEffect(() => {
    if (employees.length > 0 && sourceAsset) {
      estimatePayrollCosts();
    }
  }, [employees, sourceAsset, paymentType]);

  const estimatePayrollCosts = async () => {
    if (!sourceAsset || employees.length === 0) return;

    try {
      setEstimating(true);
      setExecutionStatus('estimating');

      const response = await pathPaymentService.estimatePayrollCosts({
        sourceAsset,
        employees: employees.map(emp => ({
          destinationAsset: emp.destinationAsset,
          destinationAmount: emp.destinationAmount,
        })),
        paymentType,
      });

      if (response.success && response.estimate) {
        setEstimate(response.estimate);
        setExecutionStatus('ready');
        
        if (response.estimate.infeasibleEmployees.length > 0) {
          toast({
            title: 'Some Payments May Fail',
            description: `${response.estimate.infeasibleEmployees.length} employees have infeasible payment requirements`,
            variant: 'destructive',
          });
        }
      } else {
        throw new Error(response.message || 'Failed to estimate costs');
      }
    } catch (error) {
      console.error('Failed to estimate costs:', error);
      setExecutionStatus('failed');
      toast({
        title: 'Estimation Error',
        description: error instanceof Error ? error.message : 'Failed to estimate payroll costs',
        variant: 'destructive',
      });
    } finally {
      setEstimating(false);
    }
  };

  const executePayroll = async () => {
    if (!sourceAsset || employees.length === 0) return;

    try {
      setExecuting(true);
      setExecutionStatus('executing');
      onExecutionStart?.();

      const response = await pathPaymentService.executePayrollRun({
        employees: employees.map(emp => ({
          employeeId: emp.employeeId,
          employeeAddress: emp.employeeAddress,
          destinationAsset: emp.destinationAsset,
          destinationAmount: emp.destinationAmount,
        })),
        paymentType,
      });

      setExecutionResult(response);
      
      if (response.success) {
        setExecutionStatus('completed');
        toast({
          title: 'Payroll Execution Started',
          description: `Batch ${response.batchId} created with ${response.totalEmployees} employees`,
        });
        onExecutionComplete?.(response);
      } else {
        setExecutionStatus('failed');
        toast({
          title: 'Execution Failed',
          description: response.errors?.[0]?.error || 'Failed to execute payroll',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to execute payroll:', error);
      setExecutionStatus('failed');
      toast({
        title: 'Execution Error',
        description: error instanceof Error ? error.message : 'Failed to execute payroll',
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  };

  const getStatusColor = (status: typeof executionStatus) => {
    switch (status) {
      case 'idle': return 'gray';
      case 'estimating': return 'yellow';
      case 'ready': return 'blue';
      case 'executing': return 'yellow';
      case 'completed': return 'green';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: typeof executionStatus) => {
    switch (status) {
      case 'idle': return <Clock className="h-4 w-4" />;
      case 'estimating': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'ready': return <Play className="h-4 w-4" />;
      case 'executing': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Execution Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Path Payment Execution</h3>
            </div>
            <Badge variant={getStatusColor(executionStatus) as any}>
              {getStatusIcon(executionStatus)}
              <span className="ml-1 capitalize">{executionStatus}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">{employees.length}</p>
                <p className="text-xs text-gray-500">Total Employees</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">
                  {estimate?.totalDestinationAmount || '--'}
                </p>
                <p className="text-xs text-gray-500">Total Destination</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">
                  {estimate ? `${(estimate.averageSlippage * 100).toFixed(2)}%` : '--'}
                </p>
                <p className="text-xs text-gray-500">Avg Slippage</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">
                  {estimate ? `${estimate.feasibleEmployees}/${employees.length}` : '--'}
                </p>
                <p className="text-xs text-gray-500">Feasible</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Estimate Details */}
      {estimate && (
        <Card>
          <CardHeader>
            <h4 className="font-medium">Cost Estimate</h4>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Estimated Source Cost</p>
                <p className="text-lg font-semibold text-green-600">
                  {estimate.totalEstimatedSourceCost} {sourceAsset?.code}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Confidence Score</p>
                <div className="flex items-center space-x-2">
                  <Progress value={estimate.confidenceScore * 100} className="flex-1" />
                  <span className="text-sm font-medium">
                    {(estimate.confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium">Average Slippage</p>
                <p className="text-gray-600">{(estimate.averageSlippage * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="font-medium">Average Price Impact</p>
                <p className="text-gray-600">{(estimate.averagePriceImpact * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="font-medium">Payment Type</p>
                <p className="text-gray-600 capitalize">{paymentType.replace('_', ' ')}</p>
              </div>
            </div>

            {estimate.warnings && estimate.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {estimate.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {estimate.infeasibleEmployees.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">
                    {estimate.infeasibleEmployees.length} employees have infeasible payment requirements:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {estimate.infeasibleEmployees.map((infeasible, index) => (
                      <li key={index} className="text-sm">
                        Employee {infeasible.index + 1}: {infeasible.reason}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Execution Results */}
      {executionResult && (
        <Card>
          <CardHeader>
            <h4 className="font-medium">Execution Results</h4>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium">Batch ID</p>
                <p className="font-mono text-xs text-gray-600">
                  {executionResult.batchId}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Successful Payments</p>
                <p className="text-lg font-semibold text-green-600">
                  {executionResult.successfulPayments}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Failed Payments</p>
                <p className="text-lg font-semibold text-red-600">
                  {executionResult.failedPayments}
                </p>
              </div>
            </div>

            {executionResult.errors && executionResult.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Execution Errors:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {executionResult.errors.map((error, index) => (
                      <li key={index} className="text-sm">
                        Employee {error.employeeId}: {error.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        <Button
          onClick={estimatePayrollCosts}
          variant="outline"
          disabled={estimating || executing || !sourceAsset || employees.length === 0}
        >
          {estimating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Re-estimate Costs
        </Button>

        <Button
          onClick={executePayroll}
          disabled={
            executing || 
            !estimate || 
            executionStatus !== 'ready' ||
            estimate.feasibleEmployees === 0
          }
        >
          {executing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Execute Payroll
        </Button>
      </div>
    </div>
  );
};