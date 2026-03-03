import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Clock, LogOut } from 'lucide-react';

interface SessionTimeoutWarningProps {
  isVisible: boolean;
  timeRemaining: number;
  onExtendSession: () => void;
  onLogout: () => void;
}

const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  isVisible,
  timeRemaining,
  onExtendSession,
  onLogout,
}) => {
  const [timeLeft, setTimeLeft] = useState(timeRemaining);

  useEffect(() => {
    setTimeLeft(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (): string => {
    const totalSeconds = Math.ceil(timeLeft / 1000);
    if (totalSeconds <= 30) return 'text-red-500';
    if (totalSeconds <= 60) return 'text-orange-500';
    return 'text-yellow-500';
  };

  const getProgressPercentage = (): number => {
    const totalTime = 2 * 60 * 1000; // 2 minutes in milliseconds
    return Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="glass noise border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl"
        >
          {/* Warning Icon */}
          <div className="flex items-center justify-center mb-6">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center"
            >
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </motion.div>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-3">
              Session Expiring Soon
            </h2>
            <p className="text-white/70 mb-6">
              Your session will expire in due to inactivity. Please choose to stay logged in or you will be automatically logged out.
            </p>

            {/* Countdown Display */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <Clock className={`w-5 h-5 ${getTimeColor()}`} />
              <span className={`text-3xl font-mono font-bold ${getTimeColor()}`}>
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-2 mb-6">
              <motion.div
                className={`h-2 rounded-full transition-colors duration-300 ${
                  timeLeft <= 30000 ? 'bg-red-500' : timeLeft <= 60000 ? 'bg-orange-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${getProgressPercentage()}%` }}
                initial={{ width: '100%' }}
                animate={{ width: `${getProgressPercentage()}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onExtendSession}
              className="w-full py-3 px-6 bg-accent text-bg font-bold rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Stay Logged In
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onLogout}
              className="w-full py-3 px-6 glass border border-white/20 text-white/70 font-bold rounded-xl hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Log Out Now
            </motion.button>
          </div>

          {/* Warning Message */}
          <div className="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-500/80 text-center">
              ⚠️ For your security, you'll be automatically logged out when the timer reaches zero.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SessionTimeoutWarning;
