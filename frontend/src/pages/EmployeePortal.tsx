import React from 'react';
import {
  ArrowUpRight,
  RefreshCw,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  Search,
  ExternalLink,
  DollarSign,
  Award,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { useEmployeePortal, EmployeeTransaction } from '../hooks/useEmployeePortal';
import { useContractError } from '../hooks/useContractError';
import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { useNotification } from '../hooks/useNotification';
import {
  formatCurrency,
  getSupportedCurrencies,
  getCurrencySymbol,
  getStellarExpertAccountLink,
} from '../services/currencyConversion';
import styles from './EmployeePortal.module.css';
import { useWallet } from '../hooks/useWallet';

/* ── Helper: status badge ────────── */
function StatusBadge({ status }: { status: EmployeeTransaction['status'] }) {
  const map = {
    completed: { cls: styles.statusCompleted, dot: styles.statusDotCompleted },
    pending: { cls: styles.statusPending, dot: styles.statusDotPending },
    failed: { cls: styles.statusFailed, dot: styles.statusDotFailed },
  };
  const { cls, dot } = map[status];
  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      <span className={`${styles.statusDot} ${dot}`} />
      {status}
    </span>
  );
}

/* ── Helper: type badge ──────────── */
function TypeBadge({ type }: { type: EmployeeTransaction['type'] }) {
  const map = {
    salary: { cls: styles.txMemoTypeSalary, icon: <DollarSign className="w-3 h-3" /> },
    bonus: { cls: styles.txMemoTypeBonus, icon: <Award className="w-3 h-3" /> },
    reimbursement: { cls: styles.txMemoTypeReimbursement, icon: <Receipt className="w-3 h-3" /> },
  };
  const { cls } = map[type];
  return <span className={`${styles.txMemoType} ${cls}`}>{type}</span>;
}

/* ── Loading skeleton ────────────── */
function LoadingSkeleton() {
  return (
    <div>
      {['s1', 's2', 's3', 's4', 's5'].map((id) => (
        <div key={id} className={`${styles.skeleton} ${styles.skeletonRow}`} />
      ))}
    </div>
  );
}

