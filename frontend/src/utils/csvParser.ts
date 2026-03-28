export interface ParsedEmployee {
  name: string;
  email: string;
  role: string;
  salary: string;
  wallet?: string;
}

export const parseCSVFile = async (file: File): Promise<ParsedEmployee[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const employees = parseCSVText(text);
        resolve(employees);
      } catch (error) {
        reject(new Error('Failed to parse CSV file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};

export const parseCSVText = (text: string): ParsedEmployee[] => {
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Try to detect header
  const firstLine = lines[0];
  const hasHeader = /[a-zA-Z]/.test(firstLine) && !firstLine.includes(',');
  
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const employees: ParsedEmployee[] = [];
  
  for (const line of dataLines) {
    if (!line.trim()) continue;
    
    // Handle both comma and semicolon delimiters
    const delimiter = line.includes(';') ? ';' : ',';
    const values = parseCSVLine(line, delimiter);
    
    if (values.length >= 3) {
      employees.push({
        name: values[0]?.trim() || '',
        email: values[1]?.trim() || '',
        role: values[2]?.trim() || 'contractor',
        salary: values[3]?.trim() || '2000',
        wallet: values[4]?.trim() || '',
      });
    }
  }
  
  return employees.filter(emp => emp.name && emp.email);
};

export const parseCSVLine = (line: string, delimiter: string = ','): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last value
  result.push(current.trim());
  
  return result;
};

export const generateCSVTemplate = (): string => {
  const headers = ['name', 'email', 'role', 'salary', 'wallet'];
  const sampleData = [
    ['John Doe', 'john.doe@company.com', 'full-time', '5000', 'GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6'],
    ['Jane Smith', 'jane.smith@company.com', 'contractor', '3000', ''],
    ['Bob Johnson', 'bob.johnson@company.com', 'part-time', '2000', ''],
  ];
  
  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
};

export const downloadCSVTTemplate = () => {
  const csvContent = generateCSVTemplate();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', 'employee_template.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const validateEmployeeData = (employee: ParsedEmployee): string[] => {
  const errors: string[] = [];
  
  if (!employee.name.trim()) {
    errors.push('Name is required');
  }
  
  if (!employee.email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
    errors.push('Invalid email format');
  }
  
  if (!employee.salary.trim()) {
    errors.push('Salary is required');
  } else if (isNaN(parseFloat(employee.salary))) {
    errors.push('Salary must be a number');
  }
  
  if (employee.wallet && !/^[G][A-Z2-7]{55}$/.test(employee.wallet)) {
    errors.push('Invalid Stellar wallet address format');
  }
  
  return errors;
};

export const validateCSVData = (employees: ParsedEmployee[]): { valid: ParsedEmployee[]; invalid: Array<{ employee: ParsedEmployee; errors: string[] }> } => {
  const valid: ParsedEmployee[] = [];
  const invalid: Array<{ employee: ParsedEmployee; errors: string[] }> = [];
  
  employees.forEach(employee => {
    const errors = validateEmployeeData(employee);
    if (errors.length === 0) {
      valid.push(employee);
    } else {
      invalid.push({ employee, errors });
    }
  });
  
  return { valid, invalid };
};
