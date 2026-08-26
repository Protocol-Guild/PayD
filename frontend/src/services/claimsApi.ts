import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface PendingClaimRecord {
  id: string;
  employee_id: number | null;
  amount: string;
  asset_code: string;
  asset_issuer: string;
  stellar_balance_id: string | null;
  create_tx_hash: string | null;
  created_at: string;
  status: string;
}

export const fetchPendingClaims = async (walletAddress: string): Promise<PendingClaimRecord[]> => {
  const { data } = await axios.get<{ success: boolean; data: PendingClaimRecord[] }>(
    `${API_BASE_URL}/claims/pending`,
    {
      params: { walletAddress },
    }
  );

  return data.data;
};
