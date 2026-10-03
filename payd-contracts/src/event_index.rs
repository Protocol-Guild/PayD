use soroban_sdk::{
    contract, contractimpl, log, Address, Env, Map, Symbol, u64,
};
use crate::cross_asset::CrossAssetEvent;

/// Event indexer for efficient query and retrieval
#[contract]
pub struct EventIndexer;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, ext_event)]
pub enum EventIndexerError {
    EventNotFound = 3001,
    IndexingFailed = 3002,
}

#[derive(Clone, Debug)]
pub struct IndexedEvent {
    pub event_id: u64,
    pub event_type: Symbol,
    pub timestamp: u64,
    pub asset_a: Symbol,
    pub asset_b: Symbol,
    pub amount_in: i128,
    pub amount_out: i128,
    pub participant: Address,
    pub block_height: u64,
}

#[contractimpl]
impl EventIndexer {
    /// Index a new event with automatic ID assignment
    pub fn index_event(env: Env, event: CrossAssetEvent) -> Result<u64, EventIndexerError> {
        let event_id = Self::get_next_event_id(&env);
        
        let indexed = IndexedEvent {
            event_id,
            event_type: Symbol::from_str(&env, &event.event_type),
            timestamp: event.timestamp,
            asset_a: event.source_asset,
            asset_b: event.target_asset,
            amount_in: event.amount_in,
            amount_out: event.amount_out,
            participant: event.recipient,
            block_height: env.ledger().sequence(),
        };

        // Store indexed event
        env.storage().persistent().set(&Self::event_key(event_id), &indexed);
        
        // Update indexes for efficient querying
        Self::index_by_timestamp(&env, event.timestamp, event_id)?;
        Self::index_by_asset(&env, &event.source_asset, event_id)?;
        Self::index_by_asset(&env, &event.target_asset, event_id)?;
        Self::index_by_participant(&env, &event.recipient, event_id)?;

        // Increment event counter
        Self::increment_event_id(&env);

        log!(&env, "event_indexed: id={}", event_id);
        Ok(event_id)
    }

    /// Retrieve indexed event by ID
    pub fn retrieve_event(env: Env, event_id: u64) -> Result<IndexedEvent, EventIndexerError> {
        match env.storage().persistent().get(&Self::event_key(event_id)) {
            Some(event) => Ok(event),
            None => Err(EventIndexerError::EventNotFound),
        }
    }

    /// Retrieve and index from raw event data
    pub fn retrieve_and_index(
        env: &Env,
        event_id: &u64,
    ) -> Result<Option<IndexedEvent>, EventIndexerError> {
        // First try to retrieve existing indexed event
        match Self::retrieve_event(env.clone(), *event_id) {
            Ok(event) => Ok(Some(event)),
            Err(EventIndexerError::EventNotFound) => {
                // Try to find and index from raw events
                // Implementation would scan raw event logs
                log!(env, "event_not_found: id={}", event_id);
                Ok(None)
            }
        }
    }

    /// Query events by timestamp range
    pub fn query_by_timestamp(
        env: Env,
        start_timestamp: u64,
        end_timestamp: u64,
    ) -> Result<Vec<u64>, EventIndexerError> {
        let mut event_ids = Vec::new(&env);
        
        // Query timestamp index
        let timestamp_key = Self::timestamp_index_key(start_timestamp);
        if let Some(ids) = env.storage().persistent().get(&timestamp_key) {
            event_ids = ids;
        }

        Ok(event_ids)
    }

    /// Query events by asset pair
    pub fn query_by_asset(
        env: Env,
        asset: &Symbol,
    ) -> Result<Vec<u64>, EventIndexerError> {
        let mut event_ids = Vec::new(&env);
        
        let asset_key = Self::asset_index_key(asset);
        if let Some(ids) = env.storage().persistent().get(&asset_key) {
            event_ids = ids;
        }

        Ok(event_ids)
    }

    /// Query events by participant address
    pub fn query_by_participant(
        env: Env,
        participant: &Address,
    ) -> Result<Vec<u64>, EventIndexerError> {
        let mut event_ids = Vec::new(&env);
        
        let participant_key = Self::participant_index_key(participant);
        if let Some(ids) = env.storage().persistent().get(&participant_key) {
            event_ids = ids;
        }

        Ok(event_ids)
    }
}

// Private helper functions

impl EventIndexer {
    fn get_next_event_id(env: &Env) -> u64 {
        match env.storage().persistent().get(&Self::event_id_key()) {
            Some(id) => id,
            None => 1,
        }
    }

    fn increment_event_id(env: &Env) {
        let current_id = Self::get_next_event_id(env);
        env.storage().persistent().set(&Self::event_id_key(), &(current_id + 1));
    }

    fn index_by_timestamp(env: &Env, timestamp: u64, event_id: u64) -> Result<(), EventIndexerError> {
        let key = Self::timestamp_index_key(timestamp);
        let mut ids: Vec<u64> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
        ids.push_back(event_id);
        env.storage().persistent().set(&key, &ids);
        Ok(())
    }

    fn index_by_asset(env: &Env, asset: &Symbol, event_id: u64) -> Result<(), EventIndexerError> {
        let key = Self::asset_index_key(asset);
        let mut ids: Vec<u64> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
        ids.push_back(event_id);
        env.storage().persistent().set(&key, &ids);
        Ok(())
    }

    fn index_by_participant(env: &Env, participant: &Address, event_id: u64) -> Result<(), EventIndexerError> {
        let key = Self::participant_index_key(participant);
        let mut ids: Vec<u64> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
        ids.push_back(event_id);
        env.storage().persistent().set(&key, &ids);
        Ok(())
    }

    fn event_key(event_id: u64) -> Symbol {
        Symbol::from_str(&format!("evt_{}", event_id))
    }

    fn event_id_key() -> Symbol {
        Symbol::from_str("next_event_id")
    }

    fn timestamp_index_key(timestamp: u64) -> Symbol {
        Symbol::from_str(&format!("ts_{}", timestamp))
    }

    fn asset_index_key(asset: &Symbol) -> Symbol {
        Symbol::from_str(&format!("asset_{}", asset))
    }

    fn participant_index_key(participant: &Address) -> Symbol {
        Symbol::from_str(&format!("part_{}", participant.to_string()))
    }
}
