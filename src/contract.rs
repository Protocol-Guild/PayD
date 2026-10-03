use soroban_sdk::{contract, contractimpl, Address, Env, Map, String, Symbol, Vec};

#[contract]
pub struct PayDContract;

#[contractimpl]
impl PayDContract {
    // Efficient cross-asset storage using Map for O(1) access
    pub fn store_cross_asset_data(env: Env, user: Address, asset: Symbol, amount: i128) {
        let mut user_assets: Map<Symbol, i128> = env.storage().instance().get(&user).unwrap_or_default();
        user_assets.set(asset, amount);
        env.storage().instance().set(&user, &user_assets);
        
        // Emit indexed event for cross-asset operations
        env.events().publish(
            (Symbol::new("cross_asset_updated"), user.clone()),
            (asset, amount, env.ledger().timestamp()),
        );
    }

    // Batch processing for efficiency - reduces storage operations
    pub fn batch_process_assets(env: Env, operations: Vec<(Address, Symbol, i128)>) {
        for (user, asset, amount) in operations.iter() {
            Self::store_cross_asset_data(env.clone(), user.clone(), asset.clone(), amount);
        }
        
        // Emit batch completion event
        env.events().publish(
            (Symbol::new("batch_processed"),),
            (operations.len(), env.ledger().timestamp()),
        );
    }

    // Efficient query with caching for frequently accessed data
    pub fn get_user_asset_balance(env: Env, user: Address, asset: Symbol) -> Option<i128> {
        let user_assets: Map<Symbol, i128> = env.storage().instance().get(&user).unwrap_or_default();
        user_assets.get(&asset).copied()
    }

    // Event indexing optimization - separate event topics for better filtering
    pub fn emit_indexed_events(env: Env, user: Address, asset_type: String, metadata: Map<String, String>) {
        // Primary event for asset creation
        env.events().publish(
            (Symbol::new("asset_created"), asset_type.clone()),
            (user, metadata, env.ledger().timestamp()),
        );
        
        // Secondary event for indexing by user
        env.events().publish(
            (Symbol::new("user_activity"), user.clone()),
            (asset_type, env.ledger().timestamp()),
        );
    }
}
