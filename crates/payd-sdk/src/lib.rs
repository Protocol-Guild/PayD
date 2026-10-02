//! PayD Protocol SDK
//!
//! High-level SDK for interacting with the PayD protocol.

#![no_std]

extern crate alloc;

pub use payd_core::{
    types::{AssetId, Amount, RoutingPath, RouteConfig},
    events::{EventPublisher, EventLog, EventType},
    routing::Router,
    cross_asset::CrossAssetTransfer,
    constants::*,
    PayDContract,
};

/// SDK version
pub const SDK_VERSION: &str = "48.0.0";

/// Initialize the PayD SDK
pub fn init() {
    // SDK initialization
}

/// Get the current protocol version
pub fn version() -> &'static str {
    PROTOCOL_VERSION
}
