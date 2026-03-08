import axios from 'axios';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3001';

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: string;
  wallet_address?: string;
  created_at: string;
}

const authApi = {
  getProfile: async (token: string): Promise<UserProfile> => {
    const response = await axios.get(`${BACKEND_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('payd_auth_token');
  },
};

export default authApi;
