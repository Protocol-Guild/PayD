use soroban_sdk::{Env, BytesN, Symbol, Map, String, Vec};

// Comprehensive test suite for cross-asset logic
#[test]
fn test_cross_asset_transfer() {
    let env = Env::default();
    let contract = PayDContract::new();
    
    let from = BytesN::random();
    let to = BytesN::random();
    let asset = Symbol::new("XLM");
    let amount = 1000;
    
    // Setup initial balance
    let mut metadata = Map::new(&env);
    metadata.insert(Symbol::new("name"), String::new(&env, "Stellar Lumens"));
    
    contract.update_asset_metadata(asset.clone(), metadata);
    
    // Test transfer
    contract.cross_asset_transfer(from.clone(), to.clone(), asset.clone(), amount, Map::new(&env));
    
    // Verify balances
    let from_balance = env.storage().persistent().get(&(Symbol::new("balance"), from, asset.clone())).unwrap_or(0);
    let to_balance = env.storage().persistent().get(&(Symbol::new("balance"), to, asset.clone())).unwrap_or(0);
    
    assert_eq!(from_balance, -amount);
    assert_eq!(to_balance, amount);
}

#[test]
fn test_batch_operations() {
    let env = Env::default();
    let contract = PayDContract::new();
    
    let user1 = BytesN::random();
    let user2 = BytesN::random();
    let asset1 = Symbol::new("USDC");
    let asset2 = Symbol::new("XLM");
    
    let operations = vec![
        &env, 
        (user1.clone(), user2.clone(), asset1.clone(), 500),
        (user2.clone(), user1.clone(), asset2.clone(), 1000)
    ];
    
    contract.batch_operations(operations);
    
    // Verify both operations completed
    let user1_usdc = env.storage().persistent().get(&(Symbol::new("balance"), user1.clone(), asset1.clone())).unwrap_or(0);
    let user2_usdc = env.storage().persistent().get(&(Symbol::new("balance"), user2.clone(), asset1.clone())).unwrap_or(0);
    let user1_xlm = env.storage().persistent().get(&(Symbol::new("balance"), user1.clone(), asset2.clone())).unwrap_or(0);
    let user2_xlm = env.storage().persistent().get(&(Symbol::new("balance"), user2.clone(), asset2.clone())).unwrap_or(0);
    
    assert_eq!(user1_usdc, -500);
    assert_eq!(user2_usdc, 500);
    assert_eq!(user1_xlm, 1000);
    assert_eq!(user2_xlm, -1000);
}
