import { z } from 'zod';

export const employeeFormSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  walletAddress: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^G[A-Z2-7]{55}$/.test(val),
      'Wallet address must be a valid Stellar public key (G...55 chars)'
    ),
  role: z.enum(['contractor', 'full-time', 'part-time'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
  currency: z.enum(['USDC', 'XLM', 'EURC'], {
    errorMap: () => ({ message: 'Please select a valid currency' }),
  }),
});

export type EmployeeFormData = z.infer<typeof employeeFormSchema>;

export const payrollFormSchema = z.object({
  employeeName: z
    .string()
    .min(1, 'Employee name is required')
    .min(2, 'Employee name must be at least 2 characters'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      'Amount must be a positive number'
    ),
  frequency: z.enum(['weekly', 'monthly'], {
    errorMap: () => ({ message: 'Please select a frequency' }),
  }),
  startDate: z
    .string()
    .min(1, 'Start date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Please enter a valid date'
    ),
  memo: z.string().optional(),
});

export type PayrollFormData = z.infer<typeof payrollFormSchema>;