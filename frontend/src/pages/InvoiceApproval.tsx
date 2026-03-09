import { useState, useEffect } from 'react';
import { Tabs } from '@stellar/design-system';
import { InvoiceApprovalList } from '../components/InvoiceApprovalList';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Invoice {
  id: number;
  invoice_number: string;
  contractor_id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  hours: number;
  rate: number;
  total_amount: number;
  currency: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  submitted_at: string;
}

export function InvoiceApproval() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchInvoices();
  }, [activeTab]);

  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const statusParam = activeTab !== 'all' ? `?status=${activeTab}` : '';
      const response = await fetch(`${API_BASE}/api/invoices${statusParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/api/invoices/${id}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve invoice');
    }

    await fetchInvoices();
  };

  const handleReject = async (id: number, reason: string) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/api/invoices/${id}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'rejected', rejection_reason: reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject invoice');
    }

    await fetchInvoices();
  };

  const handleDownloadPDF = async (id: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Invoice Approval</h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <Tabs>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'pending' ? '#007bff' : 'transparent',
              color: activeTab === 'pending' ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'approved' ? '#007bff' : 'transparent',
              color: activeTab === 'approved' ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            Approved
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'rejected' ? '#007bff' : 'transparent',
              color: activeTab === 'rejected' ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            Rejected
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'paid' ? '#007bff' : 'transparent',
              color: activeTab === 'paid' ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            Paid
          </button>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'all' ? '#007bff' : 'transparent',
              color: activeTab === 'all' ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            All
          </button>
        </Tabs>
      </div>

      <InvoiceApprovalList
        invoices={invoices}
        onApprove={handleApprove}
        onReject={handleReject}
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  );
}
