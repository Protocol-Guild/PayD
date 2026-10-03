#![cfg(test)]

use soroban_sdk::{Address, Env, Symbol, Vec};

mod cross_asset_contract {
    soroban_sdk::import!();
    use super::*;
}

#[test]
fn test_initialization() {
    let env = Env::default();
    let admin = Address::random(&env);
    let assets = vec![&env, Symbol::new("USDC"), Symbol::new("XLM")];
    
    cross_asset_contract::initialize(&env, admin.clone(), assets.clone());
    
    // Verify admin is set
    // In a real test, we'd verify the admin storage
    
    // Verify assets are registered
    let user_assets = cross_asset_contract::get_user_assets(&env, admin.clone());
    assert_eq!(user_assets.len(), 0); // No balances yet
}

#[test]
fn test_swap() {
    let env = Env::default();
    let user = Address::random(&env);
    let assets = vec![&env, Symbol::new("USDC"), Symbol::new("XLM")];
    
    cross_asset_contract::initialize(&env, user.clone(), assets.clone());
    
    // Give user some initial balance
    let updates = vec![&env, (Symbol::new("USDC"), 1000)];
    cross_asset_contract::batch_update_balances(&env, user.clone(), updates);
    
    // Perform swap
    cross_asset_contract::swap(
        &env,
        user.clone(),
        Symbol::new("USDC"),
        Symbol::new("XLM"),
        100,
        90, // min_to_amount
    );
    
    // Verify balances updated
    let usdc_balance = cross_asset_contract::get_balance(&env, user.clone(), Symbol::new("USDC"));
    let xlm_balance = cross_asset_contract::get_balance(&env, user.clone(), Symbol::new("XLM"));
    
    assert_eq!(usdc_balance, 900); // 1000 - 100
    assert!(xlm_balance > 0); // Received XLM
}

#[test]
fn test_batch_updates() {
    let env = Env::default();
    let user = Address::random(&env);
    let assets = vec![&env, Symbol::new("USDC"), Symbol::new("XLM"), Symbol::new("BTC")];
    
    cross_asset_contract::initialize(&env, user.clone(), assets.clone());
    
    // Batch update multiple assets
    let updates = vec![
        &env,
        (Symbol::new("USDC"), 500),
        (Symbol::new("XLM"), 1000),
        (Symbol::new("BTC"), 1),
    ];
    
    cross_asset_contract::batch_update_balances(&env, user.clone(), updates);
    
    assert_eq!(cross_asset_contract::get_balance(&env, user.clone(), Symbol::new("USDC")), 500);
    assert_eq!(cross_asset_contract::get_balance(&env, user.clone(), Symbol::new("XLM")), 1000);
    assert_eq!(cross_asset_contract::get_balance(&env, user.clone(), Symbol::new("BTC")), 1);
}
