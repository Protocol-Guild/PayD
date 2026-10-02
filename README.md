# PayD - Backend API & Database Scaling

PayD is a decentralized payment protocol built on Ethereum-compatible blockchains. This repository contains the backend infrastructure for handling payments, rate limiting, auditing, and multi-tenant isolation.

## Overview

This repository implements:
- RESTful API with rate limiting and authentication
- Database layer with multi-tenant isolation
- Audit logging system for all operations
- Rate limiting middleware with Redis backend
- Tenant-aware data access patterns

## Architecture

The backend follows a layered architecture:
1. **API Layer** - HTTP handlers with validation and authentication
2. **Service Layer** - Business logic with transaction management
3. **Repository Layer** - Data access with tenant isolation
4. **Audit Layer** - Comprehensive logging of all operations

## Key Components

- **Rate Limiting**: Token bucket algorithm with Redis backend
- **Auditing**: Structured audit logs for all sensitive operations
- **Multi-tenant**: Tenant-scoped queries and data isolation
- **Security**: JWT authentication with refresh tokens

## Getting Started

1. Install dependencies: `npm install`
2. Configure environment variables (.env)
3. Run migrations: `npm run migrate`
4. Start development server: `npm run dev`

## Testing

Run tests: `npm test`
Run audit tests: `npm run test:audit`
Run rate limit tests: `npm run test:ratelimit`

## License

MIT
