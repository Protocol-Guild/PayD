//! Core type definitions for PayD Protocol
//!
//! Provides type-safe representations for assets, amounts, and routing data.

use soroban_sdk::{Address, Symbol, vec, Vec};
use stellar_asset_framework::SapContractId;

/// Represents a blockchain asset identifier
#[derive(Clone, Debug)]
pub enum AssetId {
    Native,
    Token {
        contract_id: SapContractId,
        symbol: Symbol,
    },
}

impl AssetId {
    /// Convert to display name
    pub fn display_name(&self) -> String {
        match self {
            AssetId::Native => "XLM".to_string(),
            AssetId::Token { symbol, .. } => symbol.to_string(),
        }
    }
}

/// Amount with precision handling
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Amount {
    pub value: u128,
    pub decimals: u32,
}

impl Amount {
    /// Create a new amount
    pub const fn new(value: u128, decimals: u32) -> Self {
        Self { value, decimals }
    }

    /// Convert to base units
    pub fn to_base(self) -> u128 {
        self.value
    }
}

/// Payment route configuration
#[derive(Clone, Debug)]
pub struct RouteConfig {
    pub source_asset: AssetId,
    pub destination_asset: AssetId,
    pub max_slippage: u32,
    pub timeout_blocks: u32,
}

/// Event log entry
#[derive(Clone, Debug)]
pub struct LogEntry {
    pub event_type: Symbol,
    pub data: Vec<Symbol>,
    pub timestamp: u64,
}

impl LogEntry {
    /// Create a new log entry
    pub const fn new(event_type: Symbol, data: Vec<Symbol>, timestamp: u64) -> Self {
        Self {
            event_type,
            data,
            timestamp,
        }
    }
}

/// Routing path for cross-asset transactions
#[derive(Clone, Debug)]
pub struct RoutingPath {
    pub hops: Vec<(AssetId, AssetId)>,
    pub fee_bps: u32,
}

impl RoutingPath {
    /// Create empty routing path
    pub fn new() -> Self {
        Self {
            hops: vec![],
            fee_bps: 0,
        }
    }

    /// Add a hop to the path
    pub fn add_hop(&mut self, from: AssetId, to: AssetId) {
        self.hops.push((from, to));
    }

    /// Calculate total fee
    pub fn calculate_fee(&self, amount: u128) -> u128 {
        (amount * self.fee_bps as u128) / 10000
    }
}
