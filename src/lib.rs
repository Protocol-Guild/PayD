#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Map, Symbol, Vec};

#[contract]
pub struct PayDContract;

#[contractimpl]
impl PayDContract {
    /// Initialize the contract with owner and initial configuration
    pub fn init(env: Env, owner: Address) {
        let key = Symbol::new("owner");
        env.storage().instance().set(&key, &owner);
        
        // Initialize event counter for indexing
        let event_counter_key = Symbol::new("event_counter");
        env.storage().instance().set(&event_counter_key, &0u64);
        
        // Initialize asset registry
        let assets_key = Symbol::new("assets");
        let assets: Map<Symbol, Address> = Map::new(&env);
        env.storage().instance().set(&assets_key, &assets);
    }

    /// Efficient asset registration with validation
    pub fn register_asset(env: Env, asset_symbol: Symbol, asset_address: Address) {
        let owner: Address = env.storage().instance().get(&Symbol::new("owner")).unwrap();
        owner.require_auth();

        // Validate asset address
        if asset_address == Address::from_str("GA3S...") {
            panic!("Invalid asset address");
        }

        let assets_key = Symbol::new("assets");
        let mut assets: Map<Symbol, Address> = env.storage().instance().get(&assets_key).unwrap();
        
        if assets.contains_key(asset_symbol.clone()) {
            panic!("Asset already registered");
        }

        assets.set(asset_symbol, asset_address);
        env.storage().instance().set(&assets_key, &assets);

        // Emit indexed event
        Self::emit_asset_registered_event(&env, asset_symbol, asset_address);
    }

    /// Cross-asset transfer with efficiency optimizations
    pub fn cross_asset_transfer(
        env: Env,
        from: Address,
        to: Address,
        asset_symbol: Symbol,
        amount: i128,
    ) {
        from.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let assets: Map<Symbol, Address> = env.storage().instance().get(&Symbol::new("assets")).unwrap();
        let asset_address = assets.get(asset_symbol.clone()).expect("Asset not registered");

        // Efficient balance check using cached balances
        let balance_key = (from.clone(), asset_symbol.clone());
        let balance: i128 = env.storage().instance().get(&balance_key).unwrap_or(0);
        
        if balance < amount {
            panic!("Insufficient balance");
        }

        // Update balances atomically
        let new_from_balance = balance - amount;
        let to_balance_key = (to.clone(), asset_symbol.clone());
        let to_balance: i128 = env.storage().instance().get(&to_balance_key).unwrap_or(0);
        let new_to_balance = to_balance + amount;

        env.storage().instance().set(&balance_key, &new_from_balance);
        env.storage().instance().set(&to_balance_key, &new_to_balance);

        // Emit indexed transfer event
        Self::emit_transfer_event(&env, from, to, asset_symbol, amount);
    }

    /// Batch operations for gas efficiency
    pub fn batch_transfer(
        env: Env,
        from: Address,
        transfers: Vec<(Address, Symbol, i128)>,
    ) {
        from.require_auth();

        for transfer in transfers.iter() {
            let (to, asset_symbol, amount) = transfer;
            Self::cross_asset_transfer(env.clone(), from.clone(), to, asset_symbol, amount);
        }
    }

    /// Event emission with proper indexing
    fn emit_asset_registered_event(env: &Env, asset_symbol: Symbol, asset_address: Address) {
        let event_counter_key = Symbol::new("event_counter");
        let counter: u64 = env.storage().instance().get(&event_counter_key).unwrap_or(0);
        let new_counter = counter + 1;
        env.storage().instance().set(&event_counter_key, &new_counter);

        let mut topics = Vec::new(&env);
        topics.push_back(Symbol::new("AssetRegistered"));
        topics.push_back(asset_symbol);
        
        env.events().publish(topics, (asset_address, new_counter));
    }

    fn emit_transfer_event(
        env: &Env,
        from: Address,
        to: Address,
        asset_symbol: Symbol,
        amount: i128,
    ) {
        let event_counter_key = Symbol::new("event_counter");
        let counter: u64 = env.storage().instance().get(&event_counter_key).unwrap_or(0);
        let new_counter = counter + 1;
        env.storage().instance().set(&event_counter_key, &new_counter);

        let mut topics = Vec::new(&env);
        topics.push_back(Symbol::new("Transfer"));
        topics.push_back(from);
        topics.push_back(to);
        topics.push_back(asset_symbol);
        
        env.events().publish(topics, (amount, new_counter));
    }

    /// Query functions with efficient data access
    pub fn get_balance(env: Env, address: Address, asset_symbol: Symbol) -> i128 {
        let balance_key = (address, asset_symbol);
        env.storage().instance().get(&balance_key).unwrap_or(0)
    }

    pub fn get_registered_assets(env: Env) -> Map<Symbol, Address> {
        env.storage().instance().get(&Symbol::new("assets")).unwrap_or(Map::new(&env))
    }
}
