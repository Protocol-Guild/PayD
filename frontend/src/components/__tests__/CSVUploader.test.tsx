import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CSVUploader } from '../CSVUploader';

const requiredColumns = ['name', 'email', 'wallet'];

const validCSV = ['name,email,wallet', 'Alice,alice@test.com,GABC123', 'Bob,bob@test.com,GXYZ987'].join(
  '\n',
);

function makeFile(content: string, name = 'employees.csv') {
  return new File([content], name, { type: 'text/csv' });
}

function renderUploader(overrides: { validators?: Record<string, (v: string) => string | null> } = {}) {
  const onDataParsed = vi.fn();
  render(
    <CSVUploader
      requiredColumns={requiredColumns}
      onDataParsed={onDataParsed}
      validators={overrides.validators}
    />,
  );
  return { onDataParsed };
}

describe('CSVUploader', () => {
  it('renders upload zone with required columns listed', () => {
    renderUploader();

    expect(screen.getByText(/Drag and drop your CSV file/)).toBeInTheDocument();
    expect(screen.getByText(/Required columns: name, email, wallet/)).toBeInTheDocument();
  });

  it('parses a valid CSV file and calls onDataParsed', async () => {
    const { onDataParsed } = renderUploader();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(validCSV)] } });

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalledTimes(1);
    });

    const result = onDataParsed.mock.calls[0][0];
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      rowNumber: 2,
      isValid: true,
      data: { name: 'Alice', email: 'alice@test.com', wallet: 'GABC123' },
    });
    // Preview table shows the parsed rows + file name declared
    expect(await screen.findByText(/File: employees\.csv/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('marks rows with missing required fields as invalid', async () => {
    const { onDataParsed } = renderUploader();
    const csv = ['name,email,wallet', 'Alice,,GABC123', ',bob@test.com,'].join('\n');

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(csv)] } });

    await waitFor(() => expect(onDataParsed).toHaveBeenCalledTimes(1));

    const result = onDataParsed.mock.calls[0][0];
    expect(result[0].isValid).toBe(false);
    expect(result[0].errors).toContain('Missing required field: email');
    expect(result[1].isValid).toBe(false);
    // error rows are rendered in the preview (with bullet prefix)
    expect(screen.getByText((content) => content.includes('Missing required field: email'))).toBeInTheDocument();
  });

  it('applies custom validators to rows', async () => {
    const { onDataParsed } = renderUploader({
      validators: {
        wallet: (value) => (value.startsWith('G') ? null : 'Invalid wallet format'),
      },
    });
    const csv = ['name,email,wallet', 'Alice,alice@test.com,BAD'].join('\n');

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(csv)] } });

    await waitFor(() => expect(onDataParsed).toHaveBeenCalledTimes(1));

    const result = onDataParsed.mock.calls[0][0];
    expect(result[0].isValid).toBe(false);
    expect(result[0].errors).toContain('Invalid wallet format');
    expect(screen.getByText((content) => content.includes('Invalid wallet format'))).toBeInTheDocument();
  });

  it('rejects a non-CSV file with an alert', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onDataParsed } = renderUploader();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('name\nAlice', 'data.txt')] } });

    expect(alertSpy).toHaveBeenCalledWith('Please upload a CSV file');
    expect(onDataParsed).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('supports drag and drop of a CSV file', async () => {
    const { onDataParsed } = renderUploader();
    const dropZone = screen.getByText(/Drag and drop your CSV file/).closest('div')!;

    const dataTransfer = {
      files: [makeFile(validCSV)],
    } as unknown as DataTransfer;

    fireEvent.dragEnter(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => expect(onDataParsed).toHaveBeenCalledTimes(1));
    expect(onDataParsed.mock.calls[0][0]).toHaveLength(2);
  });

  it('shows valid/invalid row counts after parsing', async () => {
    renderUploader();
    const csv = ['name,email,wallet', 'Alice,alice@test.com,GABC1', 'Bob,,GXYZ9'].join('\n');

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(csv)] } });

    expect(await screen.findByText('1 valid rows')).toBeInTheDocument();
    expect(screen.getByText('1 rows with errors')).toBeInTheDocument();
  });

  it('opens the file picker when the upload button is clicked', async () => {
    const user = userEvent.setup();
    renderUploader();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    await user.click(screen.getByText(/Drag and drop your CSV file/));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});