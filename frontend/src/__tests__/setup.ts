// Set NODE_ENV before anything else to use React 19 development builds
process.env.NODE_ENV = 'test';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock react-i18next — used by hooks that call useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
