use soroban_sdk::{contracttype, Address, Env, Map, Symbol, vec, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Balances(Address),
    Rates(Symbol, Symbol),
    Admin,
}

pub const BALANCES_KEY: &str = "balances";

pub fn init(env: &Env) {
    let admin = env.current_contract_address();
    env.storage().persistent().set(&StorageKey::Admin, &admin);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&StorageKey::Admin)
        .expect("Admin not set")
}

pub fn get_map(env: &Env, addr: &Address, key: &str) -> Map<Address, i128> {
    let storage_key = format!("{}/{}", key, addr.to_string());
    env.storage()
        .persistent()
        .get::<_, Map<Address, i128>>(&storage_key)
        .unwrap_or(Map::new(env))
}

pub fn set_map(env: &Env, addr: &Address, key: &str, value: &Map<Address, i128>) {
    let storage_key = format!("{}/{}", key, addr.to_string());
    env.storage().persistent().set(&storage_key, value);
}

pub fn set_rate(env: &Env, from: &Symbol, to: &Symbol, rate: i128) {
    let key = StorageKey::Rates((*from).clone(), (*to).clone());
    env.storage().persistent().set(&key, &rate);
}

pub fn get_rate(env: &Env, from: &Symbol, to: &Symbol) -> i128 {
    let key = StorageKey::Rates((*from).clone(), (*to).clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(1_000_000_000) // Default 1:1 rate
}
