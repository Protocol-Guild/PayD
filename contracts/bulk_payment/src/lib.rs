#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, contractevent,
    Address, Env, Vec, token, symbol_short, Symbol,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    Unauthorized       = 3,
    EmptyBatch         = 4,
    BatchTooLarge      = 5,
    InvalidAmount      = 6,
    AmountOverflow     = 7,
    SequenceMismatch   = 8,
    BatchNotFound      = 9,
    EntryArchived      = 10,
}

// ── Events ────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct BonusPaymentEvent {
    pub batch_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
}

#[contractevent]
pub struct PaymentSentEvent {
    pub recipient: Address,
    pub amount: i128,
}

#[contractevent]
pub struct PaymentSkippedEvent {
    pub recipient: Address,
    pub amount: i128,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentOp {
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchRecord {
    pub sender: Address,
    pub token: Address,
    pub total_sent: i128,
    pub success_count: u32,
    pub fail_count: u32,
    pub status: Symbol,
}

#[contracttype]
pub enum DataKey {
    Admin,
    BatchCount,
    Batch(u64),
    Sequence,
    TotalBonusesPaid,
}

const MAX_BATCH_SIZE: u32 = 100;
const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const TEMPORARY_TTL_THRESHOLD: u32 = 2_000;
const TEMPORARY_TTL_EXTEND_TO: u32 = 20_000;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct BulkPaymentContract;

#[contractimpl]
impl BulkPaymentContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        let storage = env.storage().instance();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::BatchCount, &0u64);
        storage.set(&DataKey::Sequence, &0u64);
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::BatchCount, &0u64);
        env.storage().persistent().set(&DataKey::Sequence, &0u64);
        Self::bump_core_ttl(&env);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// Extends TTL for critical contract state to reduce archival risk.
    pub fn bump_ttl(env: Env) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// Gas-optimized all-or-nothing batch payment.
    ///
    /// Optimizations vs. the original implementation:
    /// 1. **Direct sender→recipient transfers** — eliminates the intermediate
    ///    contract hop (sender→contract→recipient), cutting token transfer
    ///    cross-contract calls from 2N+1 down to N for N payments.
    /// 2. **Single-pass validation** — amounts are validated in the same
    ///    iteration that performs transfers, avoiding a second loop.
    /// 3. **Cached storage accessor** — `env.storage().instance()` is obtained
    ///    once and reused for batch record + batch count writes.
    /// 4. **Batch records in persistent storage** — moves per-batch data out
    ///    of instance storage (which is loaded on every invocation) into
    ///    persistent storage, reducing base invocation cost.
    pub fn execute_batch(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        if len == 0 {
            return Err(ContractError::EmptyBatch);
        }
        if len > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }

        // Create the token client once, outside the loop.
        let token_client = token::Client::new(&env, &token);

        // Single-pass: validate amounts, accumulate total, and transfer
        // directly from sender to each recipient. This avoids:
        //   • A second iteration over the payments vector
        //   • The intermediate contract-address hop (sender→contract→recipient)
        //     which previously required N+1 transfer calls (1 bulk pull + N pushes).
        //     Now it is exactly N calls.
        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
            // Transfer directly: sender → recipient (sender auth already checked)
            token_client.transfer(&sender, &op.recipient, &op.amount);
        }

        // Write batch record to persistent storage (cheaper than instance for
        // historical data that does not need to be loaded on every invocation).
        let batch_id = Self::next_batch_id(&env);
        env.storage().persistent().set(&DataKey::Batch(batch_id), &BatchRecord {
        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender,
            token,
            total_sent: total,
            success_count: len,
            fail_count: 0,
            status: symbol_short!("completed"),
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id),
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        for op in payments.iter() {
            if op.category == symbol_short!("bonus") {
                let mut total_bonuses: i128 = env.storage().instance().get(&DataKey::TotalBonusesPaid).unwrap_or(0);
                total_bonuses = total_bonuses.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
                env.storage().instance().set(&DataKey::TotalBonusesPaid, &total_bonuses);

                env.events().publish(
                    (symbol_short!("bonus"), op.category.clone(), op.recipient.clone()),
                    op.amount
                );
            } else {
                env.events().publish(
                    (symbol_short!("payment"), op.recipient.clone()),
                    op.amount
                );
            }
        }
        Ok(batch_id)
    }

    /// Gas-optimized best-effort batch payment.
    ///
    /// Optimizations vs. the original implementation:
    /// 1. **Single bulk pull, direct refund** — only one transfer into the
    ///    contract and at most one refund transfer back, instead of per-payment
    ///    accounting through the contract address.
    /// 2. **Cached contract address** — `env.current_contract_address()` is
    ///    called once and reused across all loop iterations.
    /// 3. **Batch records in persistent storage** — same benefit as above.
    /// 4. **Reduced cloning** — recipient addresses are only cloned for event
    ///    emission, not for transfer calls.
    pub fn execute_batch_partial(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        if len == 0 {
            return Err(ContractError::EmptyBatch);
        }
        if len > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }

        // Pre-compute the total of all valid (positive) amounts in one pass.
        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount > 0 {
                total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
            }
        }

        let token_client = token::Client::new(&env, &token);
        // Cache the contract address — avoids repeated cross-environment calls.
        let contract_addr = env.current_contract_address();
        // Single bulk pull from sender into the contract.
        token_client.transfer(&sender, &contract_addr, &total);

        let mut remaining = total;
        let mut success_count: u32 = 0;
        let mut fail_count: u32 = 0;
        let mut total_sent: i128 = 0;

        let batch_id = Self::next_batch_id(&env);
        for op in payments.iter() {
            if op.amount <= 0 || remaining < op.amount {
                fail_count += 1;
                PaymentSkippedEvent {
                    recipient: op.recipient.clone(),
                    amount: op.amount,
                };
                env.events().publish(
                    (symbol_short!("skipped"), op.recipient.clone()),
                    op.amount
                );
                continue;
            }
            token_client.transfer(&contract_addr, &op.recipient, &op.amount);
            remaining -= op.amount;
            total_sent += op.amount;
            success_count += 1;
            PaymentSentEvent {
                recipient: op.recipient.clone(),
                amount: op.amount,
            };

            if op.category == symbol_short!("bonus") {
                let mut total_bonuses: i128 = env.storage().instance().get(&DataKey::TotalBonusesPaid).unwrap_or(0);
                total_bonuses = total_bonuses.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
                env.storage().instance().set(&DataKey::TotalBonusesPaid, &total_bonuses);

                env.events().publish(
                    (symbol_short!("bonus"), op.category.clone(), op.recipient.clone()),
                    op.amount
                );
            } else {
                env.events().publish(
                    (symbol_short!("payment"), op.recipient.clone()),
                    op.amount
                );
            }
        }

        // Single refund transfer if there is leftover.
        if remaining > 0 {
            token_client.transfer(&contract_addr, &sender, &remaining);
        }

        let status = if fail_count == 0 {
            symbol_short!("completed")
        } else if success_count == 0 {
            symbol_short!("rollbck")
        } else {
            symbol_short!("partial")
        };

        // Persistent storage for batch records.
        let batch_id = Self::next_batch_id(&env);
        env.storage().persistent().set(&DataKey::Batch(batch_id), &BatchRecord {
        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender,
            token,
            total_sent,
            success_count,
            fail_count,
            status,
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id),
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        BatchPartialEvent { batch_id, success_count, fail_count };
        Ok(batch_id)
    }

    pub fn get_sequence(env: Env) -> u64 {
        let key = DataKey::Sequence;
        if let Some(value) = env.storage().persistent().get(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
            value
        } else {
            0
        }
    }

    pub fn get_batch(env: Env, batch_id: u64) -> Result<BatchRecord, ContractError> {
        // Read from persistent storage (optimized location for batch records).
        env.storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .ok_or(ContractError::BatchNotFound)
        let key = DataKey::Batch(batch_id);
        let record = env.storage().temporary().get(&key).ok_or(ContractError::BatchNotFound)?;
        env.storage().temporary().extend_ttl(
            &key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );
        Ok(record)
    }

    pub fn get_batch_count(env: Env) -> u64 {
        let key = DataKey::BatchCount;
        if let Some(value) = env.storage().persistent().get(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
            value
        } else {
            0
        }
    }

    fn require_admin(env: &Env) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::EntryArchived)?;
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        admin.require_auth();
        Ok(())
    }

    fn check_and_advance_sequence(env: &Env, expected: u64) -> Result<(), ContractError> {
        let storage = env.storage().instance();
        let current: u64 = storage.get(&DataKey::Sequence).unwrap_or(0);
        if current != expected {
            return Err(ContractError::SequenceMismatch);
        }
        storage.set(&DataKey::Sequence, &(current + 1));
        let current: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::Sequence)
            .ok_or(ContractError::EntryArchived)?;
        if current != expected {
            return Err(ContractError::SequenceMismatch);
        }
        env.storage().persistent().set(&DataKey::Sequence, &(current + 1));
        env.storage().persistent().extend_ttl(
            &DataKey::Sequence,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

    fn next_batch_id(env: &Env) -> u64 {
        let storage = env.storage().instance();
        let count: u64 = storage
            .get(&DataKey::BatchCount)
            .unwrap_or(0)
            + 1;
        storage.set(&DataKey::BatchCount, &count);
        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::BatchCount)
            .unwrap_or(0)
            + 1;
        env.storage().persistent().set(&DataKey::BatchCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::BatchCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        count
    }

    fn bump_core_ttl(env: &Env) {
        for key in [DataKey::Admin, DataKey::BatchCount, DataKey::Sequence] {
            if env.storage().persistent().has(&key) {
                env.storage().persistent().extend_ttl(
                    &key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
    }
}

#[cfg(test)]
mod test;