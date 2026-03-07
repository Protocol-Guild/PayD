import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCw,
} from 'lucide-react';
import type { MigrationStatus } from '../services/contractUpgrade';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MigrationProgressProps {
  migration: MigrationStatus | null;
  onRefresh?: () => void;
  onClose?: () => void;
  className?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function MigrationProgress({
  migration,
  onRefresh,
  onClose,
  className = '',
}: MigrationProgressProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<string>('');

  // Calculate elapsed time
  useEffect(() => {
    if (!migration?.startedAt) {
      setElapsedTime('');
      return;
    }

    const calculateElapsed = () => {
      const start = new Date(migration.startedAt!).getTime();
      const end = migration.completedAt
        ? new Date(migration.completedAt).getTime()
        : Date.now();
      const diff = Math.floor((end - start) / 1000);

      if (diff < 60) return `${diff}s`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
      return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    };

    setElapsedTime(calculateElapsed());

    // Update elapsed time every second if running
    if (migration.status === 'running' || migration.status === 'pending') {
      const interval = setInterval(() => {
        setElapsedTime(calculateElapsed());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [migration]);

  // Status configuration
  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      label: 'Pending',
      animate: false,
    },
    running: {
      icon: Loader2,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      borderColor: 'border-accent/30',
      label: 'In Progress',
      animate: true,
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      label: 'Completed',
      animate: false,
    },
    failed: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      label: 'Failed',
      animate: false,
    },
  };

  const currentStatus = migration ? statusConfig[migration.status] : null;

  // Calculate progress percentage
  const progressPercentage = migration
    ? migration.status === 'completed'
      ? 100
      : Math.round(migration.progress)
    : 0;

  // Format timestamp
  const formatTime = useCallback((timestamp?: string): string => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString();
  }, []);

  if (!migration) {
    return (
      <div className={`bg-surface border border-hi rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center text-muted">
          <Clock className="w-5 h-5 mr-2" />
          <span className="text-sm">No migration in progress</span>
        </div>
      </div>
    );
  }

  const StatusIcon = currentStatus?.icon || Clock;

  return (
    <div className={`bg-surface border border-hi rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div
        className={`p-4 border-b border-hi ${currentStatus?.bgColor} ${currentStatus?.borderColor}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${currentStatus?.bgColor} ${currentStatus?.borderColor} border`}
            >
              <StatusIcon
                className={`w-5 h-5 ${currentStatus?.color} ${
                  currentStatus?.animate ? 'animate-spin' : ''
                }`}
              />
            </div>
            <div>
              <h4 className="font-bold">Migration {currentStatus?.label}</h4>
              <p className="text-xs text-muted">
                ID: {migration.id.slice(-12)}
                {elapsedTime && ` • Elapsed: ${elapsedTime}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                title="Refresh status"
              >
                <RotateCw className="w-4 h-4 text-muted" />
              </button>
            )}
            {onClose && migration.status !== 'running' && migration.status !== 'pending' && (
              <button
                onClick={onClose}
                className="px-3 py-1 text-xs font-medium text-muted hover:text-text transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4 space-y-4">
        {/* Progress indicator */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted">Progress</span>
            <span className="font-medium">
              {migration.completedSteps} / {migration.totalSteps} steps
            </span>
          </div>

          <div className="h-3 bg-black/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                migration.status === 'failed'
                  ? 'bg-red-500'
                  : migration.status === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-accent'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-muted mt-1">
            <span>{progressPercentage}%</span>
            <span>
              {migration.status === 'completed'
                ? 'Done'
                : migration.status === 'failed'
                  ? 'Failed'
                  : migration.currentStep || 'Waiting...'}
            </span>
          </div>
        </div>

        {/* Current Step */}
        {(migration.status === 'running' || migration.status === 'pending') &&
          migration.currentStep && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
                <span className="text-accent">{migration.currentStep}</span>
              </div>
            </div>
          )}

        {/* Error display */}
        {migration.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Migration Failed</p>
                <p className="text-sm text-red-400/80">{migration.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {migration.status === 'completed' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-emerald-500">Migration completed successfully</span>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-black/10 rounded-lg p-2">
            <span className="text-muted block mb-1">Started</span>
            <span className="font-mono">{formatTime(migration.startedAt)}</span>
          </div>
          {migration.completedAt && (
            <div className="bg-black/10 rounded-lg p-2">
              <span className="text-muted block mb-1">Completed</span>
              <span className="font-mono">{formatTime(migration.completedAt)}</span>
            </div>
          )}
        </div>

        {/* Logs */}
        {migration.logs.length > 0 && (
          <div className="border border-hi rounded-lg overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between p-3 bg-black/10 hover:bg-black/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted" />
                <span className="text-sm font-medium">Migration Logs</span>
                <span className="text-xs text-muted">({migration.logs.length})</span>
              </div>
              {showLogs ? (
                <ChevronUp className="w-4 h-4 text-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted" />
              )}
            </button>

            {showLogs && (
              <div className="p-3 bg-black/5 max-h-48 overflow-y-auto">
                <div className="space-y-1">
                  {migration.logs.map((log, i) => (
                    <div
                      key={i}
                      className="text-xs font-mono text-muted border-l-2 border-hi pl-2 py-1"
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Migration History List Component
// ----------------------------------------------------------------------------

interface MigrationHistoryProps {
  migrations: MigrationStatus[];
  onSelect?: (migration: MigrationStatus) => void;
  selectedId?: string;
  className?: string;
}

export function MigrationHistory({
  migrations,
  onSelect,
  selectedId,
  className = '',
}: MigrationHistoryProps) {
  if (migrations.length === 0) {
    return (
      <div className={`bg-surface border border-hi rounded-xl p-6 ${className}`}>
        <p className="text-center text-muted text-sm">No migration history</p>
      </div>
    );
  }

  const getStatusIcon = (status: MigrationStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-accent animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const formatDate = (timestamp?: string): string => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className={`bg-surface border border-hi rounded-xl overflow-hidden ${className}`}>
      <div className="p-4 border-b border-hi">
        <h4 className="font-bold">Migration History</h4>
      </div>

      <div className="divide-y divide-hi">
        {migrations.map((migration) => (
          <button
            key={migration.id}
            onClick={() => onSelect?.(migration)}
            className={`w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left ${
              selectedId === migration.id ? 'bg-accent/10' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(migration.status)}
              <div>
                <p className="text-sm font-medium">Migration {migration.id.slice(-8)}</p>
                <p className="text-xs text-muted">{formatDate(migration.startedAt)}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium">
                {migration.status === 'completed'
                  ? '100%'
                  : migration.status === 'failed'
                    ? 'Failed'
                    : `${Math.round(migration.progress)}%`}
              </p>
              <p className="text-xs text-muted capitalize">{migration.status}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
