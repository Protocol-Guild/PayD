use soroban_sdk::{Env, String, Symbol, Vec, Map};
use crate::contract::PayDContract;

#[test]
fn test_cross_asset_transfer() {
    let env = Env::default();
    let contract = PayDContract::new(&env);

    // Setup initial balances
    let alice = String::from_slice("alice");
    let bob = String::from_slice("bob");
    let asset = Symbol::from_slice("USD");

    contract.initialize_balance(alice.clone(), asset.clone(), 1000);
    contract.initialize_balance(bob.clone(), asset.clone(), 500);

    // Test transfer
    contract.cross_asset_transfer(
        alice.clone(),
        bob.clone(),
        300,
        asset.clone(),
    );

    // Verify balances
    let balances = contract.get_balances(
        vec![&env, alice.clone(), bob.clone()],
        asset.clone(),
    );

    assert_eq!(balances.get(alice.clone()).unwrap(), 700);
    assert_eq!(balances.get(bob.clone()).unwrap(), 800);
}

#[test]
fn test_insufficient_balance() {
    let env = Env::default();
    let contract = PayDContract::new(&env);

    let alice = String::from_slice("alice");
    let bob = String::from_slice("bob");
    let asset = Symbol::from_slice("USD");

    contract.initialize_balance(alice.clone(), asset.clone(), 100);

    let result = std::panic::catch_unwind(|| {
        contract.cross_asset_transfer(
            alice.clone(),
            bob.clone(),
            200,
            asset.clone(),
        );
    });

    assert!(result.is_err());
}
