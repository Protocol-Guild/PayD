use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct EventLogger;

#[contractimpl]
impl EventLogger {
    // Centralized event emission for cross-asset operations
    pub fn log_transfer(env: Env, from: Address, to: Address, asset: Symbol, amount: i128) {
        env.events().publish(
            (Symbol::new("transfer"), from, to, asset),
            amount,
        );
    }

    // Indexed event for audit trails
    pub fn log_approval(env: Env, owner: Address, spender: Address, asset: Symbol, amount: i128) {
        env.events().publish(
            (Symbol::new("approve"), owner, spender, asset),
            amount,
        );
    }
}
