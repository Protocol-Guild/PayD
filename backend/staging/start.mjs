// Construct a correctly escaped URL before any application module reads env.
// Only the API role is passed into this container; migration credentials stay
// in the postgres/bootstrap services.
try {
  for (const name of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!process.env[name]) throw new Error(`${name} must be set`);
  }
  const url = new URL('postgresql://localhost');
  url.hostname = process.env.DB_HOST;
  url.port = process.env.DB_PORT || '5432';
  url.username = encodeURIComponent(process.env.DB_USER);
  url.password = encodeURIComponent(process.env.DB_PASSWORD);
  url.pathname = `/${encodeURIComponent(process.env.DB_NAME)}`;
  process.env.DATABASE_URL = url.toString();
  await import('../dist/index.js');
} catch (error) {
  console.error('[staging]', error);
  process.exitCode = 1;
}
