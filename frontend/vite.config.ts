import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite';
import { resolveApiOrigin } from './src/config/apiOrigin';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, process.cwd(), ['PUBLIC_', 'VITE_']);
  resolveApiOrigin(environment, { requireConfigured: command === 'build' });
  const networkAliases = Object.fromEntries(
    [
      ['PUBLIC_STELLAR_NETWORK', 'VITE_STELLAR_NETWORK'],
      ['PUBLIC_STELLAR_HORIZON_URL', 'VITE_STELLAR_HORIZON_URL'],
      ['PUBLIC_STELLAR_RPC_URL', 'VITE_STELLAR_RPC_URL'],
    ]
      .filter(
        ([publicKey, legacyKey]) =>
          !environment[publicKey]?.trim() && environment[legacyKey]?.trim()
      )
      .map(([publicKey, legacyKey]) => [
        `import.meta.env.${publicKey}`,
        JSON.stringify(environment[legacyKey]),
      ])
  );

  return {
    plugins: [
      react(),
      tailwindcss(),
      nodePolyfills({
        include: ['buffer'],
        globals: {
          Buffer: true,
        },
      }),
      wasm(),
    ],
    build: {
      target: 'esnext',
    },
    optimizeDeps: {
      exclude: ['@stellar/stellar-xdr-json'],
    },
    define: {
      ...networkAliases,
      global: 'window',
    },
    envPrefix: ['PUBLIC_', 'VITE_'],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '^/auth(?:/|$)': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/webhooks': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
        },
        '/friendbot': {
          target: 'http://localhost:8000/friendbot',
          changeOrigin: true,
        },
      },
    },
  };
});
