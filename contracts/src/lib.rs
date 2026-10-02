//! PayD Smart Contract - Advanced Soroban Logic Part 20
//!
//! This module contains the core Soroban contract logic with optimizations
//! for efficiency, event indexing, and cross-asset support.

use soroban_sdk::{contract, contracterror, contractimpl, Address, Env, Vec, Map, Symbol};
use crate::events::{EventIndex, emit_indexed_event};
use crate::cross_asset::{CrossAssetManager, AssetPair};

// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    InvalidAsset = 1,
    InsufficientBalance = 2,
    Unauthorized = 3,
    CrossAssetError = 4,
    IndexOutOfBounds = 5,
}

// Contract state
#[contract]
pub struct PayDContract;

// Storage keys (optimized for Soroban)
const STORAGE_KEY_ADMIN: Symbol = Symbol::new(env!(), "admin");
const STORAGE_KEY_ASSETS: Symbol = Symbol::new(env!(), "assets");
const STORAGE_KEY_INDEXES: Symbol = Symbol::new(env!(), "indexes");
const STORAGE_KEY_CROSS_ASSET_REGISTRY: Symbol = Symbol::new(env!(), "cross_registry");

#[contractimpl]
impl PayDContract {
    /// Initialize contract with admin
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();
        
        // Store admin with high priority
        env.storage().persistent().set(&STORAGE_KEY_ADMIN, &admin);
        
        // Initialize empty asset map
        let empty_assets: Vec<(Address, i128)> = Vec::new(&env);
        env.storage().persistent().set(&STORAGE_KEY_ASSETS, &empty_assets);
        
        // Initialize event index
        let empty_indexes: Map<Symbol, EventIndex> = Map::new(&env);
        env.storage().persistent().set(&STORAGE_KEY_INDEXES, &empty_indexes);
        
        // Initialize cross-asset registry
        let empty_registry: Vec<(AssetPair, bool)> = Vec::new(&env);
        env.storage().persistent().set(&STORAGE_KEY_CROSS_ASSET_REGISTRY, &empty_registry);
        
