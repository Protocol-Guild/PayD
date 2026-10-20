import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts: the app's Vite config pulls in wasm/node-polyfill
// plugins meant for the browser build, which aren't needed (and add overhead) for
// the unit test run. Keep the test environment minimal and fast.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
