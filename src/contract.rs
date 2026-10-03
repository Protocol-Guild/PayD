use soroban_sdk::{contract, contractimpl, Address, Env, Map, Symbol, Vec};

#[contract]
pub struct CrossAssetContract;

#[contractimpl]
impl CrossAssetContract {
    /// Initialize the contract with admin and supported assets
    pub fn initialize(env: Env, admin: Address, assets: Vec<Symbol>) {
        admin.require_auth();
        
        // Store admin with efficient single-key access
        env.storage().instance().set(&Symbol::new("admin"), &admin);
        
        // Create asset registry using Map for O(1) lookups
        let mut asset_registry: Map<Symbol, bool> = Map::new(&env);
        for asset in assets.iter() {
            asset_registry.set(asset, true);
        }
        env.storage().instance().set(&Symbol::new("assets"), &asset_registry);
        
        // Emit initialization event with indexed parameters
        env.events().publish(
            (Symbol::new("initialized"), admin.clone()),
            (assets, env.ledger().timestamp()),
        );
    }

    /// Efficient cross-asset swap with optimized storage access
    pub fn swap(
        env: Env,
        from_user: Address,
        from_asset: Symbol,
        to_asset: Symbol,
        from_amount: i128,
        min_to_amount: i128,
    ) {
        from_user.require_auth();
        
        // Validate assets in single batch operation
        let assets: Map<Symbol, bool> = env.storage().instance()
            .get(&Symbol::new("assets"))
            .expect("assets not initialized");
        
        if !assets.contains_key(from_asset.clone()) || !assets.contains_key(to_asset.clone()) {
            panic!("unsupported asset");
        }
        
        // Efficient balance updates using batch operations
        let from_balance_key = (from_user.clone(), from_asset.clone());
        let to_balance_key = (from_user.clone(), to_asset.clone());
        
        let mut balances: Map<(Address, Symbol), i128> = env.storage().instance()
            .get(&Symbol::new("balances"))
            .unwrap_or(Map::new(&env));
        
        let from_balance = balances.get(from_balance_key.clone()).unwrap_or(0);
        if from_balance < from_amount {
            panic!("insufficient balance");
        }
        
        // Calculate swap rate (simplified - would use oracle in production)
        let to_amount = Self::calculate_swap_rate(&env, &from_asset, &to_asset, &from_amount);
        if to_amount < min_to_amount {
            panic!("slippage too high");
        }
        
        // Update balances atomically
        balances.set(from_balance_key.clone(), from_balance - from_amount);
        let to_balance = balances.get(to_balance_key.clone()).unwrap_or(0);
        balances.set(to_balance_key.clone(), to_balance + to_amount);
        
        env.storage().instance().set(&Symbol::new("balances"), &balances);
        
        // Emit indexed swap event
        env.events().publish(
            (Symbol::new("swap"), from_user.clone(), from_asset.clone(), to_asset.clone()),
            (from_amount, to_amount, env.ledger().timestamp()),
        );
    }

    /// Batch balance updates for efficiency
    pub fn batch_update_balances(
        env: Env,
        user: Address,
        updates: Vec<(Symbol, i128)>,
    ) {
        user.require_auth();
        
        let mut balances: Map<(Address, Symbol), i128> = env.storage().instance()
            .get(&Symbol::new("balances"))
            .unwrap_or(Map::new(&env));
        
        for (asset, amount) in updates.iter() {
            let key = (user.clone(), asset.clone());
            let current_balance = balances.get(key.clone()).unwrap_or(0);
            balances.set(key, current_balance + amount);
        }
        
        env.storage().instance().set(&Symbol::new("balances"), &balances);
        
        // Emit batch update event
        env.events().publish(
            (Symbol::new("batch_update"), user),
            (updates, env.ledger().timestamp()),
        );
    }

    /// Query balances with efficient indexing
    pub fn get_balance(env: Env, user: Address, asset: Symbol) -> i128 {
        let balances: Map<(Address, Symbol), i128> = env.storage().instance()
            .get(&Symbol::new("balances"))
            .unwrap_or(Map::new(&env));
        
        balances.get((user, asset)).unwrap_or(0)
    }

    /// Get all assets for a user (efficient iteration)
    pub fn get_user_assets(env: Env, user: Address) -> Vec<Symbol> {
        let balances: Map<(Address, Symbol), i128> = env.storage().instance()
            .get(&Symbol::new("balances"))
            .unwrap_or(Map::new(&env));
        
        let mut user_assets = Vec::new(&env);
        // In a real implementation, we'd maintain a separate index for efficient querying
        // This is a simplified version
        for (asset_user, asset) in balances.keys() {
            if asset_user == user {
                let balance = balances.get((user.clone(), asset.clone())).unwrap_or(0);
                if balance > 0 {
                    user_assets.push_back(asset);
                }
            }
        }
        user_assets
    }

    /// Internal helper for swap rate calculation
    fn calculate_swap_rate(
        env: &Env,
        from_asset: &Symbol,
        to_asset: &Symbol,
        from_amount: &i128,
    ) -> i128 {
        // Simplified rate calculation - in production would use oracle
        // This demonstrates the pattern without external dependencies
        let base_rate: i128 = 1000; // 1:1 rate for demo
        from_amount * base_rate / 1000
    }
}

// Event indexing helper
pub struct EventIndex;

impl EventIndex {
    /// Publish indexed event with multiple parameters for efficient querying
    pub fn publish_indexed_event(
        env: &Env,
        event_type: Symbol,
        user: &Address,
        asset: &Symbol,
        amount: i128,
        metadata: Option<Symbol>,
    ) {
        let event_data = (user.clone(), asset.clone(), amount, metadata, env.ledger().timestamp());
        env.events().publish((event_type, user.clone(), asset.clone()), event_data);
    }
}
