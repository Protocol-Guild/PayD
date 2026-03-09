import { useState, FormEvent } from 'react';
import { Button, Input, Textarea, Card } from '@stellar/design-system';

interface InvoiceFormData {
  hours: number;
  rate: number;
  currency: string;
  description: string;
  attachment_url?: string;
}

interface InvoiceSubmissionFormProps {
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  onCancel?: () => void;
}

export function InvoiceSubmissionForm({ onSubmit, onCancel }: InvoiceSubmissionFormProps) {
  const [formData, setFormData] = useState<InvoiceFormData>({
    hours: 0,
    rate: 0,
    currency: 'USDC',
    description: '',
    attachment_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = formData.hours * formData.rate;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    
    if (formData.hours <= 0) {
      setError('Hours must be greater than 0');
      return;
    }
    
    if (formData.rate <= 0) {
      setError('Rate must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      setFormData({ hours: 0, rate: 0, currency: 'USDC', description: '', attachment_url: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
        <h2>Submit Invoice</h2>
        
        {error && (
          <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#fee', color: '#c00', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="hours" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Hours Worked *
          </label>
          <Input
            id="hours"
            type="number"
            step="0.01"
            min="0"
            value={formData.hours || ''}
            onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="rate" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Hourly Rate *
          </label>
          <Input
            id="rate"
            type="number"
            step="0.01"
            min="0"
            value={formData.rate || ''}
            onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="currency" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Currency
          </label>
          <Input
            id="currency"
            type="text"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            placeholder="USDC"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="description" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Description
          </label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the work performed..."
            rows={4}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="attachment" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Attachment URL (optional)
          </label>
          <Input
            id="attachment"
            type="url"
            value={formData.attachment_url}
            onChange={(e) => setFormData({ ...formData, attachment_url: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '1.5rem' }}>
          <strong>Total Amount: {totalAmount.toFixed(2)} {formData.currency}</strong>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Invoice'}
          </Button>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} type="button">
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
