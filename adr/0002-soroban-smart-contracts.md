# ADR 0002: Use Soroban for Decentralized Payroll Settlement

## Context and Problem Statement
PayD requires an immutable, verifiable, and low-cost smart contract execution environment to execute automated payroll disbursements, stream payouts, and handle multi-token escrow.

## Decision Drivers
- Sub-second transaction finality and predictable micro-cent fees.
- First-class Stellar ecosystem asset interoperability (USDC, EURC, XLM).
- Strong type safety and security guarantees against reentrancy.
- WebAssembly (WASM) execution environment.

## Considered Options
1. **Soroban (Stellar Smart Contracts)**
2. **EVM (Ethereum / Arbitrum / Polygon)**
3. **Solana SVM**

## Decision Outcome
Chosen option: **Soroban (Stellar Smart Contracts)**.

### Rationale
- **Deterministic Fees**: Soroban's resource fee model prevents unexpected gas spikes during payroll batches.
- **Built-in Stellar Assets**: Direct integration with Stellar Classic assets without bridging or synthetic token wrapping.
- **Rust Toolchain**: Rust's memory safety prevents memory corruptions, while Soroban's call-stack architecture mitigates common EVM reentrancy vulnerabilities.

## Consequences
- Positive: Multi-currency payroll batches execute with negligible fee overhead.
- Positive: Safe state management through Soroban TTL-based ledger storage.
- Negative: Requires Soroban SDK version alignment and contract instance TTL monitoring.
