import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeeList } from '../EmployeeList';

interface Employee {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  position: string;
  wallet?: string;
  salary?: number;
  status?: 'Active' | 'Inactive';
}

const employees: Employee[] = [
  {
    id: '1',
    name: 'Alice',
    email: 'alice@test.com',
    position: 'Engineer',
    wallet: 'GABC1234567890WALLET1',
    salary: 5000,
    status: 'Active',
  },
  {
    id: '2',
    name: 'Bob',
    email: 'bob@test.com',
    position: 'Designer',
    wallet: 'GXYZ9876543210WALLET2',
    salary: 4000,
    status: 'Inactive',
  },
  {
    id: '3',
    name: 'Charlie',
    email: 'charlie@test.com',
    position: 'Manager',
    salary: 8000,
    status: 'Active',
  },
];

// The component renders both a desktop table (hidden md:block)
// and a mobile card list (md:hidden); jsdom has no breakpoints so both
// are in the DOM. We therefore scope queries to the desktop table where
// possible and fall back to getAllBy for duplicated text.

function renderList(props: Partial<Parameters<typeof EmployeeList>[0]> = {}) {
  const onAddEmployee = vi.fn();
  const onEmployeeClick = vi.fn();
  const onEditEmployee = vi.fn();
  const onRemoveEmployee = vi.fn();

  render(
    <EmployeeList
      employees={employees}
      onAddEmployee={onAddEmployee}
      onEmployeeClick={onEmployeeClick}
      onEditEmployee={onEditEmployee}
      onRemoveEmployee={onRemoveEmployee}
      {...props}
    />,
  );

  return { onAddEmployee, onEmployeeClick, onEditEmployee, onRemoveEmployee };
}

function desktopTable() {
  // Desktop view is a <table>; the mobile view renders cards in divs.
  return within(screen.getByRole('table'));
}

describe('EmployeeList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the employee table with all employees', () => {
    renderList();

    const table = desktopTable();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(table.getByText('Alice')).toBeInTheDocument();
    expect(table.getByText('Bob')).toBeInTheDocument();
    expect(table.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows empty state when there are no employees', () => {
    renderList({ employees: [] });

    expect(screen.getAllByText('No employees found').length).toBeGreaterThan(0);
  });

  it('shortens wallet addresses in the table', () => {
    renderList();

    const table = desktopTable();
    expect(table.getByText('GABC...LET1')).toBeInTheDocument();
    expect(table.getByText('GXYZ...LET2')).toBeInTheDocument();
  });

  it('renders mobile card view for employees', () => {
    renderList();

    // Mobile card view duplicates employee names (both views render in jsdom)
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(2);
  });

  it('shows salary as clickable button when onEditEmployee is provided', () => {
    renderList();

    // Desktop + mobile views both render the salary button
    const salaryButtons = screen.getAllByRole('button', { name: '5000' });
    expect(salaryButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens edit modal when salary button is clicked and saves edited salary', async () => {
    const user = userEvent.setup();
    const { onEditEmployee } = renderList();

    await user.click(screen.getAllByRole('button', { name: '5000' })[0]);

    expect(screen.getByText('Edit Salary')).toBeInTheDocument();

    const salaryInput = screen.getByRole('spinbutton');
    await user.clear(salaryInput);
    await user.type(salaryInput, '7500');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEditEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', name: 'Alice', salary: 7500 }),
    );
  });

  it('opens delete confirm and calls onRemoveEmployee', async () => {
    const user = userEvent.setup();
    const { onRemoveEmployee } = renderList();

    const removeButtons = screen.getAllByTitle('Remove');
    expect(removeButtons.length).toBeGreaterThanOrEqual(3);

    await user.click(removeButtons[0]);

    expect(screen.getByText('Confirm Removal')).toBeInTheDocument();
    // The confirm modal has exactly one "Remove" button (title-less)
    const confirmButtons = screen
      .getAllByRole('button', { name: 'Remove' })
      .filter((b) => !b.getAttribute('title'));
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(onRemoveEmployee).toHaveBeenCalledWith('1');
  });

  it('opens the CSV uploader and cancels it', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByText('Import from CSV'));

    expect(screen.getByText(/Drag and drop your CSV file/)).toBeInTheDocument();
    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByText(/Drag and drop your CSV file/)).not.toBeInTheDocument();
  });

  it('parses a CSV file and adds employees via CSV import', async () => {
    const user = userEvent.setup();
    const { onAddEmployee } = renderList();

    await user.click(screen.getByText('Import from CSV'));

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const csvContent = [
      'name,email,wallet,position,salary,status',
      'Dana,dana@test.com,GDANA123,Analyst,6000,Active',
    ].join('\n');
    const file = new File([csvContent], 'employees.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const addCsvButton = await screen.findByRole('button', {
      name: 'Add Employees from CSV',
    });

    await waitFor(() => {
      expect(addCsvButton).not.toBeDisabled();
    });
    await user.click(addCsvButton);

    expect(onAddEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Dana',
        email: 'dana@test.com',
        position: 'Analyst',
        salary: 6000,
        status: 'Active',
      }),
    );
  });

  it('does not call onAddEmployee when CSV import is cancelled', async () => {
    const user = userEvent.setup();
    const { onAddEmployee } = renderList();

    await user.click(screen.getByText('Import from CSV'));
    await user.click(screen.getByText('Cancel'));

    expect(onAddEmployee).not.toHaveBeenCalled();
  });
});