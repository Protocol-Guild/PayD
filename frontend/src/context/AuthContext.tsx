import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import axios from 'axios';
import { decodeJwt, JwtPayload } from '../utils/jwt';

export interface AuthUser extends JwtPayload {
  role: string;
}

export interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const syncAxios = (jwt: string | null) => {
    if (jwt) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const login = (jwt: string) => {
    const parsed = decodeJwt<AuthUser>(jwt);
    if (parsed && parsed.role) {
      setToken(jwt);
      setUser(parsed);
      localStorage.setItem('payd_auth_token', jwt);
      syncAxios(jwt);
    } else {
      console.warn('login called with invalid token, ignoring');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('payd_auth_token');
    syncAxios(null);
  };

  useEffect(() => {
    // initialise from storage
    const saved = localStorage.getItem('payd_auth_token');
    if (saved) {
      const parsed = decodeJwt<AuthUser>(saved);
      if (parsed && parsed.role) {
        setToken(saved);
        setUser(parsed);
        syncAxios(saved);
      } else {
        localStorage.removeItem('payd_auth_token');
      }
    }
  }, []);

  const value: AuthContextType = {
    token,
    user,
    isAuthenticated: !!token && !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
