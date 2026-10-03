use soroban_sdk::{contract, contractimpl, Address, Env, Map, Symbol, Vec};

#[contract]
pub struct PaymentContract;

#[contractimpl]
impl PaymentContract {
    // Initialize the contract with an admin
    pub fn init(env: Env, admin: Address) {
        env.storage().instance().set(&Symbol::new("admin"), &admin);
    }

    // Efficient cross-asset deposit function with event indexing
    pub fn deposit(env: Env, user: Address, asset: Symbol, amount: i128) {
        user.require_auth();

        let key = (Symbol::new("balance"), user.clone(), asset.clone());
        let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_balance = current_balance + amount;
        env.storage().persistent().set(&key, &new_balance);

        // Emit indexed event for tracking
        env.events().publish(
            (Symbol::new("deposit"), user.clone(), asset.clone()),
            (amount, new_balance),
        );
    }

    // Optimized withdrawal with cross-asset validation
    pub fn withdraw(env: Env, user: Address, asset: Symbol, amount: i128) {
        user.require_auth();

        let key = (Symbol::new("balance"), user.clone(), asset.clone());
        let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if current_balance < amount {
            panic!("Insufficient balance");
        }

        let new_balance = current_balance - amount;
        env.storage().persistent().set(&key, &new_balance);

        // Emit indexed event for tracking
        env.events().publish(
            (Symbol::new("withdraw"), user.clone(), asset.clone()),
            (amount, new_balance),
        );
    }

    // Batch balance update for efficiency
    pub fn batch_update(env: Env, updates: Vec<(Address, Symbol, i128)>) {
        for (user, asset, amount) in updates.iter() {
            let key = (Symbol::new("balance"), user.clone(), asset.clone());
            let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            let new_balance = current_balance + amount;
            env.storage().persistent().set(&key, &new_balance);
        }
    }

    // Query balance with efficient storage access
    pub fn balance(env: Env, user: Address, asset: Symbol) -> i128 {
        let key = (Symbol::new("balance"), user, asset);
        env.storage().persistent().get(&key).unwrap_or(0)
    }
}
