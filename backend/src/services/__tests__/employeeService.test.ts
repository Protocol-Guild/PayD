import { EmployeeService } from '../employeeService.js';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { PoolClient } from 'pg';

type QueryResult = { rows: Record<string, unknown>[]; rowCount?: number };
type Query = (sql: string, values?: unknown[]) => Promise<QueryResult>;
const mockQuery = jest.fn<Query>();
const mockPoolQuery = jest.fn<Query>();
const mockClientQuery = jest.fn<Query>();
const mockRelease = jest.fn<(error?: Error) => void>();
const mockClient = { query: mockClientQuery, release: mockRelease };
const mockConnect = jest.fn<() => Promise<typeof mockClient>>();

// Mock pg Pool
jest.mock('../../config/database.js', () => ({
  pool: {
    query: (...args: Parameters<Query>) => mockPoolQuery(...args),
    connect: () => mockConnect(),
  },
}));

describe('EmployeeService', () => {
  let employeeService: EmployeeService;

  beforeEach(() => {
    mockQuery.mockReset();
    mockPoolQuery.mockReset();
    mockRelease.mockReset();
    mockConnect.mockReset().mockResolvedValue(mockClient);
    mockClientQuery.mockReset().mockImplementation(async (sql, values) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.includes('set_config')) {
        return { rows: [] };
      }
      return mockQuery(sql, values);
    });
    employeeService = new EmployeeService();
  });

  describe('create', () => {
    const mockEmployeeData = {
      organization_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      wallet_address: 'GABC123',
      position: 'Dev',
      department: 'IT',
      status: 'active' as const,
      base_salary: 0,
      base_currency: 'USDC',
    };

    it('should create an employee successfully', async () => {
      const mockCreatedEmployee = { id: 1, ...mockEmployeeData, created_at: new Date() };
      mockQuery.mockResolvedValueOnce({
        rows: [mockCreatedEmployee],
      });

      const result = await employeeService.create(mockEmployeeData);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO employees'),
        expect.arrayContaining(['John', 'Doe', 'john@example.com'])
      );
      expect(result).toEqual(mockCreatedEmployee);
      expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClientQuery).toHaveBeenNthCalledWith(2,
        "SELECT set_config('app.current_tenant_id', $1, true)", ['1']);
      expect(mockClientQuery).toHaveBeenLastCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalledTimes(1);
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('leaves a supplied bulk transaction with its caller', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ...mockEmployeeData }] });
      await employeeService.create(mockEmployeeData, mockClient as unknown as PoolClient);
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockClientQuery).toHaveBeenCalledTimes(1);
      expect(mockRelease).not.toHaveBeenCalled();
    });

    it('rolls back a failed write before releasing its client', async () => {
      const failure = new Error('insert failed');
      mockQuery.mockRejectedValueOnce(failure);
      await expect(employeeService.create(mockEmployeeData)).rejects.toBe(failure);
      expect(mockClientQuery).toHaveBeenLastCalledWith('ROLLBACK');
      expect(mockClientQuery).not.toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('discards the connection if rollback cannot be confirmed', async () => {
      const failure = new Error('insert failed');
      const rollbackFailure = new Error('connection lost');
      mockQuery.mockRejectedValueOnce(failure);
      mockClientQuery.mockImplementation(async (sql, values) => {
        if (sql === 'ROLLBACK') throw rollbackFailure;
        if (sql === 'BEGIN' || sql.includes('set_config')) return { rows: [] };
        return mockQuery(sql, values);
      });
      await expect(employeeService.create(mockEmployeeData)).rejects.toBe(failure);
      expect(mockRelease).toHaveBeenCalledTimes(1);
      expect(mockRelease).toHaveBeenCalledWith(rollbackFailure);
    });
  });

  describe('findAll', () => {
    it('should return paginated employees', async () => {
      const mockEmployees = [
        { id: 1, first_name: 'John', total_count: '2' },
        { id: 2, first_name: 'Jane', total_count: '2' },
      ];

      mockQuery.mockResolvedValueOnce({
        rows: mockEmployees,
      });

      const result = await employeeService.findAll(1, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *, count(*) OVER() as total_count'),
        expect.any(Array)
      );
    });

    it('should filter by department', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      await employeeService.findAll(1, { department: 'IT', page: 1, limit: 10 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('department = $'),
        expect.arrayContaining(['IT'])
      );
    });

    it('rejects a missing tenant before acquiring a database connection', async () => {
      await expect(employeeService.findAll(0, { page: 1, limit: 10 })).rejects.toThrow('positive organization ID');
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update employee successfully', async () => {
      const updateData = { first_name: 'Johnny' };
      const mockUpdatedEmployee = { id: 1, first_name: 'Johnny' };

      mockQuery.mockResolvedValueOnce({
        rows: [mockUpdatedEmployee],
      });

      const result = await employeeService.update(1, 1, updateData);

      expect(result).toEqual(mockUpdatedEmployee);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE employees'),
        expect.arrayContaining(['Johnny', 1])
      );
    });

    it('should return null if employee not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await employeeService.update(999, 1, { first_name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should soft delete employee', async () => {
      const mockDeletedEmployee = { id: 1, deleted_at: new Date() };
      mockQuery.mockResolvedValueOnce({
        rows: [mockDeletedEmployee],
        rowCount: 1,
      });

      const result = await employeeService.delete(1, 1);

      expect(result).toEqual(mockDeletedEmployee);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE employees\s+SET deleted_at = NOW()/),
        [1, 1]
      );
    });
  });
});
