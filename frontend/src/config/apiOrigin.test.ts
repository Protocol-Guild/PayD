import { describe, expect, it } from 'vitest';
import { resolveApiOrigin } from './apiOrigin';

describe('backend origin configuration', () => {
  it.each(['', '/', '/api', '/api/', '/api/v1', '/api/v1/'])(
    'normalizes an origin with legacy suffix %s',
    (suffix) => {
      expect(resolveApiOrigin({ VITE_API_URL: `https://api.example.test${suffix}` })).toBe(
        'https://api.example.test'
      );
    }
  );

  it('uses the canonical variable before compatibility aliases', () => {
    expect(
      resolveApiOrigin({
        VITE_API_URL: ' https://api.example.test/api/v1/ ',
        VITE_API_BASE_URL: 'https://old.example.test/api',
        VITE_BACKEND_URL: 'https://older.example.test',
      })
    ).toBe('https://api.example.test');
  });

  it.each(['VITE_API_BASE_URL', 'VITE_BACKEND_URL'] as const)(
    'supports %s when the canonical value is empty',
    (name) => {
      expect(resolveApiOrigin({ VITE_API_URL: ' ', [name]: 'https://api.example.test/api/' })).toBe(
        'https://api.example.test'
      );
    }
  );

  it.each(['/', '/api', '/api/v1/'])('allows an explicit same-origin prefix %s', (value) => {
    expect(resolveApiOrigin({ VITE_API_URL: value }, { requireConfigured: true })).toBe('');
  });

  it('uses the development proxy when no origin is configured', () => {
    expect(resolveApiOrigin({})).toBe('');
  });

  it('requires an explicit origin or same-origin choice for a production build', () => {
    expect(() => resolveApiOrigin({}, { requireConfigured: true })).toThrow(/Set VITE_API_URL/);
  });

  it.each([
    'javascript:alert(1)',
    'ftp://api.example.test',
    'https://name:password@api.example.test',
    'https://api.example.test/api?token=value',
    'https://api.example.test/#fragment',
    'https://api.example.test/payroll',
    '//api.example.test',
    'not a URL',
  ])('rejects an ambiguous or non-HTTP backend value: %s', (value) => {
    expect(() => resolveApiOrigin({ VITE_API_URL: value })).toThrow(/VITE_API_URL/);
  });
});
