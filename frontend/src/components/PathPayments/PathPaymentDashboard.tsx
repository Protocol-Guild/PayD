import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  Activity,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  ArrowUpDown,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
} from 'lucide-react';
import { pathPaymentService } from '@/services/pathPaymentService';
import { useToast } from '@/components/ui/use-toast';

interface DashboardStats {
  totalRuns: number;
  totalEmployees: number;
  totalVolumeUSD: string;
  averageSlippage: number;
  successRate: number;
  activeBatches: number;
}

interface RecentRun {
  id: string;
  createdAt: string;
  totalEmployees: number;
  successfulPayments: number;
  failedPayments: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalSourceAmount?: string;
  sourceAsset: {
    code: string;
    issuer: string | null;
  };
}

interface AssetUsage {
  asset: string;
  count: number;
  volume: string;
  percentage: number;
}

interface PerformanceMetric {
  date: string;
  successRate: number;
  averageSlippage: number;
  totalVolume: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const PathPaymentDashboard: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalRuns: 0,
    totalEmployees: 0,
    totalVolumeUSD: '0',
    averageSlippage: 0,
    successRate: 0,
    activeBatches: 0,
  });
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [assetUsage, setAssetUsage] = useState<AssetUsage[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadDashboardData();
  }, [selectedTimeframe]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load recent payroll runs
      const runsResponse = await pathPaymentService.getPayrollRunsHistory({ limit: 10 });
      if (runsResponse.success && runsResponse.payrollRuns) {
        setRecentRuns(runsResponse.payrollRuns.map(run => ({
          id: run.id,
          createdAt: run.createdAt.toString(),
          totalEmployees: run.totalEmployees,
          successfulPayments: run.successfulPayments,
          failedPayments: run.failedPayments,
          status: run.status,
          totalSourceAmount: run.totalSourceAmount,
          sourceAsset: run.sourceAsset,
        })));

        // Calculate stats from recent runs
        const totalRuns = runsResponse.payrollRuns.length;
        const totalEmployees = runsResponse.payrollRuns.reduce((sum, run) => sum + run.totalEmployees, 0);
        const totalSuccessful = runsResponse.payrollRuns.reduce((sum, run) => sum + run.successfulPayments, 0);
        const totalFailed = runsResponse.payrollRuns.reduce((sum, run) => sum + run.failedPayments, 0);
        const totalProcessed = totalSuccessful + totalFailed;
        const successRate = totalProcessed > 0 ? totalSuccessful / totalProcessed : 0;
        const activeBatches = runsResponse.payrollRuns.filter(run => 
          run.status === 'pending' || run.status === 'processing'
        ).length;

        setStats(prev => ({
          ...prev,
          totalRuns,
          totalEmployees,
          successRate,
          activeBatches,
        }));

        // Generate asset usage data
        const assetMap = new Map<string, { count: number; volume: number }>();
        runsResponse.payrollRuns.forEach(run => {
          const assetKey = run.sourceAsset.code;
          const current = assetMap.get(assetKey) || { count: 0, volume: 0 };
          current.count += 1;
          current.volume += parseFloat(run.totalSourceAmount || '0');
          assetMap.set(assetKey, current);
        });

        const totalVolume = Array.from(assetMap.values()).reduce((sum, data) => sum + data.volume, 0);
        const assetUsageData: AssetUsage[] = Array.from(assetMap.entries()).map(([asset, data]) => ({
          asset,
          count: data.count,
          volume: data.volume.toFixed(2),
          percentage: totalVolume > 0 ? (data.volume / totalVolume) * 100 : 0,
        }));

        setAssetUsage(assetUsageData);
        setStats(prev => ({ ...prev, totalVolumeUSD: totalVolume.toFixed(2) }));

        // Generate performance metrics (mock data for demonstration)
        const performanceMetrics: PerformanceMetric[] = [];
        const days = selectedTimeframe === '7d' ? 7 : selectedTimeframe === '30d' ? 30 : 90;
        
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          
          performanceMetrics.push({
            date: date.toISOString().split('T')[0],
            successRate: 0.85 + Math.random() * 0.1, // 85-95%
            averageSlippage: 0.01 + Math.random() * 0.02, // 1-3%
            totalVolume: Math.random() * 10000,
          });
        }
        
        setPerformanceData(performanceMetrics);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        title: 'Dashboard Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-yellow-500';
      case 'pending': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'processing': return <Clock className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mr-3" />
          <span className="text-lg">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Path Payment Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor and analyze multi-asset payroll operations
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Runs</p>
                <p className="text-2xl font-bold">{stats.totalRuns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Total Employees</p>
                <p className="text-2xl font-bold">{stats.totalEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Total Volume</p>
                <p className="text-2xl font-bold">${stats.totalVolumeUSD}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Success Rate</p>
                <p className="text-2xl font-bold">{(stats.successRate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Avg Slippage</p>
                <p className="text-2xl font-bold">{(stats.averageSlippage * 100).toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Active Batches</p>
                <p className="text-2xl font-bold">{stats.activeBatches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Data */}
      <Tabs defaultValue="performance" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="assets">Asset Usage</TabsTrigger>
            <TabsTrigger value="recent">Recent Runs</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Timeframe:</span>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as '7d' | '30d' | '90d')}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Success Rate Trend */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Success Rate Trend</h3>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0.8, 1]} />
                    <Tooltip 
                      formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="successRate" 
                      stroke="#10B981" 
                      strokeWidth={2} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Volume and Slippage */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Volume & Slippage</h3>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalVolume" fill="#3B82F6" name="Volume (USD)" />
                    <Line yAxisId="right" type="monotone" dataKey="averageSlippage" stroke="#EF4444" name="Slippage %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Asset Distribution */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <PieChartIcon className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Asset Distribution by Volume</h3>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={assetUsage}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ asset, percentage }) => `${asset} ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="percentage"
                    >
                      {assetUsage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Asset Usage Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Asset Usage Details</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assetUsage.map((asset, index) => (
                    <div key={asset.asset} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{asset.asset}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{asset.volume}</p>
                        <p className="text-sm text-gray-500">{asset.count} runs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Recent Payroll Runs</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge className={getStatusColor(run.status)}>
                        {getStatusIcon(run.status)}
                        <span className="ml-1 capitalize">{run.status}</span>
                      </Badge>
                      <div>
                        <p className="font-medium">Run #{run.id.substring(0, 8)}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(run.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-medium">
                        {run.totalEmployees} employees
                      </p>
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-green-600">✓ {run.successfulPayments}</span>
                        {run.failedPayments > 0 && (
                          <span className="text-red-600">✗ {run.failedPayments}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-medium">
                        {run.totalSourceAmount} {run.sourceAsset.code}
                      </p>
                      <p className="text-sm text-gray-500">Source Amount</p>
                    </div>
                  </div>
                ))}
                
                {recentRuns.length === 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No recent payroll runs found. Execute your first path payment payroll to see data here.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};