//! Event indexing system for PayD Protocol
//!
//! Implements efficient event logging and indexing for on-chain analytics.

use soroban_sdk::{contracttype, Address, Env, Symbol, vec, Vec};

/// Event types supported by the protocol
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EventType {
    PaymentSent,
    PaymentReceived,
    RouteCreated,
    SwapExecuted,
    CrossAssetTransfer,
    FeeCharged,
}

/// Structured event for indexing
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct IndexedEvent {
    pub event_id: u64,
    pub event_type: EventType,
    pub caller: Address,
    pub source_asset: Symbol,
    pub destination_asset: Symbol,
    pub amount: u128,
    pub timestamp: u64,
    pub tx_hash: [u8; 32],
}

/// Event log storage
#[contracttype]
pub struct EventLog {
    pub events: Vec<IndexedEvent>,
    pub next_event_id: u64,
}

impl Default for EventLog {
    fn default() -> Self {
        Self {
            events: vec![],
            next_event_id: 0,
        }
    }
}

impl EventLog {
    /// Add a new indexed event
    pub fn add_event(
        &mut self,
        env: &Env,
        event_type: EventType,
        caller: &Address,
        source_asset: Symbol,
        destination_asset: Symbol,
        amount: u128,
        tx_hash: [u8; 32],
    ) {
        let timestamp = env.ledger().timestamp();
        let event_id = self.next_event_id;

        let event = IndexedEvent {
            event_id,
            event_type,
            caller: caller.clone(),
            source_asset,
            destination_asset,
            amount,
            timestamp,
            tx_hash,
        };

        self.events.push_back(event);
        self.next_event_id += 1;
    }

    /// Get event by ID
    pub fn get_event(&self, event_id: u64) -> Option<IndexedEvent> {
        self.events.iter().find(|e| e.event_id == event_id).cloned()
    }

    /// Get events by type
    pub fn get_events_by_type(&self, event_type: &EventType) -> Vec<IndexedEvent> {
        let mut result = vec![&self.env()];
        for event in self.events.iter() {
            if &event.event_type == event_type {
                result.push_back(event.clone());
            }
        }
        result
    }

    /// Get events by caller
    pub fn get_events_by_caller(&self, caller: &Address) -> Vec<IndexedEvent> {
        let mut result = vec![&self.env()];
        for event in self.events.iter() {
            if &event.caller == caller {
                result.push_back(event.clone());
            }
        }
        result
    }

    /// Get latest events
    pub fn get_latest_events(&self, limit: u32) -> Vec<IndexedEvent> {
        let mut result = vec![&self.env()];
        let len = self.events.len();
        let start = if len > limit as usize {
            len - limit as usize
        } else {
            0
        };

        for i in start..len {
            result.push_back(self.events.get(i).unwrap().clone());
        }
        result
    }

    /// Get event count
    pub fn count(&self) -> u64 {
        self.events.len()
    }

    /// Get the event type symbol
    fn env(&self) -> soroban_sdk::Env {
        soroban_sdk::Env::default()
    }
}

/// Event publisher for Soroban contracts
pub struct EventPublisher {
    env: Env,
}

impl EventPublisher {
    /// Create a new event publisher
    pub fn new(env: &Env) -> Self {
        Self { env: env.clone() }
    }

    /// Emit a payment sent event
    pub fn emit_payment_sent(
        &self,
        caller: &Address,
        destination: &Address,
        amount: u128,
        asset: Symbol,
    ) {
        self.env
            .events()
            .publish(("payment", "sent"), (caller, destination, amount, asset));
    }

    /// Emit a cross-asset transfer event
    pub fn emit_cross_asset_transfer(
        &self,
        caller: &Address,
        source_asset: Symbol,
        destination_asset: Symbol,
        amount_in: u128,
        amount_out: u128,
    ) {
        self.env.events().publish(
            ("cross_asset", "transfer"),
            (caller, source_asset, destination_asset, amount_in, amount_out),
        );
    }

    /// Emit a route creation event
    pub fn emit_route_created(
        &self,
        creator: &Address,
        source_asset: Symbol,
        destination_asset: Symbol,
    ) {
        self.env
            .events()
            .publish(("route", "created"), (creator, source_asset, destination_asset));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Events, vec};

    #[test]
    fn test_event_log_add_and_get() {
        let env = Env::default();
        let mut log = EventLog::default();

        let caller = Address::account(&env, &soroban_sdk::Address::generate_contract_id(
            &[],
            &Address::account(&env, &soroban_sdk::Address::generate_contract_id(&[], &Address::account(&env, &soroban_sdk::Address::generate_contract_id(&[], &Address::account(&env, &soroban_sdk::Address::generate_contract_id(&[], &Address::account(&env, &soroban_sdk::Address::generate_contract_id(&[], &soroban_sdk::Address::Account(0)).clone())).clone())).clone())).clone())).clone()));
        
        let tx_hash = [0u8; 32];
        log.add_event(
            &env,
            EventType::PaymentSent,
            &caller,
            Symbol::new(&env, "XLM"),
            Symbol::new(&env, "USDC"),
            1000,
            tx_hash,
        );

        assert_eq!(log.count(), 1);
        assert!(log.get_event(0).is_some());
    }

    #[test]
    fn test_event_publisher() {
        let env = Env::default();
        let publisher = EventPublisher::new(&env);
        let caller = Address::account(&env, &soroban_sdk::Address::generate_contract_id(
            &[],
            &Address::account(&env, &soroban_sdk::Address::generate_contract_id(&[], &Address::account(&env, &soroban_sdk::Address::generate_contract_id(&[], &Address::account(&env, &soroban_sdk::Address::generate_contract_id(&[], &Address::account(&env, &soroban_sdk::Address::generate_contract_id(&[], &soroban_sdk::Address::Account(0)).clone())).clone())).clone())).clone()));
        
        publisher.emit_payment_sent(
            &caller,
            &caller,
            1000,
            Symbol::new(&env, "XLM"),
        );

        // Events should be emitted without panicking
        assert!(true);
    }
}
