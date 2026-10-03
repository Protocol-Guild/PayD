import type { Employee } from '../api';

type SortField = 'name' | 'department' | 'status' | 'salary';
type SortDirection = 'asc' | 'desc';

interface Props {
  employees: Employee[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

const avatarColors = [
  '#3b82f6', '#22c55e', '#a855f7', '#eab308',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const thFields: { key: SortField; label: string }[] = [
  { key: 'name', label: 'Employee' },
  { key: 'department', label: 'Department' },
  { key: 'status', label: 'Status' },
  { key: 'salary', label: 'Salary' },
];

export default function EmployeeTable({ employees, sortField, sortDirection, onSort }: Props) {
  return (
    <div className="table-wrapper">
      <table className="employee-table">
        <thead>
          <tr>
            {thFields.map(({ key, label }) => (
              <th
                key={key}
                className={key === sortField ? 'sorted' : ''}
                onClick={() => onSort(key)}
              >
                {label}
                {key === sortField && (
                  <span className="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <div className="table-empty">
                  <div className="table-empty-icon">🔍</div>
                  <p>No employees found matching your criteria.</p>
                </div>
              </td>
            </tr>
          ) : (
            employees.map(emp => (
              <tr key={emp.id}>
                <td>
                  <div className="avatar-cell">
                    <div
                      className="avatar"
                      style={{ background: getAvatarColor(emp.name) }}
                    >
                      {getInitials(emp.name)}
                    </div>
                    <div>
                      <div className="employee-name">{emp.name}</div>
                      <div className="employee-email">{emp.email}</div>
                    </div>
                  </div>
                </td>
                <td>{emp.department}</td>
                <td>
                  <span className={`status-badge ${emp.status}`}>
                    <span className="status-dot" />
                    {emp.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="salary-value">
                  ${emp.salary.toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
