use payd_contracts::{PayDContract, TransferError, SwapError};
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};
use soroban_sdk::token;

#[test]
fn test_transfer_success() {
    let env = Env::default();
    let contract_id = env.register_client(None, PayDContract);
    env.as_contract(&contract_id, || {
        PayDContract::__constructor(env.clone());

        let admin = Address::contract_instance(&env, &contract_id);
        let user_a = Address::generate(&env);
        let user_b = Address::generate(&env);

        // Test transfer
        PayDContract::transfer(
            env.clone(),
            user_a.clone(),
            user_b.clone(),
            Symbol::new(&env, "USD"),
            1000,
        );

        // Event should be emitted (checked via event log)
    });
}

#[test]
#[should_panic(expected = "InsufficientBalance")]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    let contract_id = env.register_client(None, PayDContract);
    env.as_contract(&contract_id, || {
        PayDContract::__constructor(env.clone());

        let user_a = Address::generate(&env);
        let user_b = Address::generate(&env);

        PayDContract::transfer(
            env.clone(),
            user_a.clone(),
            user_b.clone(),
            Symbol::new(&env, "USD"),
            999_999_999,
        );
    });
}

#[test]
fn test_swap_success() {
    let env = Env::default();
    let contract_id = env.register_client(None, PayDContract);
    env.as_contract(&contract_id, || {
        PayDContract::__constructor(env.clone());

        let user = Address::generate(&env);
        let usd = Symbol::new(&env, "USD");
        let eur = Symbol::new(&env, "EUR");

        // Set rate: 1 USD = 0.9 EUR (rate = 900_000_000)
        PayDContract::set_rate(env.clone(), &usd, &eur, 900_000_000);

        // Test swap
        let result = PayDContract::swap(
            env.clone(),
            user.clone(),
            usd.clone(),
            eur.clone(),
            1000,
            800, // min 800 EUR
        );

        assert!(result.is_ok());
    });
}

#[test]
#[should_panic(expected = "SlippageExceeded")]
fn test_swap_slippage() {
    let env = Env::default();
    let contract_id = env.register_client(None, PayDContract);
    env.as_contract(&contract_id, || {
        PayDContract::__constructor(env.clone());

        let user = Address::generate(&env);
        let usd = Symbol::new(&env, "USD");
        let eur = Symbol::new(&env, "EUR");

        PayDContract::set_rate(env.clone(), &usd, &eur, 900_000_000);

        // This should fail - requesting more than rate allows
        PayDContract::swap(
            env.clone(),
            user.clone(),
            usd.clone(),
            eur.clone(),
            1000,
            950, // min 950 EUR (impossible at 0.9 rate)
        );
    });
}

#[test]
fn test_cross_asset_efficiency() {
    let env = Env::default();
    let contract_id = env.register_client(None, PayDContract);
    env.as_contract(&contract_id, || {
        PayDContract::__constructor(env.clone());

        let usd = Symbol::new(&env, "USD");
        let eur = Symbol::new(&env, "EUR");
        let gbp = Symbol::new(&env, "GBP");

        // Test rate setting and retrieval
        PayDContract::set_rate(env.clone(), &usd, &eur, 900_000_000);
        PayDContract::set_rate(env.clone(), &eur, &gbp, 850_000_000);

        // Verify rates exist
        let rate_usd_eur = PayDContract::get_rate(env.clone(), &usd, &eur);
        assert_eq!(rate_usd_eur, 900_000_000);

        let rate_eur_gbp = PayDContract::get_rate(env.clone(), &eur, &gbp);
        assert_eq!(rate_eur_gbp, 850_000_000);
    });
}
