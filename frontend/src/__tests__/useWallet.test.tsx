import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { WalletContext, type WalletContextType } from '../hooks/useWallet';

describe('useWallet', () => {
  const mockContextValue: WalletContextType = {
    address: 'GABC123...EXAMPLE',
    walletName: 'Freighter',
    isConnecting: false,
    isInitialized: true,
    walletExtensionAvailable: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn().mockResolvedValue('signed-xdr'),
    requireWallet: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns wallet context when used within WalletProvider', () => {
    let capturedValue: WalletContextType | undefined;
    function Consumer() {
      const ctx = React.use(WalletContext);
      capturedValue = ctx;
      return React.createElement('div', { 'data-testid': 'wallet-status' },
        `Address: ${ctx?.address ?? 'none'}`
      );
    }

    render(
      React.createElement(WalletContext.Provider, { value: mockContextValue },
        React.createElement(Consumer)
      )
    );

    expect(screen.getByTestId('wallet-status')).toHaveTextContent('Address: GABC123...EXAMPLE');
    expect(capturedValue?.walletName).toBe('Freighter');
    expect(capturedValue?.isConnecting).toBe(false);
    expect(capturedValue?.isInitialized).toBe(true);
  });

  it('exposes connect function', () => {
    function Consumer() {
      const ctx = React.use(WalletContext);
      return React.createElement('button', {
        'data-testid': 'connect-btn',
        onClick: () => ctx?.connect(),
      }, 'Connect');
    }

    render(
      React.createElement(WalletContext.Provider, { value: mockContextValue },
        React.createElement(Consumer)
      )
    );

    screen.getByTestId('connect-btn').click();
    expect(mockContextValue.connect).toHaveBeenCalledOnce();
  });

  it('exposes disconnect function', () => {
    function Consumer() {
      const ctx = React.use(WalletContext);
      return React.createElement('button', {
        'data-testid': 'disconnect-btn',
        onClick: () => ctx?.disconnect(),
      }, 'Disconnect');
    }

    render(
      React.createElement(WalletContext.Provider, { value: mockContextValue },
        React.createElement(Consumer)
      )
    );

    screen.getByTestId('disconnect-btn').click();
    expect(mockContextValue.disconnect).toHaveBeenCalledOnce();
  });

  it('exposes address null when wallet is disconnected', () => {
    const disconnectedValue = { ...mockContextValue, address: null, walletName: null };

    function Consumer() {
      const ctx = React.use(WalletContext);
      return React.createElement('div', { 'data-testid': 'wallet-status' },
        `Address: ${ctx?.address ?? 'none'}, Wallet: ${ctx?.walletName ?? 'none'}`
      );
    }

    render(
      React.createElement(WalletContext.Provider, { value: disconnectedValue },
        React.createElement(Consumer)
      )
    );

    expect(screen.getByTestId('wallet-status')).toHaveTextContent('Address: none');
    expect(screen.getByTestId('wallet-status')).toHaveTextContent('Wallet: none');
  });

  it('exposes isConnecting state during wallet connection', () => {
    const connectingValue = { ...mockContextValue, isConnecting: true };

    function Consumer() {
      const ctx = React.use(WalletContext);
      return React.createElement('div', { 'data-testid': 'connecting-status' },
        ctx?.isConnecting ? 'Connecting...' : 'Not connecting'
      );
    }

    render(
      React.createElement(WalletContext.Provider, { value: connectingValue },
        React.createElement(Consumer)
      )
    );

    expect(screen.getByTestId('connecting-status')).toHaveTextContent('Connecting...');
  });

  it('exposes signTransaction function', async () => {
    function Consumer() {
      const ctx = React.use(WalletContext);
      const [result, setResult] = React.useState<string>('');
      return React.createElement('div', null,
        React.createElement('button', {
          'data-testid': 'sign-btn',
          onClick: () => {
            void (async () => {
              const signed = await ctx?.signTransaction('test-xdr');
              setResult(signed ?? '');
            })();
          },
        }, 'Sign'),
        React.createElement('div', { 'data-testid': 'signed-result' }, result)
      );
    }

    render(
      React.createElement(WalletContext.Provider, { value: mockContextValue },
        React.createElement(Consumer)
      )
    );

    await act(async () => {
      screen.getByTestId('sign-btn').click();
    });
    await vi.waitFor(() => {
      expect(screen.getByTestId('signed-result')).toHaveTextContent('signed-xdr');
    });
  });
});