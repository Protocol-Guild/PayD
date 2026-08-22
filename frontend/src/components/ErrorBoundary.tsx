import React from 'react';
import * as Sentry from '@sentry/react';

type ErrorBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
  /** Callback invoked after the boundary resets (e.g. when the user clicks "Try Again"). */
  onReset?: () => void;
  /**
   * When any of these values change between renders, the boundary is reset
   * (and `onReset` is fired). Useful for keying the boundary to the current
   * route so navigation away from a crashed route recovers automatically.
   */
  resetKeys?: ReadonlyArray<unknown>;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Error boundary that isolates render errors to the subtree it wraps. It
 * renders `fallback` when a child throws, optionally injecting an `onReset`
 * prop into the fallback so "Try Again" buttons can clear the error state.
 *
 * When `resetKeys` change between renders, the boundary recovers
 * automatically (useful for route-based reset).
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, onReset } = this.props;

    // Auto-reset when resetKeys change (e.g. route navigation).
    if (this.state.hasError && resetKeys && resetKeys.length > 0) {
      const prevKeys = prevProps.resetKeys;
      if (
        !prevKeys ||
        prevKeys.length !== resetKeys.length ||
        resetKeys.some((key, index) => !Object.is(key, prevKeys[index]))
      ) {
        this.setState({ hasError: false });
        onReset?.();
      }
    }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    // Log to Sentry when configured, and always surface the component stack
    // in the console for dev-mode debugging.
    console.error('Uncaught error caught by ErrorBoundary', error, errorInfo);
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      // If the fallback accepts an onReset handler, wire it up so the
      // "Try Again" button actually clears the error state.
      if (React.isValidElement(fallback)) {
        const fallbackProps = fallback.props as { onReset?: unknown };
        if (typeof fallbackProps.onReset === 'undefined') {
          return React.cloneElement(
            fallback as React.ReactElement<{ onReset?: () => void }>,
            { onReset: this.handleReset },
          );
        }
      }
      return fallback;
    }

    return this.props.children;
  }
}