use soroban_sdk::{Symbol, Vec, Map, String};

// Optimized event structures for better indexing
pub struct TransferEvent {
    pub event_type: Symbol,
    pub from: BytesN<32>,
    pub to: BytesN<32>,
    pub asset: Symbol,
    pub amount: i128,
    pub metadata: Map<Symbol, String>,
    pub timestamp: u64,
}

impl TransferEvent {
    pub fn new(
        from: BytesN<32>,
        to: BytesN<32>,
        asset: Symbol,
        amount: i128,
        metadata: Map<Symbol, String>,
        timestamp: u64,
    ) -> Self {
        Self {
            event_type: Symbol::new("transfer"),
            from,
            to,
            asset,
            amount,
            metadata,
            timestamp,
        }
    }
    
    // Optimized topic generation for event indexing
    pub fn topics(&self) -> (Symbol, BytesN<32>, BytesN<32>, Symbol) {
        (self.event_type.clone(), self.from.clone(), self.to.clone(), self.asset.clone())
    }
    
    pub fn data(&self) -> (i128, Map<Symbol, String>, u64) {
        (self.amount, self.metadata.clone(), self.timestamp)
    }
}

// Batch event processor for efficiency
pub struct BatchEventProcessor;

impl BatchEventProcessor {
    pub fn process_batch(env: &Env, events: Vec<TransferEvent>) {
        for event in events.iter() {
            env.events().publish(
                &event.topics(),
                &event.data()
            );
        }
    }
}
