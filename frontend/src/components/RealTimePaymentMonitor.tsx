import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useNotification } from '../hooks/useNotification';
import { mockPaymentService } from '../services/mockPaymentService';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Users, 
  DollarSign,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface PaymentBatch {
  id: string;
  totalAmount: number;
  currency: string;
  recipientCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  estimatedCompletion?: string;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  batchId: string;
  recipient: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  stellarHash?: string;
  createdAt: string;
  confirmedAt?: string;
  errorMessage?: string;
}

interface RealTimePaymentStats {
  activeBatches: number;
  totalTransactionsToday: number;
  totalVolumeToday: number;
  successRate: number;
  averageProcessingTime: number;
}

export const RealTimePaymentMonitor: React.FC = () => {
  const { socket, connected } = useSocket();
  const { notifySuccess, notifyError } = useNotification();
  
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [stats, setStats] = useState<RealTimePaymentStats>({
    activeBatches: 0,
    totalTransactionsToday: 0,
    totalVolumeToday: 0,
    successRate: 0,
    averageProcessingTime: 0,
  });
  const [selectedBatch, setSelectedBatch] = useState<PaymentBatch | null>(null);
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    if (!socket || !connected) return;

    // Listen for payment batch updates
    socket.on('payment-batch:created', handleBatchCreated);
    socket.on('payment-batch:updated', handleBatchUpdated);
    socket.on('payment-batch:completed', handleBatchCompleted);
    
    // Listen for individual transaction updates
    socket.on('transaction:status', handleTransactionStatus);
    socket.on('transaction:confirmed', handleTransactionConfirmed);
    socket.on('transaction:failed', handleTransactionFailed);
    
    // Listen for stats updates
    socket.on('stats:updated', handleStatsUpdated);

    // Request initial data
    socket.emit('subscribe:admin:payments');
    socket.emit('request:payment:stats');

    return () => {
      socket.off('payment-batch:created', handleBatchCreated);
      socket.off('payment-batch:updated', handleBatchUpdated);
      socket.off('payment-batch:completed', handleBatchCompleted);
      socket.off('transaction:status', handleTransactionStatus);
      socket.off('transaction:confirmed', handleTransactionConfirmed);
      socket.off('transaction:failed', handleTransactionFailed);
      socket.off('stats:updated', handleStatsUpdated);
      
      socket.emit('unsubscribe:admin:payments');
    };
  }, [socket, connected]);

  const handleBatchCreated = (batch: PaymentBatch) => {
    setBatches(prev => [batch, ...prev]);
    notifySuccess('New Payment Batch', `Batch ${batch.id.slice(0, 8)}... created with ${batch.recipientCount} recipients`);
  };

  const handleBatchUpdated = (updatedBatch: PaymentBatch) => {
    setBatches(prev => prev.map(batch => 
      batch.id === updatedBatch.id ? updatedBatch : batch
    ));
    
    if (selectedBatch?.id === updatedBatch.id) {
      setSelectedBatch(updatedBatch);
    }
  };

  const handleBatchCompleted = (completedBatch: PaymentBatch) => {
    setBatches(prev => prev.map(batch => 
      batch.id === completedBatch.id ? completedBatch : batch
    ));
    
    const successCount = completedBatch.transactions.filter(t => t.status === 'confirmed').length;
    notifySuccess('Batch Completed', 
      `Batch ${completedBatch.id.slice(0, 8)}... completed: ${successCount}/${completedBatch.recipientCount} successful`
    );
  };

  const handleTransactionStatus = (transaction: Transaction) => {
    setBatches(prev => prev.map(batch => {
      if (batch.id === transaction.batchId) {
        const updatedTransactions = batch.transactions.map(t => 
          t.id === transaction.id ? transaction : t
        );
        return { ...batch, transactions: updatedTransactions };
      }
      return batch;
    }));
  };

  const handleTransactionConfirmed = (transaction: Transaction) => {
    handleTransactionStatus(transaction);
    
    if (selectedBatch?.id === transaction.batchId) {
      setSelectedBatch(prev => prev ? {
        ...prev,
        transactions: prev.transactions.map(t => 
          t.id === transaction.id ? transaction : t
        )
      } : null);
    }
  };

  const handleTransactionFailed = (transaction: Transaction) => {
    handleTransactionStatus(transaction);
    notifyError('Transaction Failed', 
      `Transaction to ${transaction.recipient.slice(0, 8)}... failed: ${transaction.errorMessage}`
    );
  };

  const handleStatsUpdated = (newStats: RealTimePaymentStats) => {
    setStats(newStats);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return 'text-emerald-500 bg-emerald-500/20 border-emerald-500/30';
      case 'processing':
        return 'text-blue-500 bg-blue-500/20 border-blue-500/30';
      case 'failed':
        return 'text-red-500 bg-red-500/20 border-red-500/30';
      default:
        return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 border border-hi rounded-xl bg-black/20">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-sm font-medium">
            {connected ? 'Real-time Connected' : 'Disconnected'}
          </span>
        </div>
        <Activity className="w-5 h-5 text-muted" />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 border border-hi rounded-xl bg-black/20">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted">Active Batches</span>
          </div>
          <div className="text-2xl font-bold">{stats.activeBatches}</div>
        </div>
        
        <div className="p-4 border border-hi rounded-xl bg-black/20">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted">Transactions Today</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalTransactionsToday}</div>
        </div>
        
        <div className="p-4 border border-hi rounded-xl bg-black/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted">Volume Today</span>
          </div>
          <div className="text-2xl font-bold">${stats.totalVolumeToday.toLocaleString()}</div>
        </div>
        
        <div className="p-4 border border-hi rounded-xl bg-black/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-muted">Success Rate</span>
          </div>
          <div className="text-2xl font-bold">{(stats.successRate * 100).toFixed(1)}%</div>
        </div>
        
        <div className="p-4 border border-hi rounded-xl bg-black/20">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-muted">Avg Processing</span>
          </div>
          <div className="text-2xl font-bold">{stats.averageProcessingTime}s</div>
        </div>
      </div>

      {/* Batches List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Live Payment Batches
        </h3>
        
        {batches.length === 0 ? (
          <div className="p-8 border border-hi rounded-xl text-center text-muted">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No active payment batches</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map(batch => (
              <div 
                key={batch.id}
                className="p-4 border border-hi rounded-xl bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                onClick={() => setSelectedBatch(batch)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(batch.status)}
                    <span className="font-mono text-sm">{batch.id.slice(0, 8)}...</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(batch.status)}`}>
                      {batch.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">${batch.totalAmount.toLocaleString()}</div>
                    <div className="text-xs text-muted">{batch.currency}</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-muted">
                      {batch.transactions.filter(t => t.status === 'confirmed').length} / {batch.recipientCount} confirmed
                    </span>
                    <span className="text-muted">
                      {new Date(batch.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {batch.status === 'processing' && batch.estimatedCompletion && (
                    <div className="flex items-center gap-2 text-yellow-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">
                        ETA: {new Date(batch.estimatedCompletion).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="w-full bg-black/40 rounded-full h-2">
                    <div 
                      className="bg-accent h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(batch.transactions.filter(t => t.status === 'confirmed').length / batch.recipientCount) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Batch Details */}
      {selectedBatch && (
        <div className="p-6 border border-hi rounded-xl bg-black/20">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold">Batch Details: {selectedBatch.id.slice(0, 8)}...</h4>
            <button 
              onClick={() => setSelectedBatch(null)}
              className="text-muted hover:text-text transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-3">
            {selectedBatch.transactions.map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between p-3 border border-hi/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(transaction.status)}
                  <div>
                    <div className="font-mono text-sm">
                      {transaction.recipient.slice(0, 8)}...{transaction.recipient.slice(-4)}
                    </div>
                    {transaction.stellarHash && (
                      <div className="text-xs text-muted font-mono">
                        Hash: {transaction.stellarHash.slice(0, 12)}...
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-bold">${transaction.amount}</div>
                  <div className={`text-xs px-2 py-1 rounded border ${getStatusColor(transaction.status)}`}>
                    {transaction.status}
                  </div>
                  {transaction.errorMessage && (
                    <div className="text-xs text-red-400 mt-1">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      {transaction.errorMessage}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