/* ── Main Page Component ─────────── */
const EmployeePortal: React.FC = () => {
  const { address } = useWallet();
  const { notifySuccess, notifyError } = useNotification();
  const { contractError, handleContractError, clearContractError } = useContractError();
  const [pendingClaims, setPendingClaims] = React.useState<PendingClaimRecord[]>([]);
  const [isClaiming, setIsClaiming] = React.useState<string | null>(null);
  const [pendingClaimsError, setPendingClaimsError] = React.useState<string | null>(null);
  const {
    transactions,
    balance,
    isLoading,
    error,
    selectedCurrency,
    setSelectedCurrency,
    refreshData,
    currentPage,
    setCurrentPage,
    totalPages,
    filterStatus,
    setFilterStatus,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
  } = useEmployeePortal();

  const currencies = getSupportedCurrencies();

  // Calculate stats
  const totalReceived = balance?.orgUsd || 0;
  const totalTransactions = transactions.length;
  const pendingCount = transactions.filter((t) => t.status === 'pending').length;
  const lastPayment = transactions.find((t) => t.status === 'completed');

  React.useEffect(() => {
    let cancelled = false;

    async function loadPendingClaims() {
      if (!address) {
        setPendingClaims([]);
        setPendingClaimsError(null);
        return;
      }

      try {
        setPendingClaimsError(null);
        const claims = await fetchPendingClaims(address);
        if (!cancelled) setPendingClaims(claims);
      } catch (e) {
        if (!cancelled) {
          setPendingClaims([]);
          setPendingClaimsError(e instanceof Error ? e.message : 'Failed to load pending claims');
        }
      }
    }

    void loadPendingClaims();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const handleClaim = async (claimId: string, balanceId: string | null) => {
    setIsClaiming(claimId);
    clearContractError();
    try {
      // Simulate contract invocation delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate a contract error for testing if the amount is '777'
      const claim = pendingClaims.find((c) => c.id === claimId);
      if (claim?.amount === '777') {
        const mockErrorXdr = 'AAAABAAAAAEAAAABAAAABQ=='; // ScvError(ScError{type: SCE_CONTRACT, code: 5})
        handleContractError(mockErrorXdr);
        throw new Error('Contract invocation failed');
      }

      notifySuccess('Claim successful!', 'The funds have been transferred to your wallet.');

      // Remove the claimed item from the list
      setPendingClaims((prev) => prev.filter((c) => c.id !== claimId));
    } catch (err) {
      console.error(err);
      notifyError('Claim failed', 'A contract error occurred. Please review the details below.');
    } finally {
      setIsClaiming(null);
    }
  };

  return (
    <div className="page-fade flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      {/* ── Page Header ─────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            My <span className="text-[var(--accent)]">Portal</span>
          </h1>
          <p className={styles.pageSubtitle}>
            View your salary payments, balances, and transaction history
          </p>
        </div>
        {address && (
          <a
            href={getStellarExpertAccountLink(address)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.walletBadge}
          >
            <span className={styles.walletDot} />
            {address.substring(0, 6)}...{address.substring(address.length - 4)}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}
      </div>

      {/* ── Balance Card ─────────────── */}
      <div className={styles.balanceCard}>
        <div className="relative z-10">
          <p className={styles.balanceLabel}>Total Balance</p>
          <div className={styles.balanceAmountRow}>
            {isLoading ? (
              <div className={`${styles.skeleton}`} style={{ width: 200, height: 48 }} />
            ) : (
              <>
                <span className={styles.balanceAmount}>
                  {formatCurrency(balance?.orgUsd || 0, 'USD')}
                </span>
                <span className={styles.localAmount}>
                  ≈ {formatCurrency(balance?.localAmount || 0, selectedCurrency)}
                </span>
              </>
            )}
          </div>

          <p className={styles.rateInfo}>
            1 ORGUSD ≈ {getCurrencySymbol(selectedCurrency)}
            {balance?.exchangeRate?.toLocaleString()} {selectedCurrency}
            {balance?.lastUpdated && <> · Updated {balance.lastUpdated.toLocaleTimeString()}</>}
          </p>

          <div className={styles.currencySelector}>
            <span className="text-[11px] text-[var(--muted)] uppercase tracking-widest font-semibold">
              Local Currency:
            </span>
            <select
              className={styles.currencySelect}
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
            >
              {Object.entries(currencies).map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ──────────────── */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{
              background: 'rgba(74, 240, 184, 0.1)',
              border: '1px solid rgba(74, 240, 184, 0.2)',
            }}
          >
            <Wallet className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className={styles.statValue}>{formatCurrency(totalReceived, 'USD')}</div>
          <div className={styles.statLabel}>Total Received</div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{
              background: 'rgba(124, 111, 247, 0.1)',
              border: '1px solid rgba(124, 111, 247, 0.2)',
            }}
          >
            <TrendingUp className="w-4 h-4 text-[var(--accent2)]" />
          </div>
          <div className={styles.statValue}>{totalTransactions}</div>
          <div className={styles.statLabel}>Transactions</div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{
              background: 'rgba(255, 213, 0, 0.1)',
              border: '1px solid rgba(255, 213, 0, 0.2)',
            }}
          >
            <Clock className="w-4 h-4 text-[#ffd500]" />
          </div>
          <div className={styles.statValue}>{pendingCount}</div>
          <div className={styles.statLabel}>Pending</div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{
              background: 'rgba(63, 185, 80, 0.1)',
              border: '1px solid rgba(63, 185, 80, 0.2)',
            }}
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
          </div>
          <div className={styles.statValue}>
            {lastPayment
              ? new Date(lastPayment.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
              : '—'}
          </div>
          <div className={styles.statLabel}>Last Payment</div>
        </div>
      </div>

      {/* ── Error Banner ─────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,123,114,0.08)] border border-[rgba(255,123,114,0.2)]">
          <AlertCircle className="w-5 h-5 text-[var(--danger)]" />
          <span className="text-sm text-[var(--danger)]">{error}</span>
        </div>
      )}

      {/* ── Pending Claims ───────────── */}
      {(pendingClaimsError || pendingClaims.length > 0) && (
        <div className="w-full card glass noise p-6">
          <div className="flex flex-col mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Pending Claims</h2>
              <button
                type="button"
                onClick={() => {
                  if (address) {
                    void fetchPendingClaims(address)
                      .then((claims) => {
                        setPendingClaimsError(null);
                        setPendingClaims(claims);
                      })
                      .catch((e) => {
                        setPendingClaims([]);
                        setPendingClaimsError(
                          e instanceof Error ? e.message : 'Failed to refresh pending claims'
                        );
                      });
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/40 border border-hi text-xs font-semibold"
                disabled={!address}
              >
                Refresh
              </button>
            </div>
            <ContractErrorPanel error={contractError} />
          </div>

          {pendingClaimsError ? (
            <div className="text-sm text-[var(--danger)]">{pendingClaimsError}</div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-sm text-[var(--muted)]">
                If you have a pending claim, add the ORGUSD trustline in your wallet and then claim
                the balance.
              </div>
              {pendingClaims.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 rounded-xl bg-black/20 border border-hi"
                >
                  <div className="flex flex-col">
                    <div className="text-sm font-semibold">
                      {c.amount} {c.asset_code}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      Created {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--muted)] break-all flex-1">
                    Balance ID: {c.stellar_balance_id || '—'}
                  </div>
                  <button
                    onClick={() => void handleClaim(c.id, c.stellar_balance_id)}
                    disabled={isClaiming === c.id}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isClaiming === c.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3" />
                    )}
                    Claim Funds
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Transactions Table ────────── */}
      <div className={styles.txSection}>
        <div className={styles.txHeader}>
          <h2 className={styles.txTitle}>Payment History</h2>

          <div className={styles.txFilters}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search tx hash, memo…"
                className={styles.searchInput}
                style={{ paddingLeft: 28 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className={styles.filterSelect}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <select
              className={styles.filterSelect}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="salary">Salary</option>
              <option value="bonus">Bonus</option>
              <option value="reimbursement">Reimbursement</option>
            </select>

            <button
              className={styles.refreshBtn}
              onClick={() => void refreshData()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? styles.refreshSpin : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Table Header */}
        <div
          className={styles.txRow}
          style={{
            borderBottom: '1px solid var(--border-hi)',
            padding: '10px 24px',
          }}
        >
          <span className={styles.statLabel}>Date</span>
          <span className={styles.statLabel}>Description</span>
          <span className={styles.statLabel}>Amount</span>
          <span className={`${styles.statLabel} hidden md:block`}>Status</span>
          <span className={`${styles.statLabel} hidden md:block`}>Hash</span>
          <span className={styles.statLabel}>Verify</span>
        </div>

        {/* Rows */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <Wallet className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No transactions found</p>
            <p className={styles.emptyDesc}>Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className={styles.txRow}>
              {/* Date */}
              <div>
                <div className={styles.txDate}>
                  {new Date(tx.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className={styles.txDateSub}>
                  {new Date(tx.date).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {/* Memo + Type */}
              <div>
                <span className={styles.txMemo}>{tx.memo}</span>
                <TypeBadge type={tx.type} />
              </div>

              {/* Amount */}
              <div>
                <div className={styles.txAmount}>+{formatCurrency(tx.amount, 'USD')}</div>
                <div className={styles.txAmountLocal}>
                  ≈ {formatCurrency(tx.amount * (balance?.exchangeRate || 1), selectedCurrency)}
                </div>
              </div>

              {/* Status */}
              <div className="hidden md:block">
                <StatusBadge status={tx.status} />
              </div>

              {/* Hash */}
              <div className="hidden md:block">
                <div className={styles.txHash}>
                  {tx.txHash.substring(0, 8)}…{tx.txHash.substring(tx.txHash.length - 6)}
                </div>
              </div>

              {/* Stellar Expert Link */}
              <div>
                <a
                  href={tx.stellarExpertUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.stellarLink}
                  title="View on Stellar Expert"
                >
                  <ArrowUpRight className={styles.stellarLinkIcon} />
                  <span className="hidden sm:inline">Explorer</span>
                </a>
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`${styles.pageBtn} ${p === currentPage ? styles.pageBtnActive : ''}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeePortal;
