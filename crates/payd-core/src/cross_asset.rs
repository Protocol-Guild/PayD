//! Cross-asset transfer logic for PayD Protocol
//!
//! Handles asset swapping and transfers between different token types.

use soroban_sdk::{Address, Env, Symbol, vec, Vec};
use crate::types::{AssetId, Amount, RoutingPath};
use crate::routing::Router;
use crate::events::{EventPublisher, EventType};

/// Cross-asset transfer handler
pub struct CrossAssetTransfer {
    env: Env,
    router: Router,
    event_publisher: EventPublisher,
}

impl CrossAssetTransfer {
    /// Create a new cross-asset transfer handler
    pub fn new(env: &Env) -> Self {
        Self {
            env: env.clone(),
            router: Router::new(env),
            event_publisher: EventPublisher::new(env),
        }
    }

    /// Execute cross-asset transfer
    pub fn execute(
        &mut self,
        caller: &Address,
        source_asset: &AssetId,
        destination_asset: &AssetId,
        amount_in: Amount,
        min_amount_out: Amount,
        route: &RoutingPath,
    ) -> Result<Amount, crate::Error> {
        // Validate route
        if !self.router.validate_route(source_asset, destination_asset) {
            return Err(crate::Error::RoutingFailed);
        }

        // Calculate output amount
        let fee = self.router.get_route_fee(route, amount_in.value);
        let amount_after_fee = amount_in.value - fee;

        // For native asset swaps, assume 1:1 for simplicity
        let amount_out = if amount_after_fee < min_amount_out.value {
            return Err(crate::Error::InsufficientBalance);
        } else {
            amount_after_fee
        };

        // Check slippage
        if !self.router.check_slippage(
            amount_out,
            min_amount_out.value,
            100, // 1% default tolerance
        ) {
            return Err(crate::Error::InvalidAmount);
        }

        // Emit events
        self.event_publisher.emit_cross_asset_transfer(
            caller,
            source_asset.display_name().parse().unwrap(),
            destination_asset.display_name().parse().unwrap(),
            amount_in.value,
            amount_out,
        );

        self.event_publisher.emit_route_created(
            caller,
            source_asset.display_name().parse().unwrap(),
            destination_asset.display_name().parse().unwrap(),
        );

        Ok(Amount::new(amount_out, amount_in.decimals))
    }

    /// Get supported assets
    pub fn get_supported_assets(&self) -> Vec<Symbol> {
        let mut assets = vec![&self.env];
        assets.push_back(Symbol::new(&self.env, "XLM"));
        assets.push_back(Symbol::new(&self.env, "USDC"));
        assets.push_back(Symbol::new(&self.env, "ETH"));
        assets
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AssetId, Amount};

    #[test]
    fn test_cross_asset_transfer() {
        let mut transfer = CrossAssetTransfer::new(&Env::default());
        let caller = Address::account(&Env::default(), &soroban_sdk::Address::generate_contract_id(
            &[],
            &Address::account(&Env::default(), &soroban_sdk::Address::generate_contract_id(&[], &Address::account(&Env::default(), &soroban_sdk::Address::generate_contract_id(&[], &soroban_sdk::Address::Account(0)).clone())).clone()));
        
        let source = AssetId::Native;
        let dest = AssetId::Native;
        let amount_in = Amount::new(10000, 7);
        let min_amount_out = Amount::new(9000, 7);
        let route = RoutingPath::new();

        let result = transfer.execute(&caller, &source, &dest, amount_in, min_amount_out, &route);
        
        // Should succeed for same-asset transfer
        assert!(result.is_ok());
    }
}
