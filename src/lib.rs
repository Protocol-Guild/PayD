#![no_std]
#![allow(dead_code)]

mod contract;

use soroban_sdk::{contract, Address, Env, Map, Symbol, Vec};

#[contract]
pub struct CrossAssetContract;

#[contractimpl]
impl CrossAssetContract {
    // Re-export all contract methods for the SDK
    pub fn initialize(env: Env, admin: Address, assets: Vec<Symbol>) {
        contract::CrossAssetContract::initialize(env, admin, assets);
    }
    
    pub fn swap(
        env: Env,
        from_user: Address,
        from_asset: Symbol,
        to_asset: Symbol,
        from_amount: i128,
        min_to_amount: i128,
    ) {
        contract::CrossAssetContract::swap(env, from_user, from_asset, to_asset, from_amount, min_to_amount);
    }
    
    pub fn batch_update_balances(env: Env, user: Address, updates: Vec<(Symbol, i128)>) {
        contract::CrossAssetContract::batch_update_balances(env, user, updates);
    }
    
    pub fn get_balance(env: Env, user: Address, asset: Symbol) -> i128 {
        contract::CrossAssetContract::get_balance(env, user, asset)
    }
    
    pub fn get_user_assets(env: Env, user: Address) -> Vec<Symbol> {
        contract::CrossAssetContract::get_user_assets(env, user)
    }
}
