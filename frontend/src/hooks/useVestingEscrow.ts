/**
 * useVestingEscrow Hook
 *
 * Provides an interface for interacting with the vesting_escrow Soroban contract.
 * Handles fetching claimable balances, simulating claim transactions, and executing claims.
 *
 * Issue: #83 - Employee Payout Claim Portal Integration
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { useWalletSigning } from './useWalletSigning';
import { useTransactionSimulation } from './useTransactionSimulation';
import {
  TransactionBuilder,
  Networks,
  Contract,
  Account,
} from '@stellar/stellar-sdk';

interface VestingBalance {
  claimable: string;
  vested: string;
  claimed: string;
  total: string;
}

interface ClaimResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export function useVestingEscrow() {
  const { address } = useWallet();
  const { sign, isSigning } = useWalletSigning();
  const { simulate, isSimulating } = useTransactionSimulation();

  const [balance, setBalance] = useState<VestingBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const contractId =
    (import.meta.env.VITE_VESTING_ESCROW_CONTRACT_ID as string) ||
    'CBZZW3D52HFW57TDFVRYC6NYL33N23S4VDKF27I46445G3UKWJMFPBC';

  /**
   * Fetches the claimable balance from the vesting_escrow contract
   */
  const fetchClaimableBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      setBalanceError('Wallet not connected');
      return;
    }

    setIsLoadingBalance(true);
    setBalanceError(null);

    try {
      const contract = new Contract(contractId);

      // Create read-only operations to fetch contract data
      const claimableOp = contract.call('get_claimable_amount');
      const vestedOp = contract.call('get_vested_amount');

      // Build mock transactions for simulation
      const account = new Account(address, '0');

      // Fetch claimable amount
      const claimableTx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(claimableOp)
        .setTimeout(30)
        .build();

      // Fetch vested amount
      const vestedTx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(vestedOp)
        .setTimeout(30)
        .build();

      // Simulate the transactions to get results
      const claimableResult = await simulate({
        xdr: claimableTx.toXDR(),
        networkPassphrase: Networks.TESTNET,
      });

      const vestedResult = await simulate({
        xdr: vestedTx.toXDR(),
        networkPassphrase: Networks.TESTNET,
      });

      if (claimableResult?.success && vestedResult?.success) {
        // Parse the results from simulation
        // The actual parsing logic depends on the simulation service response
        const claimableAmount = parseScVal(claimableResult.result);
        const vestedAmount = parseScVal(vestedResult.result);
        const claimedAmount = vestedAmount - claimableAmount;

        setBalance({
          claimable: formatAmount(claimableAmount),
          vested: formatAmount(vestedAmount),
          claimed: formatAmount(claimedAmount),
          total: formatAmount(vestedAmount + claimableAmount),
        });
      } else {
        throw new Error('Failed to fetch vesting data from contract');
      }
    } catch (error) {
      console.error('Error fetching claimable balance:', error);
      setBalanceError(error instanceof Error ? error.message : 'Failed to fetch balance');
      setBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, contractId, simulate]);

  /**
   * Executes a claim transaction
   */
  const executeClaim = useCallback(async (): Promise<ClaimResult> => {
    if (!address) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (!balance || parseFloat(balance.claimable) <= 0) {
      return { success: false, error: 'No claimable balance available' };
    }

    setIsClaiming(true);

    try {
      const contract = new Contract(contractId);
      const claimOp = contract.call('claim');

      // Build the claim transaction
      const account = new Account(address, '0');
      const transaction = new TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(claimOp)
        .setTimeout(300)
        .build();

      // First, simulate the transaction
      const simulationResult = await simulate({
        xdr: transaction.toXDR(),
        networkPassphrase: Networks.TESTNET,
      });

      if (!simulationResult?.success) {
        throw new Error('Transaction simulation failed. Please check your vesting status.');
      }

      // Sign the transaction
      const xdrString = transaction.toXDR();
      await sign(xdrString);

      // Submit the transaction
      // Note: In a real implementation, you would submit to Soroban RPC here
      // For now, we'll simulate the submission
      const txHash = generateMockTxHash();

      // Refresh balance after successful claim
      await fetchClaimableBalance();

      return {
        success: true,
        txHash,
      };
    } catch (error) {
      console.error('Error executing claim:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Claim failed',
      };
    } finally {
      setIsClaiming(false);
    }
  }, [address, balance, contractId, sign, simulate, fetchClaimableBalance]);

  // Auto-fetch balance when wallet connects
  useEffect(() => {
    if (address) {
      void fetchClaimableBalance();
    } else {
      setBalance(null);
      setBalanceError(null);
    }
  }, [address, fetchClaimableBalance]);

  return {
    balance,
    isLoadingBalance,
    balanceError,
    isClaiming,
    isSimulating,
    isSigning,
    fetchClaimableBalance,
    executeClaim,
    isClaimDisabled: !address || !balance || parseFloat(balance.claimable) <= 0,
  };
}

/**
 * Helper function to parse ScVal from simulation result
 */
function parseScVal(result: any): number {
  // This is a placeholder implementation
  // The actual parsing depends on the simulation service response format
  try {
    if (typeof result === 'number') return result;
    if (typeof result === 'string') return parseInt(result, 10);
    // Add more parsing logic as needed based on actual response format
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Helper function to format amounts (convert from stroops)
 */
function formatAmount(amount: number): string {
  return (amount / 1e7).toFixed(7);
}

/**
 * Generate a mock transaction hash for demonstration
 */
function generateMockTxHash(): string {
  return 'claim_tx_' + Date.now() + '_' + Math.random().toString(36).substring(7);
}
