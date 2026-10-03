import api from '../utils/api';

export interface SEP31Transaction {
  id: string;
  status: string;
  amount_in: string;
  amount_out: string;
  asset_in: string;
  asset_out: string;
}

export const anchorService = {
  getAnchorInfo: async (domain: string) => {
    const response = await api.get<{ info: Record<string, unknown> }>(
      '/payments/anchor-info',
      {
        params: { domain },
      }
    );
    return response.data;
  },

  initiatePayment: async (
    domain: string,
    secretKey: string,
    paymentData: { amount: string; asset_code: string; receiver_id: string }
  ) => {
    const response = await api.post<{ id: string }>('/payments/sep31/initiate', {
      domain,
      secretKey,
      paymentData,
    });
    return response.data;
  },

  getTransactionStatus: async (domain: string, id: string, secretKey: string) => {
    const response = await api.get<SEP31Transaction>(
      `/payments/sep31/status/${domain}/${id}`,
      {
        params: { secretKey },
      }
    );
    return response.data;
  },
};