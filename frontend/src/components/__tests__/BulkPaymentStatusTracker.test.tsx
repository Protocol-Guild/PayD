import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkPaymentStatusTracker } from '../BulkPaymentStatusTracker';
import type { PayrollRunRecord, PayrollRunSummary, PayrollRecipientStatus } from '../../services/bulkPaymentStatus';

// ---- Mock every module the component imports ----

const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();
const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();
const mockSocketEmit = vi.fn();
const mockSocket = {
  on: mockSocketOn,
  off: mockSocketOff,
  emit: mockSocketEmit,
};
const mockSign = vi.fn();

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifyError: mockNotifyError,
    notifySuccess: mockNotifySuccess,
  }),
}));

vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({ socket: mockSocket, connected: true }),
}));

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({ address: 'GABC123...TEST', connect: vi.fn(), disconnect: vi.fn(), isConnecting: false }),
}));

vi.mock('../../hooks/useWalletSigning', () => ({
  useWalletSigning: () => ({ sign: mockSign, isSigning: false, error: null, isReady: true }),
}));

vi.mock('../../services/contracts', () => ({
  contractService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getContractId: vi.fn().mockReturnValue('CAFEFACE1234567890'),
  },
}));

const mockFetchPayrollRuns = vi.fn();
const mockFetchPayrollRunSummary = vi.fn();
const mockRetryFailedBatch = vi.fn();
vi.mock('../../services/bulkPaymentStatus', () => ({
  fetchPayrollRuns: (...args: unknown[]) => mockFetchPayrollRuns(...args),
  fetchPayrollRunSummary: (...args: unknown[]) => mockFetchPayrollRunSummary(...args),
  getTxExplorerUrl: (txHash: string, network?: string) =>
    `https://stellar.expert/explorer/${network ?? 'testnet'}/tx/${txHash}`,
  retryFailedBatch: (...args: unknown[]) => mockRetryFailedBatch(...args),
}));

// ---- Helpers ----

const baseRun: PayrollRunRecord = {
  id: 1,
  batch_id: 'BATCH-001',
  status: 'pending',
  total_amount: '5000',
  asset_code: 'USDC',
  created_at: '2026-08-20T10:00:00Z',
};

const completedRun: PayrollRunRecord = {
  ...baseRun,
  id: 2,
  batch_id: 'BATCH-002',
  status: 'completed',
  total_amount: '10000',
};

const failedRun: PayrollRunRecord = {
  ...baseRun,
  id: 3,
  batch_id: 'BATCH-003',
  status: 'failed',
  total_amount: '2500',
};

const summaryItem: PayrollRecipientStatus = {
  id: 10,
  employee_id: 100,
  employee_first_name: 'Alice',
  employee_last_name: 'Smith',
  amount: '5000',
  status: 'completed',
  tx_hash: 'TXHASH1234567890',
};

const mockSummary: PayrollRunSummary = {
  payroll_run: baseRun,
  items: [summaryItem],
  summary: { total_employees: 1, total_amount: '5000' },
};

function renderTracker(orgId = 1) {
  return render(<BulkPaymentStatusTracker organizationId={orgId} />);
}

describe('BulkPaymentStatusTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPayrollRuns.mockResolvedValue({ data: [], total: 0 });
  });

  it('renders title', () => {
    renderTracker();
    expect(screen.getByText('Bulk Payment Status Tracker')).toBeInTheDocument();
  });

  it('calls fetchPayrollRuns on mount', async () => {
    renderTracker(42);

    await waitFor(() => {
      expect(mockFetchPayrollRuns).toHaveBeenCalledWith(42, 1, 20);
    });
  });

  it('shows empty state when there are no runs', async () => {
    renderTracker();

    await waitFor(() => {
      expect(screen.getByText('No payroll batch runs found.')).toBeInTheDocument();
    });
  });

  it('renders payroll runs in the table', async () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [baseRun, completedRun], total: 2 });

    renderTracker();

    await waitFor(() => {
      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
      expect(screen.getByText('BATCH-002')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    mockFetchPayrollRuns.mockRejectedValue(new Error('Network error'));

    renderTracker();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(mockNotifyError).toHaveBeenCalledWith(
      'Bulk payment load failed',
      'Network error',
    );
  });

  it('calls fetchPayrollRuns again when Refresh is clicked', async () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [baseRun], total: 1 });

    renderTracker();

    await waitFor(() => {
      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Refresh'));

    expect(mockFetchPayrollRuns).toHaveBeenCalledTimes(2);
  });

  it('expands a row to show recipient details', async () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [baseRun], total: 1 });
    mockFetchPayrollRunSummary.mockResolvedValue(mockSummary);

    renderTracker();

    await waitFor(() => {
      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Details'));

    await waitFor(() => {
      expect(mockFetchPayrollRunSummary).toHaveBeenCalledWith(1);
    });

    // "Alice Smith" in the expanded row
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
  });

  it('shows Retry Failed button for batches with failed recipients', async () => {
    const failedSummary: PayrollRunSummary = {
      ...mockSummary,
      items: [
        {
          ...summaryItem,
          status: 'failed',
          tx_hash: undefined,
        },
      ],
    };
    mockFetchPayrollRuns.mockResolvedValue({ data: [failedRun], total: 1 });
    mockFetchPayrollRunSummary.mockResolvedValue(failedSummary);

    renderTracker();

    await waitFor(() => {
      expect(screen.getByText('BATCH-003')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Details'));

    await waitFor(() => {
      expect(mockFetchPayrollRunSummary).toHaveBeenCalledWith(3);
    });

    // Desktop + mobile both render Retry Failed — but at least one exists
    await waitFor(() => {
      const retryButtons = screen.getAllByText('Retry Failed');
      expect(retryButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('sets up socket event listeners on mount', async () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [baseRun], total: 1 });

    renderTracker();

    await waitFor(() => {
      expect(mockSocketOn).toHaveBeenCalledWith('bulk:confirmation', expect.any(Function));
      expect(mockSocketOn).toHaveBeenCalledWith('bulk_payment:confirmation', expect.any(Function));
    });
  });

  it('subscribes to socket events for each batch', async () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [baseRun, completedRun], total: 2 });

    renderTracker();

    await waitFor(() => {
      expect(mockSocketEmit).toHaveBeenCalledWith('subscribe:bulk', { batchId: 'BATCH-001' });
      expect(mockSocketEmit).toHaveBeenCalledWith('subscribe:bulk', { batchId: 'BATCH-002' });
    });
  });

  it('cleans up socket subscriptions on unmount', async () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [baseRun], total: 1 });

    const { unmount } = renderTracker();

    await waitFor(() => {
      expect(mockSocketEmit).toHaveBeenCalled();
    });

    unmount();

    expect(mockSocketOff).toHaveBeenCalled();
    expect(mockSocketEmit).toHaveBeenCalledWith('unsubscribe:bulk', { batchId: 'BATCH-001' });
  });
});