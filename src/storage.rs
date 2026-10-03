use soroban_sdk::{Address, Map, Symbol};

pub struct PaymentStorage;

impl PaymentStorage {
    pub fn get_payment(env: &soroban_sdk::Env, from: &Address, to: &Address, asset: &Symbol) -> Option<i128> {
        let payments: Map<(Address, Address, Symbol), i128> = Map::new(env);
        payments.get((from.clone(), to.clone(), asset.clone()))
    }
    
    pub fn update_payment(env: &soroban_sdk::Env, from: &Address, to: &Address, asset: &Symbol, amount: i128) {
        let mut payments: Map<(Address, Address, Symbol), i128> = Map::new(env);
        payments.set((from.clone(), to.clone(), asset.clone()), amount);
    }
}
