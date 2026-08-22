import React from 'react';

type ErrorBoundaryFallbackArgs = {
  onReset: () => void;
};

type ErrorBoundaryProps = {
  fallback: React.ReactNode | ((args: ErrorBoundaryFallbackArgs) => React.ReactNode);
  children: React.ReactNode;
  /** Called after the boundary has been reset internally. */
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    // Attempt to lazily import Sentry only when an error boundary is needed.
    try {
      // dynamic import ensures Sentry is not eagerly loaded
      import('@sentry/react').then((Sentry) => {
        Sentry.captureException(error, {
          extra: { componentStack: errorInfo.componentStack },
        });
      });
    } catch {
      // Sentry unavailable — silently skip
    }
  }

  /** Reset the boundary so children are re-rendered. */
  resetErrorBoundary = () => {
    this.setState({ hasError: false }, () => {
      this.props.onReset?.();
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback({ onReset: this.resetErrorBoundary });
      }
      return fallback;
    }

    return this.props.children;
  }
}