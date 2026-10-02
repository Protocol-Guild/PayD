#![no_std]

use soroban_sdk::{
    contract, contractimpl, contractevent, Env, Address, Symbol, Val, Map, Vec,
    token::Client as TokenClient,
};

#[contractevent]
pub struct PaymentExecuted {
    #[topic]
    pub event_type: Symbol,
    #[topic]
    pub asset: Address,
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct CrossAssetSwap {
    #[topic]
    pub event_type: Symbol,
    #[topic]
    pub from_asset: Address,
    #[topic]
    pub to_asset: Address,
    #[topic]
    pub user: Address,
    pub in_amount: i128,
    pub out_amount: i128,
}

const ADMIN_KEY: Symbol = Symbol::new(&soroban_sdk::Env::default(), "admin");
const BALANCES_KEY: Symbol = Symbol::new(&soroban_sdk::Env::default(), "balances");
const ASSET_REGISTRY_KEY: Symbol = Symbol::new(&soroban_sdk::Env::default(), "assets");

#[contract]
pub struct PayD;

#[contractimpl]
impl PayD {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().persistent().set(&ADMIN_KEY, &admin);
        env.storage().persistent().set(&BALANCES_KEY, &Map::<(Address, Address), i128>::new(&env));
        env.storage().persistent().set(&ASSET_REGISTRY_KEY, &Vec::<Address>::new(&env));
        env.storage().persistent().extend_ttl(&ADMIN_KEY, 1000, 5000);
    }

    pub fn register_asset(env: Env, admin: Address, asset: Address) {
        let stored_admin: Address = env.storage().persistent().get(&ADMIN_KEY).expect("admin not set");
        if stored_admin != admin {
            panic!("unauthorized");
        }
        admin.require_auth();
        let mut assets: Vec<Address> = env.storage().persistent().get(&ASSET_REGISTRY_KEY).unwrap_or(Vec::new(&env));
        if !assets.contains(&asset) {
            assets.push_back(asset.clone());
            env.storage().persistent().set(&ASSET_REGISTRY_KEY, &assets);
            env.events().publish(
                (Symbol::new(&env, "asset_registered"), asset.into_val(&env)),
                (),
            );
        }
    }

    pub fn deposit(env: Env, user: Address, asset: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let token = TokenClient::new(&env, &asset);
        token.transfer(&user, &env.current_contract_address(&env), &amount);

        let mut balances: Map<(Address, Address), i128> = env
            .storage()
            .persistent()
            .get(&BALANCES_KEY)
            .unwrap_or(Map::new(&env));
        let key = (user.clone(), asset.clone());
        let current = balances.get(key.clone()).unwrap_or(0);
        balances.set(key, current + amount);

        env.storage().persistent().set(&BALANCES_KEY, &balances);
        env.storage().persistent().extend_ttl(&BALANCES_KEY, 1000, 5000);

        PaymentExecuted {
            event_type: Symbol::new(&env, "deposit"),
            asset,
            from: user.clone(),
            to: env.current_contract_address(&env),
            amount,
        }
        .publish(&env);
    }

    pub fn withdraw(env: Env, user: Address, asset: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let mut balances: Map<(Address, Address), i128> = env
            .storage()
            .persistent()
            .get(&BALANCES_KEY)
            .expect("balances not initialized");
        let key = (user.clone(), asset.clone());
        let current = balances.get(key.clone()).unwrap_or(0);
        if current < amount {
            panic!("insufficient balance");
        }
        balances.set(key, current - amount);
        env.storage().persistent().set(&BALANCES_KEY, &balances);
        env.storage().persistent().extend_ttl(&BALANCES_KEY, 1000, 5000);

        let token = TokenClient::new(&env, &asset);
        token.transfer(&env.current_contract_address(&env), &user, &amount);

        PaymentExecuted {
            event_type: Symbol::new(&env, "withdraw"),
            asset,
            from: env.current_contract_address(&env),
            to: user,
            amount,
        }
        .publish(&env);
    }

    pub fn cross_asset_transfer(
        env: Env,
        user: Address,
        from_asset: Address,
        to_asset: Address,
        amount_in: i128,
        min_amount_out: i128,
    ) {
        user.require_auth();
        if amount_in <= 0 {
            panic!("amount must be positive");
        }

        let mut balances: Map<(Address, Address), i128> = env
            .storage()
            .persistent()
            .get(&BALANCES_KEY)
            .expect("balances not initialized");
        let from_key = (user.clone(), from_asset.clone());
        let from_balance = balances.get(from_key.clone()).unwrap_or(0);
        if from_balance < amount_in {
            panic!("insufficient from_asset balance");
        }
        balances.set(from_key, from_balance - amount_in);

        // Simplified cross-asset logic: 1:1 for demo, replace with oracle/pool
        let amount_out = amount_in;
        if amount_out < min_amount_out {
            panic!("slippage");
        }

        let to_key = (user.clone(), to_asset.clone());
        let to_balance = balances.get(to_key.clone()).unwrap_or(0);
        balances.set(to_key, to_balance + amount_out);

        env.storage().persistent().set(&BALANCES_KEY, &balances);
        env.storage().persistent().extend_ttl(&BALANCES_KEY, 1000, 5000);

        CrossAssetSwap {
            event_type: Symbol::new(&env, "cross_asset_swap"),
            from_asset,
            to_asset,
            user: user.clone(),
            in_amount: amount_in,
            out_amount: amount_out,
        }
        .publish(&env);

        env.events().publish(
            (
                Symbol::new(&env, "cross_asset"),
                from_asset.into_val(&env),
                to_asset.into_val(&env),
                user.into_val(&env),
            ),
            (amount_in, amount_out),
        );
    }

    pub fn balance(env: Env, user: Address, asset: Address) -> i128 {
        let balances: Map<(Address, Address), i128> = env
            .storage()
            .persistent()
            .get(&BALANCES_KEY)
            .unwrap_or(Map::new(&env));
        balances.get((user, asset)).unwrap_or(0)
    }
}
