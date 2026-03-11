import React, { useEffect, useState, useRef } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  xBullModule,
  LobstrModule,
} from '@creit.tech/stellar-wallets-kit';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../hooks/useNotification';
import { WalletContext } from '../hooks/useWallet';

const LAST_WALLET_STORAGE_KEY = 'payd:last_wallet_name';

function hasAnyWalletExtension(): boolean {
  if (typeof window === 'undefined') return true;
  const extendedWindow = window as Window &
    typeof globalThis & {
      freighterApi?: unknown;
      xBullSDK?: unknown;
      lobstr?: unknown;
    };

  return Boolean(extendedWindow.freighterApi || extendedWindow.xBullSDK || extendedWindow.lobstr);
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletExtensionAvailable, setWalletExtensionAvailable] = useState(true);

  const kitRef = useRef<StellarWalletsKit | null>(null);
  const { t } = useTranslation();
  const { notify, notifySuccess, notifyError } = useNotification();

  const network = (import.meta.env.VITE_STELLAR_NETWORK || 'TESTNET') as WalletNetwork;

  useEffect(() => {
    setWalletExtensionAvailable(hasAnyWalletExtension());

    const sanitizeNetwork = (net: string): WalletNetwork => {
      const validNetworks: WalletNetwork[] = [
        WalletNetwork.PUBLIC,
        WalletNetwork.TESTNET,
        WalletNetwork.FUTURENET,
        WalletNetwork.SANDBOX,
      ];
      return validNetworks.includes(net as WalletNetwork)
        ? (net as WalletNetwork)
        : WalletNetwork.TESTNET;
    };

    let newKit: StellarWalletsKit | null = null;

    try {
      const activeNetwork = sanitizeNetwork(network);
      newKit = new StellarWalletsKit({
        network: activeNetwork,
        modules: [new FreighterModule(), new xBullModule(), new LobstrModule()],
      });
      kitRef.current = newKit;
    } catch (err) {
      console.error('Failed to initialize StellarWalletsKit:', err);
      notifyError('Wallet Error', 'Failed to initialize wallet connection system.');
    }

    if (!newKit) {
      setIsInitialized(true);
      return;
    }

    const currentKit = newKit;

    const attemptSilentReconnect = async () => {
      const lastWalletName = localStorage.getItem(LAST_WALLET_STORAGE_KEY);
      if (!lastWalletName) {
        setIsInitialized(true);
        return;
      }

      setWalletName(lastWalletName);
      setIsConnecting(true);

      try {
        currentKit.setWallet(lastWalletName);
        const account = await currentKit.getAddress();
        if (account?.address) {
          setAddress(account.address);
          notifySuccess(
            'Wallet reconnected',
            `${account.address.slice(0, 6)}...${account.address.slice(-4)} via ${lastWalletName}`
          );
        }
      } catch (error) {
        console.warn('Silent reconnection failed:', error);
        localStorage.removeItem(LAST_WALLET_STORAGE_KEY);
      } finally {
        setIsConnecting(false);
        setIsInitialized(true);
      }
    };

    void attemptSilentReconnect();
  }, [notifySuccess, notifyError, network]);

  const connect = async () => {
    const kit = kitRef.current;
    if (!kit) return;

    setIsConnecting(true);
    try {
      await kit.openModal({
        modalTitle: t('wallet.modalTitle'),
        onWalletSelected: (option) => {
          void (async () => {
            try {
              const { address: newAddress } = await kit.getAddress();
              setAddress(newAddress);
              setWalletName(option.id);
              localStorage.setItem(LAST_WALLET_STORAGE_KEY, option.id);
              notifySuccess(
                'Wallet connected',
                `${newAddress.slice(0, 6)}...${newAddress.slice(-4)} via ${option.id}`
              );
            } catch (err) {
              console.error('onWalletSelected error:', err);
            }
          })();
        },
        onClosed: () => {
          setIsConnecting(false);
        },
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      notifyError(
        'Wallet connection failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setWalletName(null);
    localStorage.removeItem(LAST_WALLET_STORAGE_KEY);
    notify('Wallet disconnected');
  };

  const requireWallet = async <T,>(callback: () => Promise<T>): Promise<T> => {
    if (address) {
      return callback();
    }

    await connect();

    // Check again after modal interaction
    if (!address) {
      throw new Error('Wallet connection required to perform this action');
    }

    return callback();
  };

  const signTransaction = async (xdr: string) => {
    const kit = kitRef.current;
    if (!kit) throw new Error('Wallet kit not initialized');
    const result = await kit.signTransaction(xdr);
    return result.signedTxXdr;
  };

  return (
    <>
      {!walletExtensionAvailable && (
        <div className="sticky top-0 z-50 w-full border-b border-amber-600/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Wallet extension not detected. Install Freighter, xBull, or Lobstr to sign transactions.
        </div>
      )}

      <WalletContext
        value={{
          address,
          walletName,
          isConnecting,
          isInitialized,
          walletExtensionAvailable,
          connect,
          requireWallet,
          disconnect,
          signTransaction,
        }}
      >
        {isInitialized ? (
          children
        ) : (
          <div className="w-full px-4 py-3 text-xs text-zinc-400">Restoring wallet session...</div>
        )}
      </WalletContext>
    </>
  );
};
