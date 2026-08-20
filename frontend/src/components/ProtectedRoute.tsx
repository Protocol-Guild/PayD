import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export const AUTH_TOKEN_KEY = 'payd_auth_token';
export const AUTH_REDIRECT_KEY = 'payd_auth_redirect';

/**
 * Route guard that protects all employer-facing routes.
 *
 * If the user is not authenticated (no auth token in localStorage), they are
 * redirected to /login with the originally requested path so they can be sent
 * back after a successful login.
 */
const ProtectedRoute: React.FC = () => {
  const location = useLocation();
  const isAuthenticated = Boolean(localStorage.getItem(AUTH_TOKEN_KEY));

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;