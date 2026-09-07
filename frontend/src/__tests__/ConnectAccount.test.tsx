import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ConnectAccount from '../components/ConnectAccount';

// Mock useWallet
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
let mockAddress: string | null = null;
let mockIsConnecting = false;
let mockToken: string | null = null;

vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({
    address: mockAddress,
    isConnecting: mockIsConnecting,
    connect: mockConnect,
    disconnect: mockDisconnect,
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ConnectAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = null;
    mockIsConnecting = false;
    mockToken = null;
    localStorageMock.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders sign-in and connect buttons when not connected', () => {
    render(<ConnectAccount />);
    expect(screen.getByText(/Sign In/)).toBeTruthy();
    // i18n returns the key, so the button has 'connectAccount.connect'
    expect(screen.getByRole('button', { name: /connectAccount/ })).toBeTruthy();
  });

  it('shows the wallet address and exit button when connected', () => {
    mockAddress = 'GA12345ABCDEFGHIJKLMNOPQRSTUVWXYZ67890';
    render(<ConnectAccount />);
    expect(screen.getByText(/GA12/)).toBeTruthy();
    expect(screen.getByText(/7890/)).toBeTruthy();
    expect(screen.getByText('Exit')).toBeTruthy();
  });

  it('shows social active badge when token exists in localStorage', () => {
    mockToken = 'some-auth-token';
    localStorageMock.setItem('payd_auth_token', mockToken);
    render(<ConnectAccount />);
    expect(screen.getByText('Social Active')).toBeTruthy();
    expect(screen.getByText('Session Active')).toBeTruthy();
  });

  it('disables connect button when isConnecting', () => {
    mockIsConnecting = true;
    render(<ConnectAccount />);
    // "Connecting..." is translated via i18n, so the key is 'connectAccount.connecting'
    expect(screen.getByText(/connectAccount.connecting/)).toBeTruthy();
  });

  it('calls connect when the connect button is clicked', () => {
    render(<ConnectAccount />);
    // The button text is 'connectAccount.connect' (i18n key)
    fireEvent.click(screen.getByRole('button', { name: /connectAccount/ }));
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('calls disconnect when Exit is clicked and wallet is connected', () => {
    mockAddress = 'GA12345';
    render(<ConnectAccount />);
    fireEvent.click(screen.getByText('Exit'));
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('removes auth token and reloads when Exit is clicked with social login', () => {
    mockToken = 'some-auth-token';
    localStorageMock.setItem('payd_auth_token', mockToken);

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(<ConnectAccount />);
    fireEvent.click(screen.getByText('Exit'));
    expect(localStorageMock.getItem('payd_auth_token')).toBeNull();
    expect(reloadMock).toHaveBeenCalled();
  });
});