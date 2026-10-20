import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BulkPaymentStatusTracker } from '../components/BulkPaymentStatusTracker';

// Use vi.hoisted for mock variables
const mockFetchPayrollRuns = vi.hoisted(() => vi.fn());
const mockFetchPayrollRunSummary = vi.hoisted(() => vi.fn());
const mockRetryFailedBatch = vi.hoisted(() => vi.fn());
const mockGetTxExplorerUrl = vi.hoisted(() => vi.fn((hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`));

vi.mock('../services/bulkPaymentStatus', () => ({
  fetchPayrollRuns: mockFetchPayrollRuns,
  fetchPayrollRunSummary: mockFetchPayrollRunSummary,
  getTxExplorerUrl: mockGetTxExplorerUrl,
  retryFailedBatch: mockRetryFailedBatch,
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    notifyError: vi.fn(),
    notifySuccess: vi.fn(),
  }),
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    socket: null,
  }),
}));

vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({
    address: null,
  }),
}));

vi.mock('../hooks/useWalletSigning', () => ({
  useWalletSigning: () => ({
    sign: vi.fn(),
  }),
}));

vi.mock('../services/contracts', () => ({
  contractService: {
    initialize: vi.fn(),
    getContractId: vi.fn(),
  },
}));

describe('BulkPaymentStatusTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the component title', () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [] });
    render(<BulkPaymentStatusTracker organizationId={1} />);
    expect(screen.getByText('Bulk Payment Status Tracker')).toBeTruthy();
  });

  it('shows loading state initially', () => {
    mockFetchPayrollRuns.mockReturnValue(new Promise(() => {}));
    render(<BulkPaymentStatusTracker organizationId={1} />);
    expect(screen.getByText(/Loading bulk payroll runs/)).toBeTruthy();
  });

  it('shows empty state when no payroll runs exist', async () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [] });
    render(<BulkPaymentStatusTracker organizationId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByText('No payroll batch runs found.')).toBeTruthy();
    });
  });

  it('shows a refresh button', () => {
    mockFetchPayrollRuns.mockResolvedValue({ data: [] });
    render(<BulkPaymentStatusTracker organizationId={1} />);
    expect(screen.getByText('Refresh')).toBeTruthy();
  });
});