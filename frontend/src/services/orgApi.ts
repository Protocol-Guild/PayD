import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface OrgProfile {
  id: number;
  name: string;
  publicKey: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  subscriptionTier: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdateOrgProfileInput {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
}

function authHeaders() {
  const token = localStorage.getItem('payd_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export const getOrgProfile = async (): Promise<OrgProfile> => {
  const { data } = await axios.get<{ organization: OrgProfile }>(
    `${API_BASE_URL}/organizations/profile`,
    {
      headers: authHeaders(),
    }
  );

  return data.organization;
};

export const updateOrgProfile = async (input: UpdateOrgProfileInput): Promise<OrgProfile> => {
  const { data } = await axios.put<{ organization: OrgProfile }>(
    `${API_BASE_URL}/organizations/profile`,
    input,
    {
      headers: authHeaders(),
    }
  );

  return data.organization;
};
