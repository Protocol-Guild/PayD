import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// React 19 CJS needs NODE_ENV=test so react-dom exports act
process.env.NODE_ENV = 'test';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer'],
      globals: { Buffer: true },
    }),
    wasm(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
  optimizeDeps: {
    exclude: ['@stellar/stellar-xdr-json'],
  },
  define: {
    global: 'window',
  },
});