use soroban_sdk::{contract, contractimpl, Env, String, Symbol, Vec, Map, Bytes, BytesN};

#[contract]
pub struct PayDContract;

#[contractimpl]
impl PayDContract {
    // Optimized cross-asset transfer with event indexing
    pub fn cross_asset_transfer(
        env: Env,
        from: BytesN<32>,
        to: BytesN<32>,
        asset: Symbol,
        amount: i128,
        metadata: Map<Symbol, String>,
    ) {
        // Efficiency: Batch storage operations
        let mut storage = env.storage().persistent();
        
        // Validate inputs
        require!(amount > 0, "Amount must be positive");
        require!(asset.len() <= 10, "Asset symbol too long");
        
        // Generate indexed event topics
        let topics = (Symbol::new("transfer"), from.clone(), to.clone(), asset.clone());
        
        // Emit indexed event with metadata
        env.events().publish(
            topics,
            (amount, metadata, env.ledger().timestamp())
        );
        
        // Update balances in single storage operation
        let from_key = (Symbol::new("balance"), from, asset.clone());
        let to_key = (Symbol::new("balance"), to, asset.clone());
        
        let from_balance: i128 = storage.get(&from_key).unwrap_or(0);
        let to_balance: i128 = storage.get(&to_key).unwrap_or(0);
        
        storage.set(&from_key, &(from_balance - amount));
        storage.set(&to_key, &(to_balance + amount));
    }
    
    // Batched multi-asset operations for efficiency
    pub fn batch_operations(
        env: Env,
        operations: Vec<(BytesN<32>, BytesN<32>, Symbol, i128)>
    ) {
        let mut storage = env.storage().persistent();
        let mut events = Vec::new(env);
        
        // Process all operations in single transaction context
        for op in operations.iter() {
            let (from, to, asset, amount) = op;
            
            // Update balances
            let from_key = (Symbol::new("balance"), from.clone(), asset.clone());
            let to_key = (Symbol::new("balance"), to.clone(), asset.clone());
            
            let from_balance: i128 = storage.get(&from_key).unwrap_or(0);
            let to_balance: i128 = storage.get(&to_key).unwrap_or(0);
            
            storage.set(&from_key, &(from_balance - amount));
            storage.set(&to_key, &(to_balance + amount));
            
            // Collect events for batch publishing
            events.push_back((Symbol::new("transfer"), from.clone(), to.clone(), asset.clone(), amount));
        }
        
        // Emit batched events for better indexing
        for event in events.iter() {
            let (event_type, from, to, asset, amount) = event;
            env.events().publish(
                (event_type, from, to, asset),
                (amount, env.ledger().timestamp())
            );
        }
    }
    
    // Optimized asset metadata storage with event indexing
    pub fn update_asset_metadata(
        env: Env,
        asset: Symbol,
        metadata: Map<Symbol, String>
    ) {
        let storage = env.storage().persistent();
        let key = (Symbol::new("asset_meta"), asset.clone());
        
        // Emit metadata update event with indexed asset symbol
        env.events().publish(
            (Symbol::new("metadata_update"), asset.clone()),
            (metadata.clone(), env.ledger().timestamp())
        );
        
        storage.set(&key, &metadata);
    }
    
    // Efficient query with indexed events
    pub fn get_transaction_history(
        env: Env,
        user: BytesN<32>,
        asset: Symbol,
        limit: u32
    ) -> Vec<(Symbol, BytesN<32>, BytesN<32>, i128, u64)> {
        // Use event-based indexing for efficient queries
        let mut results = Vec::new(env);
        let events = env.events().filter_by_topic(Symbol::new("transfer"), user.clone());
        
        for event in events.iter().take(limit as usize) {
            if let Some((from, to, event_asset)) = event.topic() {
                if event_asset == asset {
                    if let Some((amount, _, timestamp)) = event.data() {
                        results.push_back((event_asset, from, to, amount, timestamp));
                    }
                }
            }
        }
        
        results
    }
}

// Helper functions for efficiency
impl PayDContract {
    fn require(condition: bool, message: &str) {
        if !condition {
            panic!("{}", message);
        }
    }
}
