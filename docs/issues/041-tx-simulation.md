# #041: Transaction Simulation for Validation

**Category:** [CONTRACT]
**Difficulty:** ● MEDIUM
**Tags:** `simulation`, `validation`, `pre-flight`

## Description

Implement a pre-submission simulation step for all payroll transactions. Use Horizon's simulation endpoint to catch errors (insufficient funds, invalid sequence) before broadcasting to the network.

## Acceptance Criteria

- [ ] Every transaction simulated before submission.
- [ ] User receives clear error messages from simulation failures.
- [ ] Prevents wasted fees on failed on-chain transactions.