        // Emit initialization event with indexing
        emit_indexed_event(
            &env,
            Symbol::new(&env, "initialized"),
            vec![admin.clone()],
            vec![],
        );
    }

    /// Register a new asset for payments
    pub fn register_asset(env: Env, asset: Address, decimals: u32, admin: Address) {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().persistent().get(&STORAGE_KEY_ADMIN).unwrap();
        if admin != stored_admin {
            panic!(Error::Unauthorized);
        }
        
        // Validate asset
        if asset.is_contract() {
            // Check if it's a valid token contract
            // For now, accept any contract address
        }
        
        // Store asset metadata
        let key = format_asset_key(&env, &asset);
        let asset_data = (asset.clone(), decimals);
        env.storage().temporary().set(&key, &asset_data);
        
        // Update asset list
        let mut assets: Vec<(Address, i128)> = env.storage().persistent().get(&STORAGE_KEY_ASSETS).unwrap();
        assets.push((asset.clone(), 0i128));
        env.storage().persistent().set(&STORAGE_KEY_ASSETS, &assets);
        
        // Emit indexed event
        emit_indexed_event(
            &env,
            Symbol::new(&env, "asset_registered"),
            vec![asset],
            vec![decimals.into()],
        );
    }

    /// Get asset balance efficiently
    pub fn get_balance(env: Env, asset: Address, user: Address) -> i128 {
        let key = format_user_asset_key(&env, &asset, &user);
        env.storage().temporary().get(&key).unwrap_or(0i128)
    }

    /// Transfer asset between users with cross-asset support
    pub fn transfer(
        env: Env,
        asset: Address,
        from: Address,
        to: Address,
        amount: i128,
        target_asset: Option<Address>,
    ) {
        from.require_auth();
        
        if amount <= 0 {
            panic!(Error::InvalidAsset);
        }
        
        // Get current balance
        let from_key = format_user_asset_key(&env, &asset, &from);
        let from_balance: i128 = env.storage().temporary().get(&from_key).unwrap_or(0i128);
        
        if from_balance < amount {
            panic!(Error::InsufficientBalance);
        }
        
        // Deduct from sender
        env.storage().temporary().set(&from_key, &(from_balance - amount));
        
        // Handle cross-asset if specified
        if let Some(target) = target_asset {
            Self::handle_cross_asset_transfer(&env, from.clone(), to.clone(), asset, target, amount);
        } else {
            // Standard transfer
            let to_key = format_user_asset_key(&env, &asset, &to);
            let to_balance: i128 = env.storage().temporary().get(&to_key).unwrap_or(0i128);
            env.storage().temporary().set(&to_key, &(to_balance + amount));
        }
        
        // Emit transfer event with indexing
        emit_indexed_event(
            &env,
            Symbol::new(&env, "transfer"),
            vec![asset, from, to],
            vec![amount.into()],
        );
    }

    /// Handle cross-asset transfer logic
    fn handle_cross_asset_transfer(
        env: &Env,
        from: Address,
        to: Address,
        source_asset: Address,
        target_asset: Address,
        amount: i128,
    ) {
        // Check if cross-asset pair is registered
        let pair = AssetPair {
            asset_a: source_asset.clone(),
            asset_b: target_asset.clone(),
        };
        
        let registry_key = format_cross_asset_key(env, &pair);
        let is_enabled: bool = env.storage().temporary().get(&registry_key).unwrap_or(false);
        
        if !is_enabled {
            panic!(Error::CrossAssetError);
        }
        
        // Apply cross-asset conversion logic
        let converted_amount = CrossAssetManager::calculate_conversion(env, &pair, amount);
        
        // Credit to destination with converted amount
        let to_key = format_user_asset_key(env, &target_asset, &to);
        let to_balance: i128 = env.storage().temporary().get(&to_key).unwrap_or(0i128);
        env.storage().temporary().set(&to_key, &(to_balance + converted_amount));
        
        // Emit cross-asset event
        emit_indexed_event(
            env,
            Symbol::new(env, "cross_asset_transfer"),
            vec![source_asset, target_asset, from, to],
            vec![amount.into(), converted_amount.into()],
        );
    }

    /// Register a cross-asset trading pair
    pub fn register_cross_asset_pair(
        env: Env,
        asset_a: Address,
        asset_b: Address,
        rate: i128,
        admin: Address,
    ) {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().persistent().get(&STORAGE_KEY_ADMIN).unwrap();
        if admin != stored_admin {
            panic!(Error::Unauthorized);
        }
        
        let pair = AssetPair {
            asset_a: asset_a.clone(),
            asset_b: asset_b.clone(),
        };
        
        let key = format_cross_asset_key(&env, &pair);
        env.storage().temporary().set(&key, &true);
        
        // Store rate for conversion calculations
        let rate_key = format_rate_key(&env, &pair);
        env.storage().temporary().set(&rate_key, &rate);
        
        // Emit indexed event
        emit_indexed_event(
            &env,
            Symbol::new(&env, "cross_asset_registered"),
            vec![asset_a, asset_b],
            vec![rate.into()],
        );
    }

    /// Get event history with pagination
    pub fn get_events(env: Env, event_type: Symbol, from_index: u32, limit: u32) -> Vec<(u32, Vec<Address>, Vec<i128>)> {
        let indexes: Map<Symbol, EventIndex> = env.storage().persistent().get(&STORAGE_KEY_INDEXES).unwrap();
        
        if let Some(index) = indexes.get(&event_type) {
            let mut results: Vec<(u32, Vec<Address>, Vec<i128>)> = Vec::new(&env);
            let end = std::cmp::min(index.last_index, from_index + limit);
            
            for i in from_index..end {
                let event_key = format_event_key(&env, &event_type, i);
                if let Some(event_data) = env.storage().temporary().get::<_, (Vec<Address>, Vec<i128>)>(&event_key) {
                    results.push((i, event_data.0, event_data.1));
                }
            }
            
            results
        } else {
            Vec::new(&env)
        }
    }
}

// Helper functions for storage key formatting
fn format_asset_key(env: &Env, asset: &Address) -> Symbol {
    let asset_str = asset.to_string();
    Symbol::new(env, &format!("asset:{}", asset_str))
}

fn format_user_asset_key(env: &Env, asset: &Address, user: &Address) -> Symbol {
    let asset_str = asset.to_string();
    let user_str = user.to_string();
    Symbol::new(env, &format!("balance:{}:{}", asset_str, user_str))
}

fn format_cross_asset_key(env: &Env, pair: &AssetPair) -> Symbol {
    let key = format!("cross:{}-{}", pair.asset_a.to_string(), pair.asset_b.to_string());
    Symbol::new(env, &key)
}

fn format_rate_key(env: &Env, pair: &AssetPair) -> Symbol {
    let key = format!("rate:{}-{}", pair.asset_a.to_string(), pair.asset_b.to_string());
    Symbol::new(env, &key)
}

fn format_event_key(env: &Env, event_type: &Symbol, index: u32) -> Symbol {
    let key = format!("event:{}:{}", event_type.to_string(), index);
    Symbol::new(env, &key)
}
