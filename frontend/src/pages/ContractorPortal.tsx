import { useState, useEffect } from 'react';
import { Button, Tabs } from '@stellar/design-system';
import { InvoiceSubmissionForm } from '../components/InvoiceSubmissionForm';
import { InvoiceList } from '../components/InvoiceList';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Invoice {
  id: number;
  invoice_number: string;
  hours: number;
  rate: number;
  total_amount: number;
  currency: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  submitted_at: string;
  rejection_reason?: string;
}

export function ContractorPortal() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/invoices/my-invoices`, {
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

  const handleSubmitInvoice = async (data: any) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit invoice');
    }

    await fetchInvoices();
    setShowForm(false);
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

  const filteredInvoices = invoices.filter((inv) => {
    if (activeTab === 'all') return true;
    return inv.status === activeTab;
  });

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Contractor Portal</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Submit New Invoice'}
        </Button>
      </div>

      {showForm && (
        <div style={{ marginBottom: '2rem' }}>
          <InvoiceSubmissionForm onSubmit={handleSubmitInvoice} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <Tabs>
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
            All ({invoices.length})
          </button>
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
            Pending ({invoices.filter((i) => i.status === 'pending').length})
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
            Approved ({invoices.filter((i) => i.status === 'approved').length})
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
            Paid ({invoices.filter((i) => i.status === 'paid').length})
          </button>
        </Tabs>
      </div>

      <InvoiceList invoices={filteredInvoices} onDownloadPDF={handleDownloadPDF} />
    </div>
  );
}
