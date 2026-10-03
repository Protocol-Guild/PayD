import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchEmployees } from './api';
import type { Employee } from './api';
import EmployeeTable from './components/EmployeeTable';
import SearchBar from './components/SearchBar';
import Filters from './components/Filters';
import StatsCards from './components/StatsCards';
import './App.css';

type SortField = 'name' | 'department' | 'status' | 'salary';
type SortDirection = 'asc' | 'desc';

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployees()
      .then(setEmployees)
      .catch(() => setError('Failed to load employees'))
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const deps = [...new Set(employees.map(e => e.department))].sort();
    return ['all', ...deps];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let result = employees.filter(emp => {
      const matchesSearch =
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
      const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
      return matchesSearch && matchesDept && matchesStatus;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'salary') {
        comparison = a.salary - b.salary;
      } else {
        comparison = a[sortField].localeCompare(b[sortField]);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [employees, searchTerm, departmentFilter, statusFilter, sortField, sortDirection]);

  const stats = useMemo(() => {
    const active = employees.filter(e => e.status === 'active').length;
    const inactive = employees.filter(e => e.status === 'inactive').length;
    const avgSalary = employees.length > 0
      ? Math.round(employees.reduce((sum, e) => sum + e.salary, 0) / employees.length)
      : 0;
    return { total: employees.length, active, inactive, avgSalary };
  }, [employees]);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PayD — Employee Directory</h1>
        <p className="header-subtitle">Advanced search, filtering & sorting</p>
      </header>

      <StatsCards stats={stats} />

      <SearchBar value={searchTerm} onChange={setSearchTerm} />

      <Filters
        departments={departments}
        selectedDept={departmentFilter}
        onDeptChange={setDepartmentFilter}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {loading ? (
        <div className="loading">Loading employees...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <EmployeeTable
          employees={filteredEmployees}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}

      <footer className="app-footer">
        <span>Showing {filteredEmployees.length} of {employees.length} employees</span>
      </footer>
    </div>
  );
}
