#![no_std]
#![allow(dead_code)]

mod contract;
mod events;

// Re-export main contract types
pub use contract::PaymentContract;
pub use events::EventLogger;
