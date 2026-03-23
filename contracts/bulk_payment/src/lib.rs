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

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct BulkPaymentContract;

#[contractimpl]
impl BulkPaymentContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::BatchCount, &0u64);
        env.storage().instance().set(&DataKey::Sequence, &0u64);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Ok(())
    }

    pub fn execute_batch(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        if len == 0 {
            return Err(ContractError::EmptyBatch);
        }
        if len > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }

        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &total);

        for op in payments.iter() {
            token_client.transfer(&env.current_contract_address(), &op.recipient, &op.amount);
        }

        let batch_id = Self::next_batch_id(&env);
        env.storage().instance().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender,
            token,
            total_sent: total,
            success_count: len,
            fail_count: 0,
            status: symbol_short!("completed"),
        });

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

    pub fn execute_batch_partial(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        if len == 0 {
            return Err(ContractError::EmptyBatch);
        }
        if len > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }

        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount > 0 {
                total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
            }
        }

        let token_client = token::Client::new(&env, &token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&sender, &contract_addr, &total);

        let mut remaining = total;
        let mut success_count: u32 = 0;
        let mut fail_count: u32 = 0;
        let mut total_sent: i128 = 0;

        let batch_id = Self::next_batch_id(&env);
        for op in payments.iter() {
            if op.amount <= 0 || remaining < op.amount {
                fail_count += 1;
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

        env.storage().instance().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender,
            token,
            total_sent,
            success_count,
            fail_count,
            status,
        });
        Ok(batch_id)
    }

    pub fn get_sequence(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Sequence).unwrap_or(0)
    }

    pub fn get_batch(env: Env, batch_id: u64) -> Result<BatchRecord, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Batch(batch_id))
            .ok_or(ContractError::BatchNotFound)
    }

    pub fn get_batch_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::BatchCount).unwrap_or(0)
    }

    fn require_admin(env: &Env) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();
        Ok(())
    }

    fn check_and_advance_sequence(env: &Env, expected: u64) -> Result<(), ContractError> {
        let current: u64 = env.storage().instance().get(&DataKey::Sequence).unwrap_or(0);
        if current != expected {
            return Err(ContractError::SequenceMismatch);
        }
        env.storage().instance().set(&DataKey::Sequence, &(current + 1));
        Ok(())
    }

    fn next_batch_id(env: &Env) -> u64 {
        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::BatchCount)
            .unwrap_or(0)
            + 1;
        env.storage().instance().set(&DataKey::BatchCount, &count);
        count
    }
}

#[cfg(test)]
mod test;