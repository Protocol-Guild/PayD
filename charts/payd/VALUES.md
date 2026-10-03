# PayD Helm values

| File | Purpose |
|------|---------|
| `values.yaml` | Chart defaults |
| `values-staging.yaml` | Staging overrides — 1 replica floor, debug logs, Stellar TESTNET |
| `values-production.yaml` | Production overrides — higher replicas/resources, MAINNET |

## Install

Set the real ingress hosts and CORS origin for your domains. Keep credentials in private files outside this repository and pass their paths, not their values, to Helm:

```bash
# Staging
helm upgrade --install payd charts/payd -f charts/payd/values-staging.yaml \
  --set-file backend.secrets.DATABASE_URL=/secure/path/staging-database-url \
  --set-file backend.secrets.JWT_SECRET=/secure/path/staging-jwt-secret \
  --set-file backend.secrets.JWT_REFRESH_SECRET=/secure/path/staging-jwt-refresh-secret

# Production
helm upgrade --install payd charts/payd -f charts/payd/values-production.yaml \
  --set-file backend.secrets.DATABASE_URL=/secure/path/production-database-url \
  --set-file backend.secrets.JWT_SECRET=/secure/path/production-jwt-secret \
  --set-file backend.secrets.JWT_REFRESH_SECRET=/secure/path/production-jwt-refresh-secret
```

The chart renders `backend.secrets.*` into a Kubernetes Secret, and Helm stores release values. Restrict access to the release and Secret accordingly. Supply the other secret keys your deployment uses through the same private path or your cluster's secret-management process.

Use a separate `JWT_REFRESH_SECRET` for refresh-token signing. It is required whenever `backend.config.NODE_ENV` is `production`, including staging and the chart defaults. Helm stops with a configuration error when it is missing or empty, instead of leaving the backend to use its development fallback. Development and test configurations may omit it to retain the backend's local default; a supplied value is always passed through.

## Key knobs

| Path | Description |
|------|-------------|
| `backend.replicaCount` / `frontend.replicaCount` | Static replicas when HPA is off |
| `backend.resources` / `frontend.resources` | Requests and limits per environment |
| `backend.autoscaling.*` | HPA min/max and CPU/memory targets |
| `backend.config.NODE_ENV` | Must be `development`, `production`, or `test`; staging uses `production` runtime behavior |
| `backend.config.LOG_LEVEL` / `ENABLE_CACHING` / `CACHE_TTL` / `SDS_ENABLE` / `RATE_LIMIT_API_MAX` | Environment controls consumed by the backend |
| `ingress.*` | Replace placeholder hosts, TLS secret, and cert-manager issuer with deployment values |
| `stellar.*` | Network, Horizon, Soroban RPC |
| `backend.secrets.*` | Secret values rendered into the backend Kubernetes Secret |
| `backend.secrets.JWT_REFRESH_SECRET` | Refresh-token signing key; required for the production runtime and independent of `JWT_SECRET` |

Configure ordinary backend flags under `backend.config`; the chart also renders the named `backend.secrets` entries and Stellar endpoints into backend environment variables. The previously documented top-level `features.*` keys were not consumed by any template.
