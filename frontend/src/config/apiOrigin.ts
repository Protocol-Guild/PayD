export interface ApiEnvironment {
  readonly VITE_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BACKEND_URL?: string;
}

/** Resolve one origin before consumers add their actual backend route prefix. */
export function resolveApiOrigin(
  environment: ApiEnvironment,
  options: { requireConfigured?: boolean } = {}
): string {
  const configured = [
    environment.VITE_API_URL,
    environment.VITE_API_BASE_URL,
    environment.VITE_BACKEND_URL,
  ].find((value) => value?.trim());

  if (!configured) {
    if (options.requireConfigured) {
      throw new Error(
        'Set VITE_API_URL to the public backend origin before building the frontend.'
      );
    }
    return '';
  }

  const value = configured.trim().replace(/\/+$/, '');
  // An explicit root or legacy API prefix selects a same-origin deployment.
  if (value === '' || value === '/api' || value === '/api/v1') return '';

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('VITE_API_URL must be an HTTP(S) backend origin or a same-origin API prefix.');
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['/', '/api', '/api/v1'].includes(url.pathname)
  ) {
    throw new Error(
      'VITE_API_URL must contain only the backend origin (legacy /api or /api/v1 is accepted).'
    );
  }

  return url.origin;
}
