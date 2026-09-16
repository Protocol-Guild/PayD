import { useState, useMemo, useCallback } from 'react';
import { Button, Card, Icon } from '@stellar/design-system';
import { useNotification } from '../hooks/useNotification';

// Define all possible columns for the report
type ReportColumn = {
  id: string;
  label: string;
};

const ALL_COLUMNS: ReportColumn[] = [
  { id: 'worker_id', label: 'Worker ID' },
  { id: 'amount', label: 'Amount' },
  { id: 'asset', label: 'Asset' },
  { id: 'setup_date', label: 'Stream Setup Date' },
  { id: 'payout_date', label: 'Expected Payout Date' },
  { id: 'status', label: 'Status' },
];

// Mock data (matching the columns)
const MOCK_DATA = [
  {
    worker_id: 'W-1001',
    amount: '500.00',
    asset: 'USDC',
    setup_date: '2026-02-01',
    payout_date: '2026-02-15',
    status: 'Paid',
  },
  {
    worker_id: 'W-1002',
    amount: '750.00',
    asset: 'USDC',
    setup_date: '2026-02-01',
    payout_date: '2026-02-15',
    status: 'Paid',
  },
  {
    worker_id: 'W-1003',
    amount: '1200.00',
    asset: 'XLM',
    setup_date: '2026-02-05',
    payout_date: '2026-02-28',
    status: 'Pending',
  },
  {
    worker_id: 'W-1004',
    amount: '400.00',
    asset: 'USDC',
    setup_date: '2026-02-10',
    payout_date: '2026-02-28',
    status: 'Pending',
  },
  {
    worker_id: 'W-1005',
    amount: '3000.00',
    asset: 'XLM',
    setup_date: '2026-01-15',
    payout_date: '2026-01-31',
    status: 'Paid',
  },
];

const CustomReportBuilder = () => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(ALL_COLUMNS.map((c) => c.id));
  const [startDate, setStartDate] = useState<string>('2026-02-01');
  const [endDate, setEndDate] = useState<string>('2026-02-28');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { notifySuccess, notifyError } = useNotification();

  const toggleColumn = (colId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const activeColumns = ALL_COLUMNS.filter((c) => selectedColumns.includes(c.id));

  // Filter data by date range
  const filteredData = useMemo(() => {
    return MOCK_DATA.filter((row) => {
      const rowDate = new Date(row.setup_date);
      const start = startDate ? new Date(startDate) : new Date('2000-01-01');
      const end = endDate ? new Date(endDate) : new Date('2100-01-01');
      return rowDate >= start && rowDate <= end;
    });
  }, [startDate, endDate]);

  // Escape a cell value for CSV (wrap in quotes if it contains commas, quotes, or newlines)
  const escapeCsvCell = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const handleExport = useCallback(async () => {
    setExportError(null);
    setIsExporting(true);

    try {
      // Simulate a brief async export (e.g. calling a backend endpoint)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Build CSV string
      const header = activeColumns.map((c) => c.label).join(',');
      const rows = filteredData.map((row) =>
        activeColumns.map((col) => escapeCsvCell(String(row[col.id as keyof typeof row]))).join(',')
      );
      const csv = [header, ...rows].join('\n');

      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payroll-report-${startDate}-to-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notifySuccess('Export successful', `${filteredData.length} records exported`);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'An unexpected error occurred during export.';
      setExportError(msg);
      notifyError('Export failed', msg);
    } finally {
      setIsExporting(false);
    }
  }, [filteredData, activeColumns, startDate, endDate, notifySuccess, notifyError]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Custom Report Builder</h1>
        <p className="text-gray-600">
          Select columns and date ranges to preview and export custom payroll data.
        </p>
      </div>

      {exportError && (
        <div className="rounded-lg border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <Icon.AlertCircle className="h-4 w-4 shrink-0" />
          {exportError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Controls Sidebar */}
        <div className="md:col-span-1 space-y-6 flex flex-col">
          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Date Range</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Columns</h3>
              <div className="space-y-2">
                {ALL_COLUMNS.map((col) => (
                  <label key={col.id} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300"
                      checked={selectedColumns.includes(col.id)}
                      onChange={() => toggleColumn(col.id)}
                    />
                    <span className="text-gray-700 text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          <Button
            onClick={() => void handleExport()}
            variant="primary"
            size="md"
            className="w-full flex justify-center mt-auto"
            disabled={isExporting || activeColumns.length === 0 || filteredData.length === 0}
          >
            {isExporting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <Icon.DownloadCloud01 className="mr-2" />
                Export Data
              </>
            )}
          </Button>
        </div>

        {/* Live Preview Pane */}
        <div className="md:col-span-3">
          <Card>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-xl">Live Preview</h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {filteredData.length} records found
                </span>
              </div>

              <div className="overflow-x-auto">
                {activeColumns.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
                    <Icon.Filter2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium">No columns selected</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Select at least one column from the sidebar to preview data.
                    </p>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
                    <Icon.SearchLg className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium">No matching records</p>
                    <p className="text-gray-400 text-sm mt-1">
                      No records found for the selected date range. Try adjusting your start or end
                      date.
                    </p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {activeColumns.map((col) => (
                          <th
                            key={col.id}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredData.map((row) => (
                        <tr key={row.worker_id} className="hover:bg-gray-50">
                          {activeColumns.map((col) => (
                            <td
                              key={col.id}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                            >
                              {row[col.id as keyof typeof row]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomReportBuilder;
