/* eslint-disable react-x/no-array-index-key */
import React from 'react';

interface TableSkeletonProps {
  /** Number of skeleton rows to render (default 5) */
  rows?: number;
  /** Number of skeleton columns per row (default 4) */
  columns?: number;
  /** Width of each column as a fraction of the container (default 0.25 each) */
  columnWidths?: number[];
  /** Renders card-shaped placeholders when true */
  variant?: 'table' | 'card';
  className?: string;
}

/**
 * Reusable loading skeleton for data tables and card grids.
 *
 * `variant="table"` renders a table-like grid of shimmering rows.
 * `variant="card"` renders card-shaped placeholders (for card/grid layouts
 * such as schedule lists or dashboards).
 *
 * Column widths can be tuned via `columnWidths` to mirror the real layout so
 * there is no layout shift when content loads.
 */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  columnWidths,
  variant = 'table',
  className = '',
}) => {
  const widths = columnWidths ?? Array(columns).fill(0.25);

  if (variant === 'card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 ${className}`} role="status">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={`sk-card-${rowIdx}`}
            className="card glass noise p-6"
            style={{ borderRadius: '16px', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="skeleton-placeholder"
                style={{ width: 40, height: 40, borderRadius: 10 }}
              />
              <div className="flex-1 space-y-2">
                <div className="skeleton-placeholder" style={{ width: '60%', height: 14 }} />
                <div className="skeleton-placeholder" style={{ width: '35%', height: 10 }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="skeleton-placeholder" style={{ width: '90%', height: 12 }} />
              <div className="skeleton-placeholder" style={{ width: '75%', height: 12 }} />
              <div className="skeleton-placeholder" style={{ width: '80%', height: 12 }} />
            </div>
            <div className="flex justify-between mt-5 pt-4 border-t border-hi">
              <div className="skeleton-placeholder" style={{ width: '30%', height: 20 }} />
              <div className="skeleton-placeholder" style={{ width: '20%', height: 20 }} />
            </div>
          </div>
        ))}
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  return (
    <div
      className={`w-full card glass noise overflow-hidden p-0 ${className}`}
      role="status"
      aria-label="Loading"
    >
      {/* Header row */}
      <div
        className="flex gap-4 p-6 border-b border-hi"
        style={{ display: 'flex' }}
      >
        {widths.map((w, idx) => (
          <div
            key={`sk-head-${idx}`}
            className="skeleton-placeholder"
            style={{ width: `${Math.round(w * 100)}%`, height: 12 }}
          />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`sk-row-${rowIdx}`}
          className="p-6 border-b border-hi/60"
          style={{ display: 'flex', gap: 16 }}
        >
          {widths.map((w, colIdx) => (
            <div
              key={`sk-cell-${rowIdx}-${colIdx}`}
              className="skeleton-placeholder"
              style={{ width: `${Math.round(w * 100)}%`, height: 12 }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
};

export default TableSkeleton;