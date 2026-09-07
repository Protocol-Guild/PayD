import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Use vi.hoisted to define the mock before vi.mock is hoisted
const mockCaptureException = vi.hoisted(() => vi.fn());

vi.mock('@sentry/react', () => ({
  captureException: mockCaptureException,
}));

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <div>Content renders fine</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Content renders fine')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('renders fallback when a child throws during render', () => {
    const orig = console.error;
    console.error = vi.fn();

    const Boom = () => {
      throw new Error('Boom!');
    };

    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    console.error = orig;
  });

  it('reports the error to Sentry with component stack', () => {
    const orig = console.error;
    console.error = vi.fn();

    const Boom = () => {
      throw new Error('Sentry-worthy boom');
    };

    render(
      <ErrorBoundary fallback={<div>Fallback UI</div>}>
        <Boom />
      </ErrorBoundary>
    );

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({
          componentStack: expect.any(String),
        }),
      })
    );
    console.error = orig;
  });
});