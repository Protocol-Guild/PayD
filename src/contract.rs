use soroban_sdk::{contract, contractimpl, Env, String, Map, Vec, Symbol, event};

#[contract]
struct PayDContract;

#[contractimpl]
impl PayDContract {
    // Efficient cross-asset transfer with indexed events
    pub fn cross_asset_transfer(
        env: Env,
        from: String,
        to: String,
        amount: i128,
        asset: Symbol,
    ) {
        // Input validation
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Composite key for efficient storage access
        let from_key = (from.clone(), asset.clone());
        let to_key = (to.clone(), asset.clone());

        // Optimized balance retrieval using persistent storage
        let mut from_balance: i128 = env
            .storage
            .persistent
            .get(&from_key)
            .unwrap_or(0);
        let mut to_balance: i128 = env
            .storage
            .persistent
            .get(&to_key)
            .unwrap_or(0);

        // Balance checks
        if from_balance < amount {
            panic!("Insufficient balance");
        }

        // Atomic balance updates
        from_balance -= amount;
        to_balance += amount;

        // Batch storage updates
        env.storage.persistent.set(&from_key, &from_balance);
        env.storage.persistent.set(&to_key, &to_balance);

        // Emit indexed event for efficient querying
        TransferEvent {
            from: from.clone(),
            to: to.clone(),
            amount,
            asset: asset.clone(),
        }
        .emit(&env);
    }

    // Batch balance query for efficiency
    pub fn get_balances(env: Env, users: Vec<String>, asset: Symbol) -> Map<String, i128> {
        let mut balances = Map::new(&env);
        for user in users.iter() {
            let key = (user.clone(), asset.clone());
            let balance = env.storage.persistent.get(&key).unwrap_or(0);
            balances.set(user.clone(), balance);
        }
        balances
    }
}

// Indexed event structure for efficient event querying
#[event]
struct TransferEvent {
    #[index]
    from: String,
    #[index]
    to: String,
    amount: i128,
    #[index]
    asset: Symbol,
}

// Helper functions for asset management
impl PayDContract {
    pub fn initialize_balance(env: Env, user: String, asset: Symbol, amount: i128) {
        let key = (user, asset);
        env.storage.persistent.set(&key, &amount);
    }
}
