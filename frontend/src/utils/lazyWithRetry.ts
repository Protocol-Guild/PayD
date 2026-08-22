import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type ModuleFactory<T> = () => Promise<{ default: ComponentType<T> }>;

/**
 * React.lazy wrapper that keeps a cache of the load promise so a momentary
 * chunk-load failure can be retried on a later render (e.g. after an
 * ErrorBoundary reset) instead of permanently poisoning the lazy component.
 *
 * When the underlying `import()` rejects, the cached promise is cleared and the
 * error re-thrown so the nearest ErrorBoundary can render its fallback with a
 * working retry action.
 */
export function lazyWithRetry<T = Record<string, never>>(
  factory: ModuleFactory<T>,
  name?: string,
): LazyExoticComponent<ComponentType<T>> {
  let cached: Promise<{ default: ComponentType<T> }> | undefined;

  const load = (): Promise<{ default: ComponentType<T> }> => {
    if (!cached) {
      cached = factory().catch((error: unknown) => {
        // Clear the cache so a later reset/remount can attempt the load again.
        cached = undefined;
        console.error(
          `Failed to lazily load chunk${name ? ` for ${name}` : ''}:`,
          error,
        );
        throw error;
      });
    }
    return cached;
  };

  return lazy(load);
}