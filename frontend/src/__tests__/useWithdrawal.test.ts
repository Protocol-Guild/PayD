import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWithdrawal } from '../hooks/useWithdrawal';

// Mock withdrawal service
const { withdrawalServiceMock } = vi.hoisted(() => ({
  withdrawalServiceMock: {
    getAvailableAnchors: vi.fn(),
    initiateWithdrawal: vi.fn(),
    getTransactionStatus: vi.fn(),
    cancelWithdrawal: vi.fn(),
  },
}));

vi.mock('../services/withdrawal', () => ({
  default: withdrawalServiceMock,
}));

const mockAnchors = [
  {
    domain: 'anchor.physics',
    name: 'Physics Anchor',
    supportedCurrencies: ['XLM', 'NGN', 'USD'],
    withdrawMinAmount: 10,
    withdrawMaxAmount: 10000,
  },
  {
    domain: 'company.anchor',
    name: 'Company Anchor',
    supportedCurrencies: ['XLM', 'NGN'],
  },
];

describe('useWithdrawal', () => {
  const balance = 5000;
  const exchangeRate = 1450;
  const selectedCurrency = 'NGN';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    withdrawalServiceMock.getAvailableAnchors.mockResolvedValue(mockAnchors);
    withdrawalServiceMock.initiateWithdrawal.mockResolvedValue({
      transactionId: 'txn-123',
      interactiveUrl: 'https://anchor.physics/interactive/abc',
      status: 'pending_user_transfer',
    });
    withdrawalServiceMock.getTransactionStatus.mockResolvedValue({
      id: 'txn-123',
      anchorDomain: 'anchor.physics',
      status: 'pending_anchor',
      amountIn: 100,
      assetCode: 'ORGUSD',
      startedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in select_anchor step with empty state', () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    expect(result.current.state.step).toBe('select_anchor');
    expect(result.current.state.anchors).toEqual([]);
    expect(result.current.state.selectedAnchor).toBeNull();
    expect(result.current.state.amount).toBe('');
    expect(result.current.state.estimatedReceive).toBe(0);
    expect(result.current.state.transaction).toBeNull();
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBeNull();
  });

  it('loads available anchors', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    await act(async () => {
      await result.current.loadAnchors();
    });

    expect(withdrawalServiceMock.getAvailableAnchors).toHaveBeenCalled();
    expect(result.current.state.anchors).toEqual(mockAnchors);
    expect(result.current.state.isLoading).toBe(false);
  });

  it('sets error when anchors fail to load', async () => {
    withdrawalServiceMock.getAvailableAnchors.mockRejectedValue(
      new Error('Anchor discovery failed')
    );

    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    await act(async () => {
      await result.current.loadAnchors();
    });

    expect(result.current.state.error).toBe('Anchor discovery failed');
    expect(result.current.state.isLoading).toBe(false);
  });

  it('selects an anchor and advances to enter_amount step', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });

    expect(result.current.state.selectedAnchor).toEqual(mockAnchors[0]);
    expect(result.current.state.step).toBe('enter_amount');
    expect(result.current.state.error).toBeNull();
  });

  it('calculates estimated receive when amount is set', () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    expect(result.current.state.amount).toBe('100');
    // estimatedReceive = amount * exchangeRate when currency is supported
    expect(result.current.state.estimatedReceive).toBe(100 * exchangeRate);
  });

  it('sets error when initiating withdrawal without anchor', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });

    expect(result.current.state.error).toBe('Please select an anchor and enter an amount');
  });

  it('sets error when initiating withdrawal without amount', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });

    expect(result.current.state.error).toBe('Please select an anchor and enter an amount');
  });

  it('rejects invalid amounts', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('0');
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });

    expect(result.current.state.error).toBe('Please enter a valid amount');
  });

  it('rejects amounts exceeding balance', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('6000');
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });

    expect(result.current.state.error).toBe('Insufficient balance');
  });

  it('initiates a withdrawal successfully', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });

    expect(withdrawalServiceMock.initiateWithdrawal).toHaveBeenCalledWith({
      anchorDomain: 'anchor.physics',
      assetCode: 'ORGUSD',
      amount: 100,
      destinationType: 'bank_account',
      destinationDetails: { accountId: 'acc-1' },
    });

    expect(result.current.state.step).toBe('processing');
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.transaction).not.toBeNull();
    expect(result.current.state.transaction?.status).toBe('pending_user_transfer');
    expect(result.current.state.transaction?.interactiveUrl).toBe(
      'https://anchor.physics/interactive/abc'
    );
  });

  it('handles withdrawal initiation failure', async () => {
    withdrawalServiceMock.initiateWithdrawal.mockRejectedValue(
      new Error('Anchor rejected withdrawal')
    );

    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });

    expect(result.current.state.error).toBe('Anchor rejected withdrawal');
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.step).toBe('enter_amount');
  });

  it('opens the interactive URL in a new window', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    // Initiate successfully so transaction is set
    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });
    expect(result.current.state.transaction).not.toBeNull();

    act(() => {
      result.current.openInteractiveUrl();
    });

    expect(window.open).toHaveBeenCalledWith(
      'https://anchor.physics/interactive/abc',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('polls transaction status and completes when terminal state reached', async () => {
    withdrawalServiceMock.getTransactionStatus.mockResolvedValue({
      id: 'txn-123',
      anchorDomain: 'anchor.physics',
      status: 'completed',
      amountIn: 100,
      assetCode: 'ORGUSD',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });

    expect(result.current.state.step).toBe('processing');

    await act(async () => {
      await result.current.pollTransactionStatus();
    });

    expect(result.current.state.step).toBe('complete');
    expect(result.current.state.transaction?.status).toBe('completed');
    expect(result.current.state.isPolling).toBe(false);
  });

  it('polls transaction status and fails when terminal error state reached', async () => {
    withdrawalServiceMock.getTransactionStatus.mockResolvedValue({
      id: 'txn-123',
      anchorDomain: 'anchor.physics',
      status: 'failed',
      amountIn: 100,
      assetCode: 'ORGUSD',
      startedAt: new Date().toISOString(),
      errorMessage: 'Anchor rejected',
    });

    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });

    await act(async () => {
      await result.current.pollTransactionStatus();
    });

    expect(result.current.state.step).toBe('failed');
    expect(result.current.state.transaction?.status).toBe('failed');
  });

  it('handles poll errors', async () => {
    withdrawalServiceMock.getTransactionStatus.mockRejectedValue(
      new Error('Status check timeout')
    );

    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });
    await act(async () => {
      await result.current.pollTransactionStatus();
    });

    expect(result.current.state.error).toBe('Status check timeout');
    expect(result.current.state.isPolling).toBe(false);
  });

  it('cancels an active withdrawal and resets state', async () => {
    withdrawalServiceMock.cancelWithdrawal.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    await act(async () => {
      await result.current.initiateWithdrawal('bank_account', { accountId: 'acc-1' });
    });
    expect(result.current.state.step).toBe('processing');

    await act(async () => {
      await result.current.cancelWithdrawal();
    });

    expect(withdrawalServiceMock.cancelWithdrawal).toHaveBeenCalledWith('txn-123');
    expect(result.current.state.step).toBe('select_anchor');
    expect(result.current.state.transaction).toBeNull();
    expect(result.current.state.selectedAnchor).toBeNull();
    expect(result.current.state.amount).toBe('');
    expect(result.current.state.error).toBeNull();
  });

  it('resets state back to initial values', async () => {
    const { result } = renderHook(() => useWithdrawal(balance, exchangeRate, selectedCurrency));

    await act(async () => {
      await result.current.loadAnchors();
    });
    act(() => {
      result.current.selectAnchor(mockAnchors[0]);
    });
    act(() => {
      result.current.setAmount('100');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.step).toBe('select_anchor');
    expect(result.current.state.anchors).toEqual([]);
    expect(result.current.state.selectedAnchor).toBeNull();
    expect(result.current.state.amount).toBe('');
    expect(result.current.state.estimatedReceive).toBe(0);
    expect(result.current.state.transaction).toBeNull();
  });
});