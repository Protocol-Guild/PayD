import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AUTH_TOKEN_KEY, AUTH_REDIRECT_KEY } from '../components/ProtectedRoute';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);

      // Restore the redirect path saved by Login page, default to '/'
      const redirect = localStorage.getItem(AUTH_REDIRECT_KEY) || '/';
      localStorage.removeItem(AUTH_REDIRECT_KEY);

      // Use replace to avoid the callback page lingering in browser history
      void navigate(redirect, { replace: true });
    } else {
      void navigate('/login?error=no_token', { replace: true });
    }
  }, [searchParams, navigate]);

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
