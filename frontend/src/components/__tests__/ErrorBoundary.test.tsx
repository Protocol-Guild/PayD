import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Sentry is used by ErrorBoundary; mock it
vi.mock('@sentry/react', () => ({
  default: {
    captureException: vi.fn(),
  },
  captureException: vi.fn(),
}));

const GoodChild = () => <div>Good child</div>;

const BadChild = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary fallback={<div>Error page</div>}>
        <GoodChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Good child')).toBeInTheDocument();
    expect(screen.queryByText('Error page')).not.toBeInTheDocument();
  });

  it('renders fallback when child throws', () => {
    // Suppress the console.error that React logs for caught errors
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Error page</div>}>
        <BadChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Error page')).toBeInTheDocument();
    expect(screen.queryByText('Good child')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('calls Sentry.captureException on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sentry = await import('@sentry/react');

    render(
      <ErrorBoundary fallback={<div>Error page</div>}>
        <BadChild />
      </ErrorBoundary>,
    );

    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({
          componentStack: expect.any(String),
        }),
      }),
    );

    consoleSpy.mockRestore();
  });
});