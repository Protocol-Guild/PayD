import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EmployeeList } from '../components/EmployeeList';

const mockEmployees = [
  { id: '1', name: 'Alice', email: 'alice@test.com', position: 'Engineer', wallet: 'GA12345', salary: 80000, status: 'Active' as const },
  { id: '2', name: 'Bob', email: 'bob@test.com', position: 'Designer', wallet: 'GB67890', salary: 70000, status: 'Active' as const },
  { id: '3', name: 'Charlie', email: 'charlie@test.com', position: 'Engineer', wallet: 'GC11111', salary: 90000, status: 'Inactive' as const },
];

describe('EmployeeList', () => {
  const mockOnAddEmployee = vi.fn();
  const mockOnEditEmployee = vi.fn();
  const mockOnRemoveEmployee = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all employees in the table', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={mockOnAddEmployee}
      />
    );
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Charlie').length).toBeGreaterThan(0);
  });

  it('shows "No employees found" when the list is empty', () => {
    render(
      <EmployeeList
        employees={[]}
        onAddEmployee={mockOnAddEmployee}
      />
    );
    const noEmployees = screen.getAllByText('No employees found');
    expect(noEmployees.length).toBeGreaterThan(0);
  });

  it('sorts employees by name when clicking the Name header', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={mockOnAddEmployee}
      />
    );

    // Click Name header to sort (first click toggles to descending since default sortKey='name')
    const nameHeaders = screen.getAllByText(/Name/);
    fireEvent.click(nameHeaders[0]);

    // After clicking once: descending (Charlie, Bob, Alice)
    const rows = screen.getAllByRole('row');
    // rows[0] is the header row, rows[1] is first data row
    expect(rows[1].textContent).toContain('Charlie');

    // Click again to sort ascending
    fireEvent.click(nameHeaders[0]);
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alice');
  });

  it('sorts employees by salary when clicking the Salary header', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={mockOnAddEmployee}
      />
    );

    // Use getAllByText since "Salary" appears in both desktop table and mobile card
    const salaryHeaders = screen.getAllByText(/Salary/);
    // First one is the table header, sorting by salary (new key) → ascending
    fireEvent.click(salaryHeaders[0]);

    // Ascending: Bob (70000), Alice (80000), Charlie (90000)
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('Bob');
  });

  it('shows the CSV import section when clicking "Import from CSV"', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={mockOnAddEmployee}
      />
    );

    fireEvent.click(screen.getByText('Import from CSV'));
    expect(screen.getByText(/Drag and drop your CSV file/i)).toBeTruthy();
  });

  it('shows edit and remove buttons when callbacks are provided', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={mockOnAddEmployee}
        onEditEmployee={mockOnEditEmployee}
        onRemoveEmployee={mockOnRemoveEmployee}
      />
    );

    // Edit and remove buttons should exist
    const editButtons = screen.getAllByTitle('Edit');
    const removeButtons = screen.getAllByTitle('Remove');
    expect(editButtons.length).toBeGreaterThan(0);
    expect(removeButtons.length).toBeGreaterThan(0);
  });

  it('displays status badges for each employee', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={mockOnAddEmployee}
      />
    );

    // "Active" appears in both desktop table and mobile card views
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(2);

    // Inactive employee badge
    const inactiveBadges = screen.getAllByText('Inactive');
    expect(inactiveBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows wallet in shortened format', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={mockOnAddEmployee}
      />
    );

    // Wallet text appears in both desktop (table) and mobile (card) views
    const wallets = screen.getAllByText(/GA12/);
    expect(wallets.length).toBeGreaterThan(0);
    const wallets2 = screen.getAllByText(/GB67/);
    expect(wallets2.length).toBeGreaterThan(0);
  });
});