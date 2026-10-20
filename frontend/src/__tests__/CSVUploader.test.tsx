import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CSVUploader } from '../components/CSVUploader';

describe('CSVUploader', () => {
  const mockOnDataParsed = vi.fn();
  const requiredColumns = ['name', 'email', 'wallet'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the upload zone with required columns info', () => {
    render(
      <CSVUploader requiredColumns={requiredColumns} onDataParsed={mockOnDataParsed} />
    );
    expect(screen.getByText(/Drag and drop your CSV file/i)).toBeTruthy();
    expect(screen.getByText(/name, email, wallet/i)).toBeTruthy();
  });

  // Helper: use drop event to trigger file upload (bypasses FileReader in jsdom)
  function simulateFileDrop(container: HTMLElement, file: File, content: string) {
    // Mock FileReader to work synchronously in jsdom
    const origReader = globalThis.FileReader;
    globalThis.FileReader = class MockFileReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      result: string | null = null;
      readAsText() {
        // Schedule onload on next microtask
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: content } });
          }
        }, 0);
      }
    } as unknown as typeof FileReader;

    // Find the drop zone
    const dropZone = container.querySelector('[class*="border-2"]') as HTMLElement;
    if (!dropZone) throw new Error('Drop zone not found');

    // Simulate drag events
    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);

    // Simulate drop with file
    Object.defineProperty(file, 'name', { value: file.name, writable: true });
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
        types: ['Files'],
      },
    });

    // Restore FileReader
    setTimeout(() => { globalThis.FileReader = origReader; }, 10);
  }

  it('parses a valid CSV file correctly', async () => {
    const { container } = render(
      <CSVUploader requiredColumns={requiredColumns} onDataParsed={mockOnDataParsed} />
    );

    const file = new File([''], 'employees.csv', { type: 'text/csv' });
    simulateFileDrop(container, file, 'name,email,wallet\nAlice,alice@test.com,GA12345\nBob,bob@test.com,GB67890');

    await waitFor(() => {
      expect(mockOnDataParsed).toHaveBeenCalled();
    }, { timeout: 5000 });

    const parsed = mockOnDataParsed.mock.calls[0][0];
    expect(parsed).toHaveLength(2);
    expect(parsed[0].data.name).toBe('Alice');
    expect(parsed[1].data.name).toBe('Bob');
    expect(parsed[0].isValid).toBe(true);
    expect(parsed[1].isValid).toBe(true);
  });

  it('detects missing required columns and shows an alert', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { container } = render(
      <CSVUploader requiredColumns={requiredColumns} onDataParsed={mockOnDataParsed} />
    );

    const file = new File([''], 'employees.csv', { type: 'text/csv' });
    simulateFileDrop(container, file, 'name,email\nAlice,alice@test.com');

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('wallet'));
    }, { timeout: 5000 });
    alertMock.mockRestore();
  });

  it('shows validation errors for missing fields', async () => {
    const { container } = render(
      <CSVUploader requiredColumns={requiredColumns} onDataParsed={mockOnDataParsed} />
    );

    const file = new File([''], 'employees.csv', { type: 'text/csv' });
    simulateFileDrop(container, file, 'name,email,wallet\n,alice@test.com,GA12345');

    await waitFor(() => {
      expect(mockOnDataParsed).toHaveBeenCalled();
    }, { timeout: 5000 });

    const parsed = mockOnDataParsed.mock.calls[0][0];
    expect(parsed[0].isValid).toBe(false);
    expect(parsed[0].errors.some((e: string) => e.includes('name'))).toBe(true);
  });

  it('shows file name, valid and invalid row counts after parsing', async () => {
    const { container } = render(
      <CSVUploader requiredColumns={requiredColumns} onDataParsed={mockOnDataParsed} />
    );

    const file = new File([''], 'employees.csv', { type: 'text/csv' });
    simulateFileDrop(container, file, 'name,email,wallet\nAlice,alice@test.com,GA12345\n,,');

    await waitFor(() => {
      expect(screen.getByText(/employees.csv/)).toBeTruthy();
    }, { timeout: 5000 });

    expect(screen.getByText(/1 valid/)).toBeTruthy();
    expect(screen.getByText(/1 rows with errors/)).toBeTruthy();
  });

  it('rejects non-CSV files with an alert', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <CSVUploader requiredColumns={requiredColumns} onDataParsed={mockOnDataParsed} />
    );

    const file = new File(['not csv'], 'data.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file] as unknown as FileList,
      writable: true,
      configurable: true,
    });
    fireEvent.change(fileInput, { target: { files: fileInput.files } });

    expect(alertMock).toHaveBeenCalledWith('Please upload a CSV file');
    expect(mockOnDataParsed).not.toHaveBeenCalled();
    alertMock.mockRestore();
  });

  it('shows preview table with parsed data', async () => {
    const { container } = render(
      <CSVUploader requiredColumns={requiredColumns} onDataParsed={mockOnDataParsed} />
    );

    const file = new File([''], 'employees.csv', { type: 'text/csv' });
    simulateFileDrop(container, file, 'name,email,wallet\nAlice,alice@test.com,GA12345');

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeTruthy();
    }, { timeout: 5000 });

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('GA12345')).toBeTruthy();
  });

  it('applies custom validators correctly', async () => {
    const validators = {
      email: (value: string) => {
        if (!value.includes('@')) return 'Invalid email format';
        return null;
      },
    };

    const { container } = render(
      <CSVUploader
        requiredColumns={requiredColumns}
        onDataParsed={mockOnDataParsed}
        validators={validators}
      />
    );

    const file = new File([''], 'employees.csv', { type: 'text/csv' });
    simulateFileDrop(container, file, 'name,email,wallet\nAlice,bad-email,GA12345');

    await waitFor(() => {
      expect(mockOnDataParsed).toHaveBeenCalled();
    }, { timeout: 5000 });

    const parsed = mockOnDataParsed.mock.calls[0][0];
    expect(parsed[0].isValid).toBe(false);
    expect(parsed[0].errors.some((e: string) => e.includes('Invalid email'))).toBe(true);
  });
});