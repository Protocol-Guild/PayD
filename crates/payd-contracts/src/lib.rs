//! PayD Protocol Contracts
//!
//! Soroban smart contract implementations.

#![no_std]

extern crate alloc;

use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, vec, Vec};
use payd_core::{
    types::{AssetId, Amount, RoutingPath},
    events::{EventPublisher, EventLog, EventType},
    routing::Router,
    cross_asset::CrossAssetTransfer,
    Error, PayDContract,
};

#[contract]
pub struct PayD;

#[contractimpl]
impl PayD {
    /// Initialize the PayD contract
    pub fn init(env: Env) -> Result<(), Error> {
        PayDContract::init(&env)
    }

    /// Transfer assets cross-chain
    pub fn transfer(
        env: Env,
        caller: Address,
        source_asset: Symbol,
        destination_asset: Symbol,
        amount: u128,
        min_amount_out: u128,
    ) -> Result<u128, Error> {
        let mut transfer = CrossAssetTransfer::new(&env);
        let mut route = RoutingPath::new();
        
        route.add_hop(
            AssetId::Token {
                contract_id: soroban_sdk::SapContractId([0u8; 32]),
                symbol: source_asset.clone(),
            },
            AssetId::Token {
                contract_id: soroban_sdk::SapContractId([0u8; 32]),
                symbol: destination_asset.clone(),
            },
        );

        let amount_in = Amount::new(amount, 7);
        let amount_out = transfer.execute(
            &caller,
            &AssetId::Native,
            &AssetId::Native,
            amount_in,
            Amount::new(min_amount_out, 7),
            &route,
        )?;

        Ok(amount_out.value)
    }

    /// Get event log
    pub fn get_event_log(env: Env) -> Vec<Symbol> {
        vec![&env]
    }

    /// Get supported assets
    pub fn get_supported_assets(env: Env) -> Vec<Symbol> {
        let transfer = CrossAssetTransfer::new(&env);
        transfer.get_supported_assets()
    }

    /// Get protocol version
    pub fn version(env: Env) -> Symbol {
        Symbol::new(&env, "48.0.0")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec};

    #[test]
    fn test_init() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PayD);
        let client = PayDClient::new(&env, &contract_id);

        client.init();
    }

    #[test]
    fn test_get_version() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PayD);
        let client = PayDClient::new(&env, &contract_id);

        let version = client.version();
        assert_eq!(version.to_string(), "48.0.0");
    }
}
