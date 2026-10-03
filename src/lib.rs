use soroban_sdk::{contract, contractimpl, Address, Env, Map, Symbol, Vec};

#[contract]
pub struct PayDContract;

#[contractimpl]
impl PayDContract {
    // Efficient storage using Map for O(1) lookups
    pub fn store_payment(env: Env, from: Address, to: Address, amount: i128, asset: Symbol) -> bool {
        let key = (from.clone(), to.clone(), asset.clone());
        let mut payments: Map<(Address, Address, Symbol), i128> = Map::new(&env);
        
        let current_amount = payments.get(key.clone()).unwrap_or(0);
        let new_amount = current_amount + amount;
        
        payments.set(key, new_amount);
        
        // Emit indexed event for efficient querying
        env.events().publish(
            (Symbol::new(&env, "payment"), from.clone(), to.clone(), asset.clone()),
            (amount, new_amount)
        );
        
        true
    }
    
    // Cross-asset logic with efficient conversion
    pub fn convert_asset(
        env: Env, 
        from: Address, 
        from_asset: Symbol, 
        to_asset: Symbol, 
        from_amount: i128
    ) -> i128 {
        let rates: Map<Symbol, f64> = Map::new(&env);
        let from_rate = rates.get(from_asset.clone()).unwrap_or(1.0);
        let to_rate = rates.get(to_asset.clone()).unwrap_or(1.0);
        
        // Efficient cross-asset calculation
        let base_value = (from_amount as f64) * from_rate;
        let converted_amount = (base_value / to_rate) as i128;
        
        // Emit conversion event
        env.events().publish(
            (Symbol::new(&env, "conversion"), from_asset, to_asset),
            (from_amount, converted_amount)
        );
        
        converted_amount
    }
    
    // Batch processing for efficiency
    pub fn batch_payments(env: Env, payments: Vec<(Address, Address, i128, Symbol)>) -> bool {
        for payment in payments.iter() {
            let (from, to, amount, asset) = payment;
            Self::store_payment(env.clone(), from, to, amount, asset);
        }
        true
    }
}
