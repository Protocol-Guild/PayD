import { useState, useEffect } from 'react';
import authApi, { UserProfile } from '../services/authApi';

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('payd_auth_token');

  const fetchProfile = async (authToken: string) => {
    try {
      setLoading(true);
      const profile = await authApi.getProfile(authToken);
      setUser(profile);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch user profile:', err);
      setError('Session expired or invalid');
      // If unauthorized, clear token
      if (err.response?.status === 401 || err.response?.status === 403) {
        authApi.logout();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchProfile(token);
    } else {
      setLoading(false);
      setUser(null);
    }
  }, [token]);

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    logout,
    refreshProfile: () => token && void fetchProfile(token),
  };
};
