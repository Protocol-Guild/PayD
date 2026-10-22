# ADR 0005: Use Redis for Real-Time Caching and Queue State

## Context and Problem Statement
PayD processes periodic payroll jobs, manages rate-limiting across external Horizon / Soroban RPC nodes, and broadcasts real-time transaction confirmation events to active frontend dashboard sessions.

## Decision Drivers
- Sub-millisecond in-memory data access.
- Native pub/sub and stream abstractions for event broadcasting.
- Atomic distributed primitives (locks, counters) for cluster scheduler leader election.

## Considered Options
1. **Redis**
2. **PostgreSQL LISTEN/NOTIFY**
3. **Apache Kafka**

## Decision Outcome
Chosen option: **Redis**.

### Rationale
- **Distributed Locking**: Redlock and atomic `SET NX EX` ensure that background payroll runners do not double-submit batch transactions across concurrent container instances.
- **RPC Cache Layer**: Caches Horizon account sequence numbers, asset exchange rates, and fee stats, shielding external RPC endpoints from excessive rate limits.
- **Lightweight Footprint**: Significantly lower operational complexity than Kafka while providing higher throughput than PostgreSQL notify channels.

## Consequences
- Positive: Prevents double-spending and duplicate payroll job executions in scaled deployments.
- Positive: Reduces RPC latency and offloads read pressure from primary PostgreSQL database.
- Negative: Requires cache invalidation strategies and monitoring memory utilization under high event throughput.
