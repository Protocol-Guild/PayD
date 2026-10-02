//! Constants for PayD Protocol
//!
//! Defines global constants and configuration values.

/// Maximum number of hops in a routing path
pub const MAX_ROUTING_HOPS: u32 = 5;

/// Default slippage tolerance in basis points (1%)
pub const DEFAULT_SLIPPAGE_BPS: u32 = 100;

/// Maximum slippage tolerance in basis points (10%)
pub const MAX_SLIPPAGE_BPS: u32 = 1000;

/// Fee basis points for protocol fees (0.3%)
pub const PROTOCOL_FEE_BPS: u32 = 30;

/// Maximum number of events to store
pub const MAX_EVENT_LOG_SIZE: u64 = 10000;

/// Protocol version
pub const PROTOCOL_VERSION: &str = "48.0.0";

/// Contract ID for the main PayD contract
pub const PAYD_CONTRACT_ID: &str = "payd";

/// Maximum transfer amount
pub const MAX_TRANSFER_AMOUNT: u128 = u128::MAX;

/// Minimum transfer amount
pub const MIN_TRANSFER_AMOUNT: u128 = 1;

/// Default timeout in blocks
pub const DEFAULT_TIMEOUT_BLOCKS: u32 = 1000;
