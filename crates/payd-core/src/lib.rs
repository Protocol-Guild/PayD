//! PayD Protocol Core Library
//!
//! This crate provides the core functionality for the PayD payment protocol,
//! including advanced Soroban logic, event indexing, and cross-asset routing.

#![no_std]

extern crate alloc;

pub mod events;
pub mod routing;
pub mod cross_asset;
pub mod types;
pub mod constants;

use soroban_sdk::{contracterror, Address, Env};

/// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InsufficientBalance = 1,
    InvalidAmount = 2,
    RoutingFailed = 3,
    AssetNotSupported = 4,
    EventIndexingFailed = 5,
    Unauthorized = 6,
}

/// Main contract type
pub struct PayDContract;

impl PayDContract {
    /// Initialize the contract
    pub fn init(_env: &Env) -> Result<(), Error> {
        Ok(())
    }

    /// Get contract version
    pub fn version() -> &'static str {
        "48.0.0"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init() {
        let env = Env::default();
        assert!(PayDContract::init(&env).is_ok());
    }
}
