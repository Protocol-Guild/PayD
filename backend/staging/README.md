# Staging database and API

Copy `backend/.env.staging.example` to `backend/.env.staging` and set independent
database-owner, application, JWT, and JWT-refresh secrets. The application and
owner database usernames must differ. Every Compose command uses the same file:

```sh
docker compose --env-file backend/.env.staging -f docker-compose.staging.yml up --build
```

The API is available on port 3101, PostgreSQL on 5433, and Redis on 6380. These
services have their own named volumes and network. Stellar endpoints default to
testnet; staging does not inherit a production `.env` file.

## Startup and repeated runs

PostgreSQL becomes healthy only when its normal TCP listener is available. The
`migrate` service then applies **every** SQL migration in filename order through
the same migration core as `npm run db:migrate`. It records each file's checksum
and SQL changes in one transaction, serializes simultaneous migration runs with an
advisory lock, and rejects changed applied files before executing pending SQL.
Migration SQL is included in both the migration image and the production image.

After migration, one transaction loads `src/db/seed.sql`, records its `seed-v1`
marker in the database, and provisions the application role. A repeated bootstrap
skips recorded migrations and the seed, so it does not create another organization
or duplicate tax rules. New migrations remain runnable against a retained volume.

The API waits for `migrate` to exit successfully and Redis to become healthy.
A migration or seed error exits nonzero and prevents API startup. Inspect or rerun
the database step independently:

```sh
docker compose --env-file backend/.env.staging -f docker-compose.staging.yml logs migrate
docker compose --env-file backend/.env.staging -f docker-compose.staging.yml up --build migrate
docker compose --env-file backend/.env.staging -f docker-compose.staging.yml run --rm migrate
```

## Effective application permissions

Only PostgreSQL and `migrate` receive `STAGING_DB_ADMIN_PASSWORD`. The API receives
the separate `STAGING_DB_USER`/`STAGING_DB_PASSWORD` pair; its entrypoint constructs
the connection URL with URL escaping, including passwords containing `@`, `:` or
`/`. It does not inherit the entire shared environment file.

The application role has no superuser, database creation, role creation,
replication, RLS-bypass, or table-ownership privileges. It receives DML access and
sequence usage, while migration and seed ledgers remain owner-only. Existing
privileged roles are rejected rather than silently repurposed. PostgreSQL 15
views use `security_invoker` so the application cannot bypass table RLS through
an owner-created view.

The existing tenant policies use `app.current_tenant_id`. An application
connection with no tenant set sees no employee or transaction rows; a transaction
can select its tenant with `SELECT set_config('app.current_tenant_id', '1', true)`.
These permissions exercise the application's existing tenant-context and auth
implementation. Environment flags alone do not grant tenant access.

## Volumes created by the previous partial staging stack

The old stack applied only migrations 001, 003, and 009 through PostgreSQL init
files and did not record a migration ledger. Do not delete such a volume or mark
all migrations applied. The new runner stops with a clear error when it finds
application tables without a ledger, preserving all existing data.

Keep the old database-owner credentials when accessing that volume. Back it up
and reconcile its actually applied migration filenames/checksums before using
the canonical migration chain. For an independent fresh staging database, choose
a new Compose project name with `-p`; the original project's volume is retained.
Changing `POSTGRES_USER` or its password in an env file does not modify roles in
an already initialized PostgreSQL data directory.

The added `015a` migration composes the two existing `contract_events` layouts
before 016 creates its indexes. Both event producers retain their own identifier
columns and uniqueness keys; existing event rows are retained, and unknown tenant
metadata is not assigned to a guessed organization.
