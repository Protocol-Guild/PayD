/**
 * Vesting Claim History API Service
 *
 * Provides functions to fetch vesting claim history from the backend event indexer.
 * Issue: #83 - Employee Payout Claim Portal Integration
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface ClaimHistoryRecord {
  id: string;
  contract_id: string;
  event_type: string;
  beneficiary: string;
  amount: string;
  claimed_amount: string;
  transaction_hash: string;
  ledger: number;
  timestamp: string;
  created_at: string;
}

export interface ClaimHistoryResponse {
  success: boolean;
  data: ClaimHistoryRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Fetches vesting claim history for a specific wallet address
 * @param walletAddress - The Stellar wallet address (beneficiary)
 * @param contractId - Optional vesting_escrow contract ID to filter by
 * @param page - Page number for pagination (default: 1)
 * @param limit - Number of records per page (default: 10)
 */
export const fetchClaimHistory = async (
  walletAddress: string,
  contractId?: string,
  page: number = 1,
  limit: number = 10
): Promise<ClaimHistoryRecord[]> => {
  try {
    const params: Record<string, any> = {
      eventType: 'claim',
      page,
      limit,
    };

    // If contractId is provided, fetch from specific contract endpoint
    const url = contractId
      ? `${API_BASE_URL}/events/${contractId}`
      : `${API_BASE_URL}/events`;

    const { data } = await axios.get<ClaimHistoryResponse>(url, { params });

    if (!data.success) {
      throw new Error('Failed to fetch claim history');
    }

    // Filter by beneficiary (wallet address) if fetching from all events
    const filteredData = data.data.filter(
      (record: ClaimHistoryRecord) =>
        record.beneficiary === walletAddress ||
        record.event_type === 'claim' ||
        record.event_type.toLowerCase().includes('claim')
    );

    return filteredData;
  } catch (error) {
    console.error('Error fetching claim history:', error);
    throw error;
  }
};

/**
 * Fetches the latest claim for a specific wallet
 * @param walletAddress - The Stellar wallet address
 */
export const fetchLatestClaim = async (
  walletAddress: string,
  contractId?: string
): Promise<ClaimHistoryRecord | null> => {
  try {
    const history = await fetchClaimHistory(walletAddress, contractId, 1, 1);
    return history.length > 0 ? history[0] : null;
  } catch (error) {
    console.error('Error fetching latest claim:', error);
    return null;
  }
};

/**
 * Polls for a specific transaction to appear in the claim history
 * Useful for confirming on-chain settlement after submission
 * @param txHash - Transaction hash to poll for
 * @param maxAttempts - Maximum number of polling attempts (default: 10)
 * @param intervalMs - Polling interval in milliseconds (default: 3000)
 */
export const pollForClaimConfirmation = async (
  txHash: string,
  maxAttempts: number = 10,
  intervalMs: number = 3000
): Promise<ClaimHistoryRecord | null> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { data } = await axios.get<ClaimHistoryResponse>(`${API_BASE_URL}/events`, {
        params: {
          eventType: 'claim',
          page: 1,
          limit: 50,
        },
      });

      const claim = data.data.find((record: ClaimHistoryRecord) => record.transaction_hash === txHash);

      if (claim) {
        return claim;
      }

      // Wait before next attempt
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      console.error(`Polling attempt ${attempt + 1} failed:`, error);
    }
  }

  return null;
};
