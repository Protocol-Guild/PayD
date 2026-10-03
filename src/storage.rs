use soroban_sdk::{Env, Symbol, Map, BytesN};

// Optimized storage patterns for cross-asset logic
pub struct AssetStorage;

impl AssetStorage {
    // Efficient key generation for multi-asset support
    pub fn balance_key(user: &BytesN<32>, asset: &Symbol) -> (Symbol, BytesN<32>, Symbol) {
        (Symbol::new("balance"), user.clone(), asset.clone())
    }
    
    pub fn metadata_key(asset: &Symbol) -> (Symbol, Symbol) {
        (Symbol::new("asset_meta"), asset.clone())
    }
    
    // Batch storage operations for efficiency
    pub fn update_balances(env: &Env, updates: Vec<(BytesN<32>, BytesN<32>, Symbol, i128)>) {
        let mut storage = env.storage().persistent();
        
        for update in updates.iter() {
            let (from, to, asset, amount) = update;
            
            let from_key = Self::balance_key(from, asset);
            let to_key = Self::balance_key(to, asset);
            
            let from_balance: i128 = storage.get(&from_key).unwrap_or(0);
            let to_balance: i128 = storage.get(&to_key).unwrap_or(0);
            
            storage.set(&from_key, &(from_balance - amount));
            storage.set(&to_key, &(to_balance + amount));
        }
    }
}
