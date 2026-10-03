const API_BASE = 'https://api.github.com/repos/Protocol-Guild/PayD';

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  status: 'active' | 'inactive';
  joinDate: string;
  salary: number;
}

export const fetchEmployees = async (): Promise<Employee[]> => {
  const response = await fetch(`${API_BASE}/issues?state=all&sort=updated&per_page=100`);
  if (!response.ok) throw new Error('Failed to fetch employees');
  const data = await response.json();
  return data.map((issue: any) => ({
    id: issue.number.toString(),
    name: issue.title,
    email: issue.user.login,
    department: issue.labels?.[0]?.name || 'General',
    role: issue.labels?.[1]?.name || 'Contributor',
    status: issue.labels?.some((l: any) => l.name === 'enhancement') ? 'active' : 'inactive',
    joinDate: new Date(issue.created_at).toLocaleDateString(),
    salary: Math.floor(Math.random() * 50000) + 40000,
  }));
};
