import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEmployeePortal } from '../hooks/useEmployeePortal';

// Mock services used by useEmployeePortal
const { mockFetchExchangeRates, mockGetStellarExpertLink, mockGetMyDeductionsDraftPayslip } = vi.hoisted(() => ({
  mockFetchExchangeRates: vi.fn(),
  mockGetStellarExpertLink: vi.fn(),
  mockGetMyDeductionsDraftPayslip: vi.fn(),
}));

vi.mock('../services/currencyConversion', () => ({
  fetchExchangeRates: (...args: unknown[]) => mockFetchExchangeRates(...args),
  getStellarExpertLink: (...args: unknown[]) => mockGetStellarExpertLink(...args),
}));

vi.mock('../services/benefitsApi', () => ({
  getMyDeductionsDraftPayslip: (...args: unknown[]) => mockGetMyDeductionsDraftPayslip(...args),
}));

describe('useEmployeePortal', () => {
  beforeEach(() => {
    mockFetchExchangeRates.mockResolvedValue({ NGN: 1500, USD: 1, EUR: 0.85 });
    mockGetStellarExpertLink.mockReturnValue('https://stellar.expert/explorer/testnet/tx/hash');
    mockGetMyDeductionsDraftPayslip.mockResolvedValue({
      organization_id: 1,
      employee_id: 42,
      currency: 'ORGUSD',
      gross_amount: 2500,
      lines: [],
      total_deductions: 500,
      net_amount: 2000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads data on mount and sets balance', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    // Wait for the async data loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    expect(result.current.balance).not.toBeNull();
    expect(result.current.balance?.orgUsd).toBeGreaterThan(0);
    expect(result.current.balance?.localCurrency).toBe('NGN');
    expect(result.current.deductionsDraft).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets error when data loading fails', async () => {
    mockFetchExchangeRates.mockRejectedValue(new Error('API unavailable'));

    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    expect(result.current.error).toBe('API unavailable');
    expect(result.current.balance).toBeNull();
  });

  it('shows paginated transactions with default 8 items per page', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    // 12 mock transactions, 8 per page = 2 pages
    expect(result.current.transactions.length).toBeLessThanOrEqual(8);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.currentPage).toBe(1);
  });

  it('navigates pages with setCurrentPage', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    await act(async () => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);
  });

  it('filters transactions by status', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    await act(async () => {
      result.current.setFilterStatus('pending');
    });
    expect(result.current.filterStatus).toBe('pending');
    const allPending = result.current.filteredTransactions.every(
      (tx) => tx.status === 'pending'
    );
    expect(allPending).toBe(true);
  });

  it('filters transactions by type', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    await act(async () => {
      result.current.setFilterType('bonus');
    });
    expect(result.current.filterType).toBe('bonus');
    const allBonuses = result.current.filteredTransactions.every(
      (tx) => tx.type === 'bonus'
    );
    expect(allBonuses).toBe(true);
  });

  it('searches transactions by memo text', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    await act(async () => {
      result.current.setSearchQuery('Bonus');
    });
    expect(result.current.searchQuery).toBe('Bonus');
    const matching = result.current.filteredTransactions.every(
      (tx) => tx.memo.toLowerCase().includes('bonus')
    );
    expect(matching).toBe(true);
  });

  it('resets to page 1 when currency changes', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    await act(async () => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    await act(async () => {
      result.current.setSelectedCurrency('EUR');
    });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.selectedCurrency).toBe('EUR');
  });

  it('resets to page 1 when filter status changes', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    result.current.setCurrentPage(2);
    result.current.setFilterStatus('completed');
    expect(result.current.currentPage).toBe(1);
  });

  it('resets to page 1 when filter type changes', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    result.current.setCurrentPage(2);
    result.current.setFilterType('salary');
    expect(result.current.currentPage).toBe(1);
  });
});