import { useState } from 'react';
import { Card, Button, Textarea } from '@stellar/design-system';

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

interface InvoiceApprovalListProps {
  invoices: Invoice[];
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number, reason: string) => Promise<void>;
  onDownloadPDF: (id: number) => void;
}

export function InvoiceApprovalList({ invoices, onApprove, onReject, onDownloadPDF }: InvoiceApprovalListProps) {
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState<number | null>(null);

  const handleApprove = async (id: number) => {
    setLoading(id);
    try {
      await onApprove(id);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    
    setLoading(id);
    try {
      await onReject(id, rejectionReason);
      setRejectingId(null);
      setRejectionReason('');
    } finally {
      setLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'paid': return '#007bff';
      case 'rejected': return '#dc3545';
      default: return '#ffc107';
    }
  };

  if (invoices.length === 0) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No invoices to review.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {invoices.map((invoice) => (
        <Card key={invoice.id}>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>{invoice.invoice_number}</h3>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                  Contractor: {invoice.first_name} {invoice.last_name} ({invoice.email})
                </p>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                  Submitted: {new Date(invoice.submitted_at).toLocaleDateString()}
                </p>
              </div>
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'white',
                  backgroundColor: getStatusColor(invoice.status),
                }}
              >
                {invoice.status.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Hours</div>
                <div style={{ fontWeight: 500 }}>{invoice.hours}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Rate</div>
                <div style={{ fontWeight: 500 }}>{invoice.rate} {invoice.currency}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Total</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#007bff' }}>
                  {invoice.total_amount.toFixed(2)} {invoice.currency}
                </div>
              </div>
            </div>

            {invoice.description && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Description</div>
                <div style={{ fontSize: '0.9rem' }}>{invoice.description}</div>
              </div>
            )}

            {rejectingId === invoice.id ? (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Rejection Reason *
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this invoice is being rejected..."
                  rows={3}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <Button
                    size="sm"
                    variant="error"
                    onClick={() => handleReject(invoice.id)}
                    disabled={loading === invoice.id}
                  >
                    Confirm Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectionReason('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                {invoice.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(invoice.id)}
                      disabled={loading === invoice.id}
                    >
                      {loading === invoice.id ? 'Approving...' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="error"
                      onClick={() => setRejectingId(invoice.id)}
                    >
                      Reject
                    </Button>
                  </>
                )}
                <Button size="sm" variant="secondary" onClick={() => onDownloadPDF(invoice.id)}>
                  Download PDF
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
