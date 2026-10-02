#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, vec, Map};
mod events;
mod state;
mod xasset;

pub use events::*;
pub use state::*;
pub use xasset::*;

#[contract]
pub struct PayDContract;

/// Core payd contract implementing Soroban v22 advanced efficiency patterns
#[contractimpl]
impl PayDContract {
    pub fn __constructor(env: Env) {
        state::init(&env);
    }

    /// Efficient cross-asset transfer with event indexing
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        asset: Symbol,
        amount: i128,
    ) -> Result<(), TransferError> {
        let current = env.contract_address();
        from.require_auth();

        if amount <= 0 {
            return Err(TransferError::InvalidAmount);
        }

        let mut balances: Map<Address, i128> = state::get_map(&env, &current, &state::BALANCES_KEY);
        let from_bal = *balances.get(&from).unwrap_or(&0);
        if from_bal < amount {
            return Err(TransferError::InsufficientBalance);
        }

        let to_bal = *balances.get(&to).unwrap_or(&0);

        balances.set(from, from_bal - amount);
        balances.set(to, to_bal + amount);
        state::set_map(&env, &current, &state::BALANCES_KEY, &balances);

        // Indexed event emission for off-chain tracking
        events::emit_transfer(
            &env,
            &from,
            &to,
            &asset,
            amount,
            env.latest_contract_state().ledger_sequence,
        );

        Ok(())
    }

    /// Cross-asset swap with atomicity guarantees
    pub fn swap(
        env: Env,
        sender: Address,
        from_asset: Symbol,
        to_asset: Symbol,
        from_amount: i128,
        min_to_amount: i128,
    ) -> Result<i128, SwapError> {
        sender.require_auth();

        if from_asset == to_asset {
            return Err(SwapError::SameAsset);
        }
        if from_amount <= 0 || min_to_amount <= 0 {
            return Err(SwapError::InvalidAmount);
        }

        let rate = xasset::get_rate(&env, &from_asset, &to_asset);
        let to_amount = xasset::calculate_output(&env, from_amount, &rate);

        if to_amount < min_to_amount {
            return Err(SwapError::SlippageExceeded);
        }

        // Atomic balance updates
        let mut balances: Map<Address, i128> = state::get_map(&env, &sender.contract(), &state::BALANCES_KEY);
        let from_bal = *balances.get(&sender).unwrap_or(&0);
        if from_bal < from_amount {
            return Err(SwapError::InsufficientBalance);
        }
        balances.set(&sender, from_bal - from_amount);
        state::set_map(&env, &sender.contract(), &state::BALANCES_KEY, &balances);

        let mut balances_to: Map<Address, i128> = state::get_map(&env, &to.contract(), &state::BALANCES_KEY);
        let to_bal = *balances_to.get(&sender).unwrap_or(&0);
        balances_to.set(&sender, to_bal + to_amount);
        state::set_map(&env, &to.contract(), &state::BALANCES_KEY, &balances_to);

        events::emit_swap(
            &env,
            &sender,
            &from_asset,
            &to_asset,
            from_amount,
            to_amount,
            env.latest_contract_state().ledger_sequence,
        );

        Ok(to_amount)
    }
}

/// Error types for contract operations
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TransferError {
    InvalidAmount = 1,
    InsufficientBalance = 2,
    Unauthorized = 3,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SwapError {
    SameAsset = 1,
    InvalidAmount = 2,
    SlippageExceeded = 3,
    InsufficientBalance = 4,
}
