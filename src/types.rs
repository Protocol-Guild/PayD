use soroban_sdk::{Address, Map, Symbol};

// Optimized data structures for cross-asset management
#[derive(Clone, Debug)]
pub struct AssetData {
    pub owner: Address,
    pub asset_type: Symbol,
    pub balance: i128,
    pub metadata: Map<String, String>,
    pub created_at: u64,
}

#[derive(Clone, Debug)]
pub struct CrossAssetPortfolio {
    pub user: Address,
    pub primary_assets: Map<Symbol, i128>,
    pub secondary_assets: Map<Symbol, i128>,
    pub total_value: i128,
    pub last_updated: u64,
}

impl AssetData {
    pub fn new(env: &Env, owner: Address, asset_type: Symbol, initial_balance: i128) -> Self {
        AssetData {
            owner,
            asset_type,
            balance: initial_balance,
            metadata: Map::new(env),
            created_at: env.ledger().timestamp(),
        }
    }
}

impl CrossAssetPortfolio {
    pub fn new(env: &Env, user: Address) -> Self {
        CrossAssetPortfolio {
            user,
            primary_assets: Map::new(env),
            secondary_assets: Map::new(env),
            total_value: 0,
            last_updated: env.ledger().timestamp(),
        }
    }
    
    // Efficient update method to minimize storage writes
    pub fn update_asset(&mut self, asset: Symbol, amount: i128, is_primary: bool) {
        if is_primary {
            self.primary_assets.set(asset, amount);
        } else {
            self.secondary_assets.set(asset, amount);
        }
        self.last_updated = soroban_sdk::Env::ledger().timestamp();
    }
}
