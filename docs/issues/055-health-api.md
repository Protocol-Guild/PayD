# #055: Health Dashboard API

**Category:** [BACKEND]
**Difficulty:** ● EASY
**Tags:** `health-check`, `devops`, `monitoring`

## Description

Implement a dedicated health check endpoint that reports the status of the API and its downstream dependencies (PostgreSQL, Redis, Stellar Horizon). Include version info and uptime.

## Acceptance Criteria

- [ ] `/health` endpoint returns JSON status report.
- [ ] Verifies database and cache connectivity.
- [ ] Includes build timestamp and environment info.
