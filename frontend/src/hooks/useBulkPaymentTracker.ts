import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import {
  BatchRun,
  BatchRecipient,
  BulkPaymentFilters,
  fetchBulkPaymentBatches,
  retryBatchPayment,
} from '../services/bulkPaymentApi';
import { useNotification } from './useNotification';

export interface UseBulkPaymentTrackerReturn {
  batches: BatchRun[];
  total: number;
  totalPages: number;
  page: number;
  setPage: (p: number) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  expandedBatchId: string | null;
  toggleExpand: (id: string) => void;
  retryingBatchId: string | null;
  handleRetry: (batchId: string) => Promise<void>;
}

export function useBulkPaymentTracker(): UseBulkPaymentTrackerReturn {
  const { socket } = useSocket();
  const { notifySuccess, notifyError } = useNotification();

  const [batches, setBatches] = useState<BatchRun[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [retryingBatchId, setRetryingBatchId] = useState<string | null>(null);

  // keep a stable ref so the socket handler sees fresh batches
  const batchesRef = useRef<BatchRun[]>(batches);
  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  const loadBatches = useCallback(
    async (filters: BulkPaymentFilters) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchBulkPaymentBatches(filters);
        setBatches(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load bulk payment data.';
        setError(msg);
        notifyError('Load failed', msg);
      } finally {
        setIsLoading(false);
      }
    },
    [notifyError]
  );

  useEffect(() => {
    const fetchB = async () => {
      await loadBatches({ page, limit: 10, status: statusFilter });
    };
    void fetchB();
  }, [page, statusFilter, loadBatches]);

  const refresh = useCallback(() => {
    void loadBatches({ page, limit: 10, status: statusFilter });
  }, [page, statusFilter, loadBatches]);

  // ── WebSocket: listen for real-time confirmation updates ────────────────
  useEffect(() => {
    if (!socket) return;

    const handleBatchUpdate = (data: {
      batchId: string;
      confirmations?: number;
      status?: BatchRun['status'];
      recipientId?: string;
      recipientStatus?: 'pending' | 'confirmed' | 'failed';
    }) => {
      setBatches((prev: BatchRun[]) =>
        prev.map((batch: BatchRun) => {
          if (batch.id !== data.batchId) return batch;

          const updated: BatchRun = {
            ...batch,
            confirmations: data.confirmations ?? batch.confirmations,
            status: data.status ?? batch.status,
          };

          if (data.recipientId && data.recipientStatus) {
            updated.recipients = batch.recipients.map((r: BatchRecipient) =>
              r.id === data.recipientId ? { ...r, status: data.recipientStatus! } : r
            );
          }

          return updated;
        })
      );

      if (data.status === 'confirmed') {
        notifySuccess('Batch confirmed!', `All payments in batch ${data.batchId} are confirmed.`);
      }
    };

    socket.on('bulk_payment:update', handleBatchUpdate);
    return () => {
      socket.off('bulk_payment:update', handleBatchUpdate);
    };
  }, [socket, notifySuccess]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedBatchId((prev: string | null) => (prev === id ? null : id));
  }, []);

  const handleRetry = useCallback(
    async (batchId: string) => {
      setRetryingBatchId(batchId);
      try {
        const result = await retryBatchPayment(batchId);
        if (result.success) {
          notifySuccess(
            'Retry successful',
            `Batch ${batchId} has been re-submitted to the network.`
          );
          // Optimistically update status
          setBatches((prev: BatchRun[]) =>
            prev.map((b: BatchRun) =>
              b.id === batchId
                ? {
                    ...b,
                    status: 'pending' as const,
                    confirmations: 0,
                    txHash: result.txHash ?? b.txHash,
                    recipients: b.recipients.map((r: BatchRecipient) =>
                      r.status === 'failed'
                        ? { ...r, status: 'pending' as const, errorMessage: undefined }
                        : r
                    ),
                  }
                : b
            )
          );
        } else {
          notifyError(
            'Retry failed',
            result.error ?? 'The retry attempt was rejected by the network.'
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Retry failed unexpectedly.';
        notifyError('Retry error', msg);
      } finally {
        setRetryingBatchId(null);
      }
    },
    [notifySuccess, notifyError]
  );

  return {
    batches,
    total,
    totalPages,
    page,
    setPage,
    statusFilter,
    setStatusFilter,
    isLoading,
    error,
    refresh,
    expandedBatchId,
    toggleExpand,
    retryingBatchId,
    handleRetry,
  };
}
