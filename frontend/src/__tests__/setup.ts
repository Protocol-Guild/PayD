// Set NODE_ENV before anything else to use React 19 development builds
process.env.NODE_ENV = 'test';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import React from 'react';

afterEach(() => {
  cleanup();
});

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) =>
    React.createElement('a', { href: to, ...props }, children),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const makeIcon = (testId: string) =>
    function Icon() {
      return React.createElement('svg', { 'data-testid': testId });
    };
  return {
    Upload: makeIcon('upload-icon'),
    AlertCircle: makeIcon('alert-circle-icon'),
    CheckCircle: makeIcon('check-circle-icon'),
    Pencil: makeIcon('pencil-icon'),
    Trash2: makeIcon('trash-icon'),
  };
});

// Mock @sentry/react — each test file can override if needed
// (kept here so ErrorBoundary.test.tsx can override cleanly)