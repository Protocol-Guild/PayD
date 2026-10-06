import axios from 'axios';
import { API_V1_BASE_URL } from '../config/api';

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
    `${API_V1_BASE_URL}/claims/pending`,
    {
      params: { walletAddress },
    }
  );

  return data.data;
};
