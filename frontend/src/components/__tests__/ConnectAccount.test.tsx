import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectAccount from '../ConnectAccount';

// --- Mocks (must be declared before the component import is used) ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { useWalletMock } = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
}));

vi.mock('../../hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

function walletState(overrides: Record<string, unknown> = {}) {
  return {
    address: null as string | null,
    isConnecting: false,
    connect: mockConnect,
    disconnect: mockDisconnect,
    ...overrides,
  };
}

describe('ConnectAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default: wallet disconnected
    useWalletMock.mockReturnValue(walletState());
  });

  it('renders Sign In and Connect buttons when wallet is disconnected', () => {
    render(<ConnectAccount />);

    expect(screen.getByText('connectAccount.connect')).toBeInTheDocument();
    expect(screen.getByText('connectAccount.wallet')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
  });

  it('shows Exit button and Stellar address when wallet is connected', () => {
    useWalletMock.mockReturnValue(
      walletState({ address: 'GABCDEF1234567890ABCDEF1234567890' }),
    );

    render(<ConnectAccount />);

    expect(screen.getByText('GABCDE...7890')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();
    expect(screen.queryByText('connectAccount.connect')).not.toBeInTheDocument();
  });

  it('shows Social Active badge when auth token is present', () => {
    localStorage.setItem('payd_auth_token', 'mock-token');

    render(<ConnectAccount />);

    expect(screen.getByText('Social Active')).toBeInTheDocument();
    expect(screen.getByText('Session Active')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();
  });

  it('shows connecting state with spinner text', () => {
    useWalletMock.mockReturnValue(walletState({ isConnecting: true }));

    render(<ConnectAccount />);

    expect(screen.getByText('connectAccount.connecting')).toBeInTheDocument();
    expect(screen.queryByText('connectAccount.connect')).not.toBeInTheDocument();
  });

  it('navigates to /login when Sign In is clicked', async () => {
    const user = userEvent.setup();
    render(<ConnectAccount />);

    await user.click(screen.getByText('Sign In'));

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('calls connect when Connect Wallet button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConnectAccount />);

    await user.click(screen.getByText('connectAccount.connect'));

    expect(mockConnect).toHaveBeenCalled();
  });

  it('calls disconnect and clears localStorage on Exit', async () => {
    useWalletMock.mockReturnValue(
      walletState({ address: 'GABCDEF1234567890' }),
    );
    localStorage.setItem('payd_auth_token', 'mock-token');

    const user = userEvent.setup();
    render(<ConnectAccount />);

    await user.click(screen.getByText('Exit'));

    expect(mockDisconnect).toHaveBeenCalled();
    expect(localStorage.getItem('payd_auth_token')).toBeNull();
  });
});