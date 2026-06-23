import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { decodeJwt } from '../utils/jwt';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // update context and storage
      login(token);

      // simple role-based redirect using decoded payload
      const payload = token ? decodeJwt<{ role?: string }>(token) : null;
      if (payload?.role === 'EMPLOYEE') {
        void navigate('/portal');
      } else {
        void navigate('/');
      }
    } else {
      void navigate('/login?error=no_token');
    }
  }, [searchParams, navigate, login]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl font-bold tracking-tight">Authenticating...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
