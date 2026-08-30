import React from 'react';
import {
  X,
  Mail,
  Wallet,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  ExternalLink,
} from 'lucide-react';
import AnimatedModal from './AnimatedModal';
import { formatCurrency } from '../services/currencyConversion';

/**
 * EmployeeProfileModal
 *
 * Reference integration for the standardized modal animation pattern.
 * Displays employee profile information with consistent enter/exit animations.
 *
 * This component demonstrates:
 * - Using AnimatedModal for standardized animations
 * - Respecting prefers-reduced-motion
 * - Proper accessibility (ARIA labels, focus management)
 * - Consistent styling with the design system
 */

interface EmployeeProfileData {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  position: string;
  department: string;
  startDate: string;
  totalPaid: number;
  lastPayment: string;
  status: 'active' | 'inactive';
}

interface EmployeeProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeProfileData | null;
}

export default function EmployeeProfileModal({
  isOpen,
  onClose,
  employee,
}: EmployeeProfileModalProps) {
  if (!employee) return null;

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black tracking-tight truncate">{employee.name}</h2>
          <p className="text-xs text-[var(--muted)] font-mono mt-0.5 truncate">
            {employee.position} · {employee.department}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Modal Content */}
      <div className="px-6 py-6 overflow-y-auto flex-1">
        <div className="flex flex-col gap-5">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded text-xs font-black uppercase tracking-widest border ${
                employee.status === 'active'
                  ? 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30'
                  : 'bg-[var(--muted)]/20 text-[var(--muted)] border-[var(--muted)]/30'
              }`}
            >
              {employee.status}
            </span>
          </div>

          {/* Contact Info */}
          <div className="p-4 bg-black/20 border border-[var(--border)] rounded-xl">
            <p className="block text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3 ml-1">
              Contact Information
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-[var(--muted)]" />
                <span className="text-[var(--text)]">{employee.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Wallet className="w-4 h-4 text-[var(--muted)]" />
                <span className="text-[var(--text)] font-mono text-xs break-all">
                  {employee.walletAddress}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-[var(--muted)]" />
                <span className="text-[var(--text)]">
                  Started {new Date(employee.startDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="p-4 bg-black/20 border border-[var(--border)] rounded-xl">
            <p className="block text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3 ml-1">
              Payment Summary
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  Total Paid
                </div>
                <div className="text-lg font-black text-[var(--success)]">
                  {formatCurrency(employee.totalPaid, 'USD')}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  Last Payment
                </div>
                <div className="text-sm font-bold">
                  {employee.lastPayment
                    ? new Date(employee.lastPayment).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-[var(--border-hi)] rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-all uppercase tracking-widest"
              style={{ minHeight: '44px' }}
            >
              Close
            </button>
            <a
              href={`https://stellar.expert/explorer/public/account/${employee.walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40 rounded-xl text-sm font-black hover:bg-[var(--accent)] hover:text-black transition-all uppercase tracking-widest"
              style={{ minHeight: '44px' }}
            >
              <TrendingUp className="w-4 h-4" />
              View on Explorer
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
