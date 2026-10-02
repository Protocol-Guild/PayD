//! Integration tests for Soroban Logic Part 20
//!
//! Tests cover efficiency optimizations, event indexing, and cross-asset logic.

use payd::PayDContractClient;
use soroban_sdk::{symbol_short, vec, Address, Env, symbol, IntoVal, OutOfContract};
use soroban_sdk::testutils::{Address as AddressTest, Events, Storage};

#[test]
fn test_init_and_admin() {
    let env = Env::default();
    let admin = Address::random(&env);
    let contract_id = env.register_contract(None, payd::PayDContract);
    let client = PayDContractClient::new(&env, &contract_id);
    
    client.init(&admin);
    
    // Verify admin was set
    let storage_key = soroban_sdk::Symbol::new(&env, "admin");
    let stored_admin: Address = env.storage().persistent().get(&storage_key).unwrap();
    assert_eq!(stored_admin, admin);
}

#[test]
fn test_register_asset() {
    let env = Env::default();
    let admin = Address::random(&env);
    let contract_id = env.register_contract(None, payd::PayDContract);
    let client = PayDContractClient::new(&env, &contract_id);
    
    client.init(&admin);
    
    let asset = Address::random(&env);
    client.register_asset(&asset, &3u32, &admin);
    
    // Verify event was emitted
    let events = env.events().all();
    assert!(events.iter().any(|e| e.topic().len() > 0));
}

#[test]
fn test_transfer_with_balance() {
    let env = Env::default();
    let admin = Address::random(&env);
    let user1 = Address::random(&env);
    let user2 = Address::random(&env);
    let contract_id = env.register_contract(None, payd::PayDContract);
    let client = PayDContractClient::new(&env, &contract_id);
    
    client.init(&admin);
    
    let asset = Address::random(&env);
    client.register_asset(&asset, &18u32, &admin);
    
    // Set initial balance for user1
    let balance_key = soroban_sdk::Symbol::new(&env, &format!("balance:{}:{}", asset.to_string(), user1.to_string()));
    env.storage().temporary().set(&balance_key, &1000i128);
    
    // Transfer from user1 to user2
    client.transfer(&asset, &user1, &user2, &500i128, &None);
    
    // Verify balances
    let user1_balance_key = soroban_sdk::Symbol::new(&env, &format!("balance:{}:{}", asset.to_string(), user1.to_string()));
    let user1_balance: i128 = env.storage().temporary().get(&user1_balance_key).unwrap();
    assert_eq!(user1_balance, 500i128);
    
    let user2_balance_key = soroban_sdk::Symbol::new(&env, &format!("balance:{}:{}", asset.to_string(), user2.to_string()));
    let user2_balance: i128 = env.storage().temporary().get(&user2_balance_key).unwrap();
    assert_eq!(user2_balance, 500i128);
}

#[test]
fn test_cross_asset_transfer() {
    let env = Env::default();
    let admin = Address::random(&env);
    let user1 = Address::random(&env);
    let user2 = Address::random(&env);
    let contract_id = env.register_contract(None, payd::PayDContract);
    let client = PayDContractClient::new(&env, &contract_id);
    
    client.init(&admin);
    
    let asset_a = Address::random(&env);
    let asset_b = Address::random(&env);
    
    client.register_asset(&asset_a, &18u32, &admin);
    client.register_asset(&asset_b, &18u32, &admin);
    
    // Register cross-asset pair with 1:1 rate
    client.register_cross_asset_pair(&asset_a, &asset_b, &10000i128, &admin);
    
    // Set balance for user1 in asset_a
    let balance_key_a = soroban_sdk::Symbol::new(&env, &format!("balance:{}:{}", asset_a.to_string(), user1.to_string()));
    env.storage().temporary().set(&balance_key_a, &1000i128);
    
    // Transfer with cross-asset conversion
    client.transfer(&asset_a, &user1, &user2, &100i128, &Some(asset_b.clone()));
    
    // Verify asset_a balance decreased
    let user1_balance_a: i128 = env.storage().temporary().get(&balance_key_a).unwrap();
    assert_eq!(user1_balance_a, 900i128);
    
    // Verify asset_b balance increased (converted)
    let balance_key_b = soroban_sdk::Symbol::new(&env, &format!("balance:{}:{}", asset_b.to_string(), user2.to_string()));
    let user2_balance_b: i128 = env.storage().temporary().get(&balance_key_b).unwrap();
    assert_eq!(user2_balance_b, 100i128);
}

#[test]
fn test_event_indexing() {
    let env = Env::default();
    let admin = Address::random(&env);
    let contract_id = env.register_contract(None, payd::PayDContract);
    let client = PayDContractClient::new(&env, &contract_id);
    
    client.init(&admin);
    
    let asset = Address::random(&env);
    client.register_asset(&asset, &18u32, &admin);
    
    // Check that events are indexed
    let event_count = payd::events::get_event_count(&env, symbol_short!("asset_registered"));
    assert_eq!(event_count, 1);
}

#[test]
#[should_panic(expected = "InsufficientBalance")]
fn test_insufficient_balance() {
    let env = Env::default();
    let admin = Address::random(&env);
    let user1 = Address::random(&env);
    let user2 = Address::random(&env);
    let contract_id = env.register_contract(None, payd::PayDContract);
    let client = PayDContractClient::new(&env, &contract_id);
    
    client.init(&admin);
    
    let asset = Address::random(&env);
    client.register_asset(&asset, &18u32, &admin);
    
    // Try to transfer more than balance
    client.transfer(&asset, &user1, &user2, &1000i128, &None);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_unauthorized_transfer() {
    let env = Env::default();
    let admin = Address::random(&env);
    let user1 = Address::random(&env);
    let user2 = Address::random(&env);
    let contract_id = env.register_contract(None, payd::PayDContract);
    let client = PayDContractClient::new(&env, &contract_id);
    
    client.init(&admin);
    
    let asset = Address::random(&env);
    client.register_asset(&asset, &18u32, &admin);
    
    // Try to transfer without authorization
    client.transfer(&asset, &user1, &user2, &100i128, &None);
}
