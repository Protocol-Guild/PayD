# #054: API Rate Limiting

**Category:** [BACKEND]
**Difficulty:** ● EASY
**Tags:** `rate-limiting`, `security`, `redis`

## Description

Protect the API from abuse by implementing rate limiting per IP or per API key using Redis. Apply different limits for authentication routes versus data retrieval routes.

## Acceptance Criteria

- [ ] Redis-backed rate limiter integrated.
- [ ] `429 Too Many Requests` status returned when limits exceeded.
- [ ] Rate limit headers included in API responses.
