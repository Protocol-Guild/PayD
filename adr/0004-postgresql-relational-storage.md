# ADR 0004: Use PostgreSQL for Off-Chain Indexing and Relational Persistence

## Context and Problem Statement
While payment execution and settlement guarantees reside on the Stellar blockchain, the PayD backend must manage relational tenant hierarchies, employee profiles, department allocations, recurring schedules, and indexed historical payroll runs for fast reporting and compliance audits.

## Decision Drivers
- Strict ACID compliance for employee payment tracking and ledger reconciliation.
- Powerful JSONB querying for dynamic metadata alongside relational constraints.
- Mature migration tooling and wide hosting availability across cloud platforms.

## Considered Options
1. **PostgreSQL**
2. **MongoDB / Document Store**
3. **SQLite**

## Decision Outcome
Chosen option: **PostgreSQL**.

### Rationale
- **Relational Integrity**: Foreign key constraints enforce strict tenant-to-employee relationships, preventing orphaned payroll allocations.
- **Transactional Consistency**: Multi-row balance updates and scheduler execution locks rely on native PostgreSQL transactional isolation (`SERIALIZABLE` / `FOR UPDATE SKIP LOCKED`).
- **Audit Logging**: Robust support for temporal tables, audit triggers, and indexed ledger event caches.

## Consequences
- Positive: Guaranteed financial record consistency and relational correctness.
- Positive: Rich querying capabilities for multi-tenant analytics and tax compliance exports.
- Negative: Requires database migration management (e.g. via Diesel / SQLx) during schema evolutions.
