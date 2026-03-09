import { Card, Button } from '@stellar/design-system';

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

interface InvoiceListProps {
  invoices: Invoice[];
  onDownloadPDF: (id: number) => void;
}

export function InvoiceList({ invoices, onDownloadPDF }: InvoiceListProps) {
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
          No invoices found. Submit your first invoice to get started.
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
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
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

            {invoice.status === 'rejected' && invoice.rejection_reason && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fee', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.85rem', color: '#c00', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Rejection Reason
                </div>
                <div style={{ fontSize: '0.9rem', color: '#c00' }}>{invoice.rejection_reason}</div>
              </div>
            )}

            <Button size="sm" onClick={() => onDownloadPDF(invoice.id)}>
              Download PDF
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
