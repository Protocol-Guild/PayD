// Global type augmentation for the jest-dom matchers registered in
// vitest.setup.ts (e.g. toBeInTheDocument, toHaveAttribute). Kept under
// src/ so it's picked up by tsconfig.app.json's `include`.
import '@testing-library/jest-dom/vitest';
