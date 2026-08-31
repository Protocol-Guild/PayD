import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFeeEstimation } from '../hooks/useFeeEstimation';
import type { FeeRecommendation, BatchBudgetEstimate, CongestionLevel } from '../services/feeEstimation';

const { getFeeRecommendationMock, estimateBatchPaymentBudgetMock } = vi.hoisted(() => ({
  getFeeRecommendationMock: vi.fn(),
  estimateBatchPaymentBudgetMock: vi.fn(),
}));

vi.mock('../services/feeEstimation', () => ({
  getFeeRecommendation: (...args: unknown[]) => getFeeRecommendationMock(...args),
  estimateBatchPaymentBudget: (...args: unknown[]) => estimateBatchPaymentBudgetMock(...args),
}));

const mockRecommendation: FeeRecommendation = {
  baseFee: 100,
  recommendedFee: 150,
  maxFee: 200,
  congestionLevel: 'low' as CongestionLevel,
  shouldBumpFee: false,
  ledgerCapacityUsage: 0.1,
  lastLedger: 12345,
  recommendedFeeXLM: '0.0000150',
  maxFeeXLM: '0.0000200',
  baseFeeXLM: '0.0000100',
};

const mockBatchEstimate: BatchBudgetEstimate = {
  transactionCount: 10,
  feePerTransaction: 150,
  totalBudget: 1500,
  totalBudgetXLM: '0.0001500',
  feePerTransactionXLM: '0.0000150',
  safetyMargin: 1.0,
  congestionLevel: 'low' as CongestionLevel,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useFeeEstimation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFeeRecommendationMock.mockResolvedValue(mockRecommendation);
  });

  it('fetches fee recommendation on mount', async () => {
    const { result } = renderHook(() => useFeeEstimation(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getFeeRecommendationMock).toHaveBeenCalledOnce();
    expect(result.current.feeRecommendation).toEqual(mockRecommendation);
    expect(result.current.isError).toBe(false);
  });

  it('exposes error state when the API call fails', async () => {
    getFeeRecommendationMock.mockRejectedValue(new Error('Horizon unreachable'));

    const { result } = renderHook(() => useFeeEstimation(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.feeRecommendation).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('refetches when refetch is called', async () => {
    const { result } = renderHook(() => useFeeEstimation(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(getFeeRecommendationMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(getFeeRecommendationMock).toHaveBeenCalledTimes(2);
  });

  it('estimates batch budget via estimateBatch', async () => {
    estimateBatchPaymentBudgetMock.mockResolvedValue(mockBatchEstimate);

    const { result } = renderHook(() => useFeeEstimation(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let estimate: BatchBudgetEstimate | undefined;
    await act(async () => {
      estimate = await result.current.estimateBatch(10);
    });

    expect(estimateBatchPaymentBudgetMock).toHaveBeenCalledWith(10);
    expect(estimate).toEqual(mockBatchEstimate);
  });

  it('surfaces error when estimateBatch fails', async () => {
    estimateBatchPaymentBudgetMock.mockRejectedValue(new Error('Estimate failed'));

    const { result } = renderHook(() => useFeeEstimation(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.estimateBatch(5)).rejects.toThrow('Estimate failed');
  });
});