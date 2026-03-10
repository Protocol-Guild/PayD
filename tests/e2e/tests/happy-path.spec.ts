import { test, expect } from '@playwright/test';

// Setup mock data
const MOCK_PUBLIC_KEY = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
const MOCK_SIGNED_XDR = 'AAAAAgAAAAB...'; // Simulated signed transaction

test.describe('Full Payroll Cycle Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock the Freighter/Albedo wallet extension globally before the page loads
    await page.addInitScript(() => {
      (window as any).freighter = {
        isConnected: async () => true,
        getPublicKey: async () => 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        signTransaction: async () => 'AAAAAgAAAAB...',
      };
    });
    
    // Start at the homepage/login
    await page.goto('/');
  });

  test('Org Onboarding, Employee Import, and Bulk Disbursement', async ({ page }) => {
    // 1. Organization Onboarding (Mocked Wallet Login)
    // Assuming you have a "Connect Wallet" button on the frontend
    await page.getByRole('button', { name: /Connect Wallet|Login/i }).click();
    
    // Verify we reached the dashboard
    await expect(page.getByText('Admin Panel')).toBeVisible({ timeout: 10000 });

    // 2. Employee Import (Navigating to Employee Portal/Import)
    await page.goto('/employee-entry');
    // Simulate filling out a basic employee entry
    await page.getByPlaceholder(/Wallet Address/i).first().fill('GBXYZ12345...');
    await page.getByPlaceholder(/Amount/i).first().fill('1500');
    await page.getByRole('button', { name: /Save|Add/i }).click();

    // 3. Bulk Disbursement
    await page.goto('/payroll-scheduler');
    await page.getByRole('button', { name: /Execute|Run Payroll/i }).click();

    // Verify wallet signing prompt was "called" and success message appears
    await expect(page.getByText(/Transaction Successful|Payroll Executed/i)).toBeVisible({ timeout: 15000 });

    // 4. Balance Verification (Checking Transaction History)
    await page.goto('/transaction-history');
    await expect(page.getByText('1500')).toBeVisible();
    await expect(page.getByText(/Completed|Success/i).first()).toBeVisible();
  });
});