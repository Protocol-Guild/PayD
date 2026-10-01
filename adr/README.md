# Architecture Decision Records (ADRs)

This directory documents key architectural decisions made in the PayD platform. Architecture Decision Records (ADRs) capture the context, alternatives considered, decision rationale, and downstream consequences of major technical choices.

## Index of Decisions

| ADR | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| [0001](0001-record-architecture-decisions.md) | Record Architecture Decisions | Accepted | 2026-10-01 |
| [0002](0002-soroban-smart-contracts.md) | Use Soroban for Decentralized Payroll Settlement | Accepted | 2026-10-01 |
| [0003](0003-vite-react-frontend.md) | Use Vite and React for Frontend Dashboard | Accepted | 2026-10-01 |
| [0004](0004-postgresql-relational-storage.md) | Use PostgreSQL for Off-Chain Indexing and Relational Persistence | Accepted | 2026-10-01 |
| [0005](0005-redis-caching-pubsub.md) | Use Redis for Real-Time Caching and Queue State | Accepted | 2026-10-01 |

## ADR Template Format

Each ADR follows the standard MADR (Markdown Architectural Decision Records) structure:

- **Context & Problem Statement**: What problem are we solving?
- **Decision Drivers**: What constraints or requirements influenced the choice?
- **Considered Options**: What alternatives were evaluated?
- **Decision Outcome**: What was chosen and why?
- **Pros & Cons of Options**: Trade-off analysis.
- **Consequences**: Downstream impacts and maintenance considerations.
