//! Cross-asset transaction logic
//!
//! This module handles conversions and transfers between different
//! asset types within the PayD protocol.

use soroban_sdk::{Env, Address, Symbol, i128};

/// Represents an asset pair for cross-asset transactions
#[derive(Clone, Debug)]
pub struct AssetPair {
    pub asset_a: Address,
    pub asset_b: Address,
}

/// Cross-asset manager for handling conversions
pub struct CrossAssetManager;

impl CrossAssetManager {
    /// Calculate conversion amount between assets
    pub fn calculate_conversion(
        env: &Env,
        pair: &AssetPair,
        amount: i128,
    ) -> i128 {
        // Get conversion rate
        let rate_key = format_rate_key(env, pair);
        let rate: i128 = env.storage().temporary().get(&rate_key).unwrap_or(10000i128); // Default 1:1
        
        // Calculate converted amount (rate is in basis points, 10000 = 1.0)
        let converted = (amount * rate) / 10000i128;
        
        converted
    }

    /// Check if cross-asset transfer is enabled
    pub fn is_pair_enabled(env: &Env, pair: &AssetPair) -> bool {
        let key = format_pair_enabled_key(env, pair);
        env.storage().temporary().get(&key).unwrap_or(false)
    }

    /// Set conversion rate for a pair
    pub fn set_rate(env: &Env, pair: &AssetPair, rate: i128) {
        let rate_key = format_rate_key(env, pair);
        env.storage().temporary().set(&rate_key, &rate);
        
        // Emit rate update event
        soroban_sdk::contract_event(
            env,
            Symbol::new(env, "rate_updated"),
            soroban_sdk::ContractEventData {
                addresses: vec![pair.asset_a.clone(), pair.asset_b.clone()],
                amounts: vec![rate],
            },
        );
    }
}

/// Format storage key for rate
fn format_rate_key(env: &Env, pair: &AssetPair) -> Symbol {
    let key = format!("rate:{}-{}", pair.asset_a.to_string(), pair.asset_b.to_string());
    Symbol::new(env, &key)
}

/// Format storage key for pair enabled status
fn format_pair_enabled_key(env: &Env, pair: &AssetPair) -> Symbol {
    let key = format!("enabled:{}-{}", pair.asset_a.to_string(), pair.asset_b.to_string());
    Symbol::new(env, &key)
}
