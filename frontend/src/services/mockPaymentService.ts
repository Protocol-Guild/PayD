// Mock service for simulating real-time payment events
// This would be replaced with actual backend socket events

export interface MockPaymentBatch {
  id: string;
  totalAmount: number;
  currency: string;
  recipientCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  estimatedCompletion?: string;
  transactions: MockTransaction[];
}

export interface MockTransaction {
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

export interface MockPaymentStats {
  activeBatches: number;
  totalTransactionsToday: number;
  totalVolumeToday: number;
  successRate: number;
  averageProcessingTime: number;
}

class MockPaymentService {
  private static instance: MockPaymentService;
  private batches: Map<string, MockPaymentBatch> = new Map();
  private eventCallbacks: Map<string, Function[]> = new Map();

  static getInstance(): MockPaymentService {
    if (!MockPaymentService.instance) {
      MockPaymentService.instance = new MockPaymentService();
    }
    return MockPaymentService.instance;
  }

  // Event system for simulating socket events
  on(event: string, callback: Function) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Mock data generation
  generateMockBatch(): MockPaymentBatch {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const recipientCount = Math.floor(Math.random() * 50) + 10;
    const amountPerRecipient = Math.floor(Math.random() * 4000) + 1000;
    
    const transactions: MockTransaction[] = Array.from({ length: recipientCount }, (_, i) => ({
      id: `tx_${batchId}_${i}`,
      batchId,
      recipient: `G${Array(56).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'[Math.floor(Math.random() * 36)]).join('')}`,
      amount: amountPerRecipient + Math.floor(Math.random() * 1000) - 500,
      currency: 'USDC',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }));

    const batch: MockPaymentBatch = {
      id: batchId,
      totalAmount: transactions.reduce((sum, tx) => sum + tx.amount, 0),
      currency: 'USDC',
      recipientCount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      transactions,
    };

    this.batches.set(batchId, batch);
    return batch;
  }

  // Simulate batch processing
  async processBatch(batchId: string) {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    // Update batch to processing
    batch.status = 'processing';
    batch.estimatedCompletion = new Date(Date.now() + 30000).toISOString();
    this.emit('payment-batch:updated', batch);

    // Process transactions one by one
    for (let i = 0; i < batch.transactions.length; i++) {
      const transaction = batch.transactions[i];
      
      // Update to processing
      transaction.status = 'processing';
      this.emit('transaction:status', transaction);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
      
      // Random success/failure
      const isSuccess = Math.random() > 0.1; // 90% success rate
      
      if (isSuccess) {
        transaction.status = 'confirmed';
        transaction.stellarHash = `hash_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
        transaction.confirmedAt = new Date().toISOString();
        this.emit('transaction:confirmed', transaction);
      } else {
        transaction.status = 'failed';
        transaction.errorMessage = ['Insufficient funds', 'Network timeout', 'Invalid signature'][Math.floor(Math.random() * 3)];
        this.emit('transaction:failed', transaction);
      }
      
      // Update batch progress
      this.emit('payment-batch:updated', batch);
    }

    // Complete batch
    batch.status = 'completed';
    this.emit('payment-batch:completed', batch);
  }

  // Get current stats
  getStats(): MockPaymentStats {
    const allBatches = Array.from(this.batches.values());
    const today = new Date().toDateString();
    
    const todayBatches = allBatches.filter(batch => 
      new Date(batch.createdAt).toDateString() === today
    );
    
    const allTransactions = todayBatches.flatMap(batch => batch.transactions);
    const successfulTransactions = allTransactions.filter(tx => tx.status === 'confirmed');
    
    return {
      activeBatches: allBatches.filter(batch => batch.status === 'processing').length,
      totalTransactionsToday: allTransactions.length,
      totalVolumeToday: allTransactions.reduce((sum, tx) => sum + tx.amount, 0),
      successRate: allTransactions.length > 0 ? successfulTransactions.length / allTransactions.length : 0,
      averageProcessingTime: 15.5, // Mock average processing time in seconds
    };
  }

  // Start mock simulation
  startSimulation() {
    // Generate initial batches
    setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance every 5 seconds
        const batch = this.generateMockBatch();
        this.emit('payment-batch:created', batch);
        
        // Start processing after a short delay
        setTimeout(() => {
          void this.processBatch(batch.id);
        }, 2000);
      }
    }, 5000);

    // Update stats periodically
    setInterval(() => {
      this.emit('stats:updated', this.getStats());
    }, 3000);
  }
}

export const mockPaymentService = MockPaymentService.getInstance();
