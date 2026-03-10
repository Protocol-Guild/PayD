import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('Admin Dashboard visual baseline', async ({ page }) => {
    // Inject mock wallet to bypass login walls
    await page.addInitScript(() => {
      (window as any).freighter = {
        isConnected: async () => true,
        getPublicKey: async () => 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      };
    });

    // Go directly to the Admin Panel
    await page.goto('/admin-panel');
    
    // Wait for the page to fully load its DOM
    await page.waitForLoadState('networkidle');

    // Take a full-page screenshot and compare it against the baseline
    await expect(page).toHaveScreenshot('admin-dashboard-baseline.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05, // Allow 5% variance for minor rendering differences
    });
  });
});