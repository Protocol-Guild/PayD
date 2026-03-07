import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const TOKEN_KEY = 'payd_auth_token';
const REFRESH_TOKEN_KEY = 'payd_refresh_token';
const WARNING_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes before expiration
const ACTIVITY_THROTTLE_MS = 1000; // Throttle activity updates to 1 second

interface DecodedToken {
  exp?: number;
  iat?: number;
  id?: number;
  email?: string;
  walletAddress?: string;
  role?: string;
}

interface UseSessionTimerReturn {
  showWarning: boolean;
  secondsRemaining: number;
  stayLoggedIn: () => Promise<void>;
  logout: () => void;
}

function decodeToken(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as DecodedToken;
  } catch {
    return null;
  }
}

export function useSessionTimer(): UseSessionTimerReturn {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const tokenRef = useRef<string | null>(null);
  const expirationTimeRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setShowWarning(false);
    void navigate('/login');
  }, [navigate]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);

    // If no refresh token available, try to use the current token to extend session
    // or redirect to login
    if (!refreshTokenValue) {
      // For OAuth tokens without refresh tokens, we'll just check if current token is still valid
      // If not, force re-login
      const currentToken = localStorage.getItem(TOKEN_KEY);
      if (currentToken) {
        const decoded = decodeToken(currentToken);
        if (decoded?.exp && decoded.exp * 1000 > Date.now()) {
          // Token still valid, just hide warning
          return true;
        }
      }
      return false;
    }

    try {
      const backendUrl =
        (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = (await response.json()) as { accessToken?: string };
      if (data.accessToken) {
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        tokenRef.current = data.accessToken;
        const decoded = decodeToken(data.accessToken);
        if (decoded?.exp) {
          expirationTimeRef.current = decoded.exp * 1000;
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }, []);

  const stayLoggedIn = useCallback(async () => {
    const success = await refreshToken();
    if (success) {
      setShowWarning(false);
      lastActivityRef.current = Date.now();
    } else {
      // If refresh fails, logout
      logout();
    }
  }, [refreshToken, logout]);

  // Check token expiration and update state
  const checkExpiration = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setShowWarning(false);
      return;
    }

    // Only update token ref if token changed
    if (token !== tokenRef.current) {
      tokenRef.current = token;
      const decoded = decodeToken(token);
      if (decoded?.exp) {
        expirationTimeRef.current = decoded.exp * 1000;
      }
    }

    const expirationTime = expirationTimeRef.current;
    if (!expirationTime) {
      setShowWarning(false);
      return;
    }

    const now = Date.now();
    const timeUntilExpiration = expirationTime - now;

    if (timeUntilExpiration <= 0) {
      // Token expired
      setShowWarning(false);
      logout();
      return;
    }

    // Show warning when 2 minutes or less remain
    if (timeUntilExpiration <= WARNING_THRESHOLD_MS) {
      setShowWarning(true);
      setSecondsRemaining(Math.ceil(timeUntilExpiration / 1000));
    } else {
      setShowWarning(false);
    }
  }, [logout]);

  // Track user activity to extend session implicitly
  const updateActivity = useCallback(() => {
    const now = Date.now();
    // Throttle activity updates
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) {
      return;
    }
    lastActivityRef.current = now;

    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    // Only run if user is authenticated
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return;
    }

    // Set up expiration check interval
    const intervalId = setInterval(checkExpiration, 1000);

    // Set up activity listeners
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    const handleActivity = () => {
      updateActivity();
    };

    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial check
    checkExpiration();

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [checkExpiration, updateActivity]);

  return {
    showWarning,
    secondsRemaining,
    stayLoggedIn,
    logout,
  };
}
