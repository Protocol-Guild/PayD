# #032: Clawback Support for ORGUSD

**Category:** [CONTRACT]
**Difficulty:** ● MEDIUM
**Tags:** `clawback`, `compliance`, `asset-flags`

## Description

Enable clawback support for the ORGUSD asset. Implement the logic to enable/disable clawbacks at the account level and the service layer to execute clawback operations for regulatory or error-correction purposes.

## Acceptance Criteria

- [ ] ORGUSD asset issued with `auth_clawback_enabled` flag.
- [ ] Service module implements `clawback` operation.
- [ ] Audit trail captures all clawback events.
- [ ] Integration tests verify asset recovery from target wallets.
