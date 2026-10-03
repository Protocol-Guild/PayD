# Frontend API and deployment configuration

The frontend is a static Vite build. Configure its public backend endpoint and
Stellar network **when building the browser assets**. The Helm chart's
`frontend.config` entries become pod environment variables; changing those
variables does not change an already-built JavaScript bundle. Build and select
an image for each environment through `frontend.image.repository` and
`frontend.image.tag`.

## Public build inputs

| Variable                     | Meaning                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`               | Public backend origin, such as `https://api.staging.example.com`. Required for a production build. |
| `PUBLIC_STELLAR_NETWORK`     | Network name used by the wallet and Stellar helpers, such as `TESTNET`.                            |
| `PUBLIC_STELLAR_HORIZON_URL` | Public Horizon endpoint for that network.                                                          |
| `PUBLIC_STELLAR_RPC_URL`     | Public Soroban RPC endpoint for that network.                                                      |

Vite exposes both existing `PUBLIC_` inputs and `VITE_` inputs. These values are
included in browser code; backend secrets do not belong in either prefix.

`VITE_API_BASE_URL` and `VITE_BACKEND_URL` remain compatibility aliases, in that
order after `VITE_API_URL`. Empty values do not hide a configured alias. A legacy
value ending in `/api` or `/api/v1` resolves to the same origin, so individual
clients cannot duplicate or drop a route prefix. Credentials, query strings,
fragments, other paths and non-HTTP schemes are rejected.

Existing `VITE_STELLAR_NETWORK`, `VITE_STELLAR_HORIZON_URL` and
`VITE_STELLAR_RPC_URL` build inputs also populate the corresponding `PUBLIC_`
value when it is absent. An explicit `PUBLIC_` value takes precedence. Supply
network and endpoint values together; changing only a pod variable is not a
network switch. The network passphrase is selected by the existing application
logic, not by an additional deployment override.

## Local development

Run commands from `frontend/`:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The example targets backend port 3001. Set `VITE_API_URL` to the backend's actual
listening address if its configured `PORT` differs. Without an API variable,
development uses relative URLs and Vite proxies `/api`, `/auth`, `/webhooks`
and `/socket.io` to `http://localhost:3001`; Socket.IO upgrades are enabled.
The browser origin must be allowed by the backend's CORS configuration when
calling a separate API origin.

## Build a staging image

Replace the example API host with the real public backend host. An internal
cluster address such as `http://payd-backend:3001` is not the browser endpoint.
From `frontend/`:

```sh
docker build \
  --build-arg VITE_API_URL=https://api.staging.example.com \
  --build-arg PUBLIC_STELLAR_NETWORK=TESTNET \
  --build-arg PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org \
  --build-arg PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
  -t payd-frontend:staging .
```

The builder uses the committed dependency lock, type-checks the application,
and builds its static assets. The runtime serves `dist/` with Nginx on port 80,
matching the chart's frontend service; client-side navigation falls back to
`index.html`. The image recipe requires explicit network endpoints. API input
validation runs before bundling. Build-time `.env` files are excluded from the
Docker context so these arguments are the image's configuration path.

For another environment, build a distinct image with that environment's public
API host and matching network endpoints, then select that image in the existing
chart values. Publishing an image and deploying the chart are separate steps.
For a native build with the same configuration, set the four variables in the
shell and run `npm run build`.

A deliberate same-origin deployment can set `VITE_API_URL=/` (legacy `/api` and
`/api/v1` also work). Its ingress or reverse proxy must route backend API, OAuth,
webhook and Socket.IO paths to the backend. The static Nginx image does not
proxy those paths, and the chart's separate backend/frontend hosts require an
explicit public API origin instead.

## Route composition

The shared `src/config/api.ts` derives three values from that one origin:

| Export                        | Backend routes used by clients                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `API_ORIGIN`                  | `/auth`, `/webhooks`, Socket.IO's `/socket.io` transport                                                |
| `API_BASE_URL` (`/api`)       | Schedules, contract registry, contract events, certificates, cash flow, payments, 2FA, legacy employees |
| `API_V1_BASE_URL` (`/api/v1`) | Audit, benefits, forecast, taxes, employees, contract upgrades, payroll                                 |

The contracts registry and upgrade controllers use different mounts. Schedules
are under `/api/schedules`; audit is under `/api/v1/audit`. A configured API host
also applies to admin, OAuth and scheduler webhook calls that previously used
relative or hardcoded addresses.

Four pre-existing client contracts still have no matching backend mount at this
branch: `/api/v1/claims`, `/api/v1/bulk-payments`, `/api/withdrawal`, and
`POST /api/v1/payments/pathfind`. Their configured host is now consistent, but
this configuration repair does not add those handlers or replace them with
different request/response contracts.

## Verify configuration and client requests

```sh
npx vitest run src/config/apiOrigin.test.ts src/config/apiClients.test.ts --maxWorkers=1
```

The client regression uses actual Axios and Fetch calls against a local HTTP
fixture server, covering an origin and both legacy API suffixes. It verifies
schedules, audit, forecast, benefits, contract registry/events/upgrades, 2FA and
root webhooks, including preservation of bearer headers. It does not execute
database, payment, signing or live authentication handlers.

See the chart's [values reference](../charts/payd/VALUES.md) for image selection,
ingress, backend runtime settings and installation details, and
[Vite's environment documentation](https://vite.dev/guide/env-and-mode) for the
build-time behavior of public variables.
