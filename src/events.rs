use soroban_sdk::{contract, events::Event, Address, Map, String, Symbol};

#[contract]
pub struct IndexedEvents;

impl IndexedEvents {
    // Optimized event structure for better indexing
    pub fn create_asset_event(env: &Env, user: Address, asset: Symbol, metadata: Map<String, String>) -> Event {
        Event::new(env, (Symbol::new("asset_created"), user))
            .with_data((asset, metadata, env.ledger().timestamp()))
    }

    pub fn create_transfer_event(env: &Env, from: Address, to: Address, asset: Symbol, amount: i128) -> Event {
        Event::new(env, (Symbol::new("asset_transferred"), from, to))
            .with_data((asset, amount, env.ledger().timestamp()))
    }

    // Event for cross-asset operations
    pub fn create_cross_asset_event(env: &Env, user: Address, primary_asset: Symbol, secondary_assets: Vec<Symbol>) -> Event {
        Event::new(env, (Symbol::new("cross_asset_operation"), user))
            .with_data((primary_asset, secondary_assets, env.ledger().timestamp()))
    }
}
