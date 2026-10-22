# ADR 0003: Use Vite and React for Frontend Dashboard

## Context and Problem Statement
PayD's web interface enables employers to manage employees, schedule automated payroll runs, and connect non-custodial Stellar wallets. The frontend requires rapid local development, lightweight client bundling, and straightforward deployment.

## Decision Drivers
- Fast Hot Module Replacement (HMR) and fast build times.
- Native ESM support in development.
- Strong ecosystem support for Stellar wallet adapters (Freighter, xBull, Albedo).
- Zero complex server-side hydration bugs for purely client-side Web3 wallet interactions.

## Considered Options
1. **Vite + React (SPA)**
2. **Next.js (App Router / SSR)**
3. **Webpack + Create React App**

## Decision Outcome
Chosen option: **Vite + React (SPA)**.

### Rationale
- **Development Velocity**: Vite leverages esbuild for pre-bundling dependencies and native browser ESM, resulting in instantaneous server start times and sub-millisecond HMR.
- **Client-Side Wallet Compatibility**: Web3 wallet browser extensions interact with `window.freighter` and client DOM state. An SPA model avoids SSR hydration mismatches common in Next.js when reading browser-injected wallet providers.
- **Static Artifacts**: Builds compile into static HTML/CSS/JS artifacts deployable to any edge CDN or IPFS.

## Consequences
- Positive: Minimal build configuration and zero Node server requirement at edge runtime.
- Positive: Predictable wallet lifecycle handling without SSR polyfills.
- Negative: Search Engine Optimization (SEO) relies on client-side rendering or prerendering (acceptable for authenticated dashboard app).
