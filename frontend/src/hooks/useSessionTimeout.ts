import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface SessionTimeoutOptions {
  warningTime?: number; // Time before expiration to show warning (in milliseconds)
  sessionDuration?: number; // Total session duration (in milliseconds)
  onWarning?: (timeRemaining: number) => void;
  onExpire?: () => void;
}

export const useSessionTimeout = ({
  warningTime = 2 * 60 * 1000, // 2 minutes
  sessionDuration = 60 * 60 * 1000, // 1 hour (matches backend JWT)
  onWarning,
  onExpire,
}: SessionTimeoutOptions = {}) => {
  const navigate = useNavigate();
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  
  const timersRef = useRef<{
    warningTimer?: NodeJS.Timeout;
    expirationTimer?: NodeJS.Timeout;
    countdownTimer?: NodeJS.Timeout;
    activityResetTimer?: NodeJS.Timeout;
  }>({});
  
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartTimeRef = useRef<number>(Date.now());

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    Object.values(timersRef.current).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    timersRef.current = {};
  }, []);

  // Update last activity time
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check if session is expired based on inactivity
  const checkSessionExpiration = useCallback(() => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;
    const sessionAge = now - sessionStartTimeRef.current;
    
    // Session expires if either:
    // 1. Inactivity period exceeds session duration
    // 2. Total session age exceeds session duration
    return timeSinceActivity >= sessionDuration || sessionAge >= sessionDuration;
  }, [sessionDuration]);

  // Handle session expiration
  const handleExpiration = useCallback(() => {
    if (isExpired) return;
    
    setIsExpired(true);
    setIsWarningVisible(false);
    clearAllTimers();
    
    // Clear auth token
    localStorage.removeItem('payd_auth_token');
    
    // Call custom expire handler
    if (onExpire) {
      onExpire();
    } else {
      // Default behavior: redirect to login
      navigate('/login?reason=session_expired');
    }
  }, [isExpired, clearAllTimers, onExpire, navigate]);

  // Show warning modal
  const showWarning = useCallback(() => {
    if (isWarningVisible || isExpired) return;
    
    setIsWarningVisible(true);
    
    // Start countdown timer
    const countdownInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      const sessionAge = now - sessionStartTimeRef.current;
      const timeUntilExpiration = Math.min(
        sessionDuration - timeSinceActivity,
        sessionDuration - sessionAge
      );
      
      if (timeUntilExpiration <= 0) {
        clearInterval(countdownInterval);
        handleExpiration();
      } else {
        setTimeRemaining(timeUntilExpiration);
        if (onWarning) {
          onWarning(timeUntilExpiration);
        }
      }
    }, 1000);
    
    timersRef.current.countdownTimer = countdownInterval;
  }, [isWarningVisible, isExpired, sessionDuration, onWarning, handleExpiration]);

  // Extend session / Stay logged in
  const extendSession = useCallback(async () => {
    try {
      // Get current token
      const token = localStorage.getItem('payd_auth_token');
      if (!token) {
        handleExpiration();
        return;
      }

      // Get backend URL from environment
      const backendUrl = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:4000';

      // Call refresh endpoint
      const response = await fetch(`${backendUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: token }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accessToken) {
          localStorage.setItem('payd_auth_token', data.accessToken);
        }
      } else {
        // Refresh failed, expire session
        handleExpiration();
        return;
      }

      // Reset session timers
      lastActivityRef.current = Date.now();
      sessionStartTimeRef.current = Date.now();
      setIsWarningVisible(false);
      setIsExpired(false);
      clearAllTimers();
      
      // Restart timers
      startSessionTimers();
    } catch (error) {
      console.error('Failed to refresh session:', error);
      handleExpiration();
    }
  }, [handleExpiration, clearAllTimers]);

  // Start session timers
  const startSessionTimers = useCallback(() => {
    clearAllTimers();
    
    // Set warning timer
    const warningTimeout = setTimeout(() => {
      if (!checkSessionExpiration()) {
        showWarning();
      }
    }, sessionDuration - warningTime);
    
    // Set expiration timer
    const expirationTimeout = setTimeout(() => {
      handleExpiration();
    }, sessionDuration);
    
    timersRef.current.warningTimer = warningTimeout;
    timersRef.current.expirationTimer = expirationTimeout;
  }, [clearAllTimers, sessionDuration, warningTime, checkSessionExpiration, showWarning, handleExpiration]);

  // Setup activity listeners
  useEffect(() => {
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
    ];

    const handleActivity = () => {
      updateActivity();
      
      // Debounce timer reset
      if (timersRef.current.activityResetTimer) {
        clearTimeout(timersRef.current.activityResetTimer);
      }
      
      timersRef.current.activityResetTimer = setTimeout(() => {
        // Check if we need to reset timers due to activity
        if (!isWarningVisible && !isExpired) {
          startSessionTimers();
        }
      }, 1000);
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [updateActivity, isWarningVisible, isExpired, startSessionTimers]);

  // Initialize session timers
  useEffect(() => {
    const token = localStorage.getItem('payd_auth_token');
    if (token) {
      startSessionTimers();
    }

    return () => {
      clearAllTimers();
    };
  }, [startSessionTimers, clearAllTimers]);

  // Periodic session check
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (checkSessionExpiration()) {
        handleExpiration();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);
  }, [checkSessionExpiration, handleExpiration]);

  return {
    isWarningVisible,
    timeRemaining,
    isExpired,
    extendSession,
    updateActivity,
  };
};
