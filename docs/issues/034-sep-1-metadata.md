# #034: Asset Metadata SEP-0001 Implementation

**Category:** [CONTRACT]
**Difficulty:** ● EASY
**Tags:** `SEP-1`, `stellar-toml`, `metadata`

## Description

Implement the SEP-0001 standard for the ORGUSD asset by hosting a `stellar.toml` file. Include asset information, issuer documentation, and contact details to ensure visibility in wallets and explorers.

## Acceptance Criteria

- [ ] `stellar.toml` file created with required SEP-1 fields.
- [ ] File hosted at `.well-known/stellar.toml` with CORS enabled.
- [ ] Validated via Stellar Expert or TOML checker.
