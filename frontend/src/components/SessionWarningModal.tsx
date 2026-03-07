import React from 'react';

interface SessionWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}) => {
  if (!isOpen) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md glass noise rounded-2xl border border-white/10 shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
        {/* Warning Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-warning"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-center mb-2 tracking-tight">
          Session Expiring Soon
        </h2>

        {/* Description */}
        <p className="text-muted text-center mb-6 text-sm leading-relaxed">
          Your session will expire in{' '}
          <span className="text-warning font-bold">{formatTime(secondsRemaining)}</span>.
          <br />
          Would you like to stay logged in?
        </p>

        {/* Countdown Display */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 text-3xl font-mono font-black text-warning">
            <span>{formatTime(secondsRemaining)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onLogout}
            className="flex-1 px-6 py-3 rounded-xl border border-white/10 text-sm font-bold uppercase tracking-wider hover:bg-white/5 transition-all"
          >
            Logout
          </button>
          <button
            onClick={onStayLoggedIn}
            className="flex-1 px-6 py-3 rounded-xl bg-accent text-bg font-bold text-sm uppercase tracking-wider hover:scale-[1.02] transition-all shadow-lg shadow-accent/20"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
};
