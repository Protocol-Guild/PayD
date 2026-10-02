//! Event indexing system for efficient queryability
//!
//! This module provides optimized event storage and retrieval with
//! indexing capabilities for Soroban contracts.

use soroban_sdk::{Env, Address, Vec, Symbol, Map};

/// Structure for tracking event indices
#[derive(Clone, Debug)]
pub struct EventIndex {
    pub last_index: u32,
    pub total_events: u32,
    pub event_types: Vec<Symbol>,
}

/// Emit an indexed event with metadata
pub fn emit_indexed_event(
    env: &Env,
    event_type: Symbol,
    addresses: Vec<Address>,
    amounts: Vec<i128>,
) {
    // Get or initialize event index
    let indexes_key = Symbol::new(env, "event_indexes");
    let mut indexes: Map<Symbol, EventIndex> = env.storage().persistent().get(&indexes_key).unwrap_or(Map::new(env));
    
    let mut index = indexes.get(&event_type).unwrap_or(EventIndex {
        last_index: 0,
        total_events: 0,
        event_types: Vec::new(env),
    });
    
    // Store the event with its index
    let event_key = format_event_storage_key(env, &event_type, index.last_index);
    env.storage().temporary().set(&event_key, &(addresses.clone(), amounts.clone()));
    
    // Also emit soroban event for off-chain indexing
    soroban_sdk::contract_event(env, event_type.clone(), soroban_sdk::ContractEventData {
        addresses: addresses.clone(),
        amounts: amounts.clone(),
    });
    
    // Update index
    index.last_index += 1;
    index.total_events += 1;
    indexes.set(&event_type, &index);
    
    // Save updated indexes
    env.storage().persistent().set(&indexes_key, &indexes);
}

/// Format storage key for event data
fn format_event_storage_key(env: &Env, event_type: &Symbol, index: u32) -> Symbol {
    let key = format!("evt:{}:{}", event_type.to_string(), index);
    Symbol::new(env, &key)
}

/// Get event count for a specific type
pub fn get_event_count(env: &Env, event_type: Symbol) -> u32 {
    let indexes_key = Symbol::new(env, "event_indexes");
    let indexes: Map<Symbol, EventIndex> = env.storage().persistent().get(&indexes_key).unwrap_or(Map::new(env));
    
    if let Some(index) = indexes.get(&event_type) {
        index.total_events
    } else {
        0
    }
}

/// Retrieve events with efficient pagination
pub fn get_events_paginated(
    env: &Env,
    event_type: Symbol,
    start_index: u32,
    limit: u32,
) -> Vec<(Vec<Address>, Vec<i128>)> {
    let indexes_key = Symbol::new(env, "event_indexes");
    let indexes: Map<Symbol, EventIndex> = env.storage().persistent().get(&indexes_key).unwrap_or(Map::new(env));
    
    let mut results: Vec<(Vec<Address>, Vec<i128>)> = Vec::new(env);
    
    if let Some(index) = indexes.get(&event_type) {
        let end = std::cmp::min(index.last_index, start_index + limit);
        
        for i in start_index..end {
            let event_key = format_event_storage_key(env, &event_type, i);
            if let Some(event_data) = env.storage().temporary().get::<_, (Vec<Address>, Vec<i128>)>(&event_key) {
                results.push((event_data.0, event_data.1));
            }
        }
    }
    
    results
}
