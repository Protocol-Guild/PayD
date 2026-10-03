interface Props {
  departments: string[];
  selectedDept: string;
  onDeptChange: (dept: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

export default function Filters({
  departments,
  selectedDept,
  onDeptChange,
  selectedStatus,
  onStatusChange,
}: Props) {
  return (
    <div className="filters-row">
      <select
        className="filter-select"
        value={selectedDept}
        onChange={e => onDeptChange(e.target.value)}
      >
        {departments.map(dept => (
          <option key={dept} value={dept}>
            {dept === 'all' ? 'All Departments' : dept}
          </option>
        ))}
      </select>

      <select
        className="filter-select"
        value={selectedStatus}
        onChange={e => onStatusChange(e.target.value)}
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  );
}
