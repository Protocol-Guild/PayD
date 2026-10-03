#![no_std]
#![no_main]

mod contract;
mod events;
mod types;

use soroban_sdk::{contractimpl, Env, Symbol, Vec, Address, Map, String};

// Re-export for external usage
pub use contract::PayDContract;
pub use events::IndexedEvents;
pub use types::{AssetData, CrossAssetPortfolio};

// Efficiency improvements: 
// 1. Reduced storage operations through batch processing
// 2. Optimized event indexing with separate topic structures
// 3. Cross-asset portfolio management with efficient data structures

#[contractimpl]
impl PayDContract {
    // Public interface for cross-asset operations
    pub fn initialize_cross_asset_system(env: Env, user: Address) -> CrossAssetPortfolio {
        CrossAssetPortfolio::new(&env, user)
    }
    
    // Batch operation for multiple assets
    pub fn batch_update_assets(env: Env, portfolio: &mut CrossAssetPortfolio, updates: Vec<(Symbol, i128, bool)>) {
        for (asset, amount, is_primary) in updates.iter() {
            portfolio.update_asset(asset.clone(), amount, is_primary);
        }
        
        // Emit batch event for indexing
        env.events().publish(
            (Symbol::new("portfolio_updated"), portfolio.user.clone()),
            (updates.len(), env.ledger().timestamp()),
        );
    }
}
