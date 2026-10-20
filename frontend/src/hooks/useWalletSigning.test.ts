import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWalletSigning } from './useWalletSigning.js';

const signTransaction = vi.fn();
const requireWallet = vi.fn();
const notifyError = vi.fn();

let walletState: { address: string | null; isConnecting: boolean };

vi.mock('./useWallet.js', () => ({
  useWallet: () => ({
    signTransaction,
    requireWallet,
    get address() {
      return walletState.address;
    },
    get isConnecting() {
      return walletState.isConnecting;
    },
  }),
}));

vi.mock('./useNotification.js', () => ({
  useNotification: () => ({ notifyError }),
}));

describe('useWalletSigning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletState = { address: 'GABCDEF', isConnecting: false };
    // By default requireWallet just invokes the callback, as the real
    // implementation does when a wallet is already connected.
    requireWallet.mockImplementation((cb: () => unknown) => cb());
  });

  it('reports isReady only when an address is present and not connecting', () => {
    const { result, rerender } = renderHook(() => useWalletSigning());
    expect(result.current.isReady).toBe(true);

    walletState = { address: null, isConnecting: false };
    rerender();
    expect(result.current.isReady).toBe(false);

    walletState = { address: 'GABCDEF', isConnecting: true };
    rerender();
    expect(result.current.isReady).toBe(false);
  });

  it('signs a transaction and tracks isSigning around the call', async () => {
    signTransaction.mockResolvedValue('SIGNED_XDR');
    const { result } = renderHook(() => useWalletSigning());

    expect(result.current.isSigning).toBe(false);

    let signed: string | undefined;
    await act(async () => {
      signed = await result.current.sign('RAW_XDR');
    });

    expect(signed).toBe('SIGNED_XDR');
    expect(signTransaction).toHaveBeenCalledWith('RAW_XDR');
    expect(result.current.isSigning).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('captures the error message and notifies on signing failure', async () => {
    requireWallet.mockImplementation(() => Promise.reject(new Error('User rejected')));
    const { result } = renderHook(() => useWalletSigning());

    await act(async () => {
      await expect(result.current.sign('RAW_XDR')).rejects.toThrow('User rejected');
    });

    expect(result.current.error).toBe('User rejected');
    expect(notifyError).toHaveBeenCalledWith('Signing failed', 'User rejected');
    expect(result.current.isSigning).toBe(false);
  });
});
