//! Advanced routing engine for PayD Protocol
//!
//! Implements cross-asset routing with slippage protection and fee optimization.

use soroban_sdk::{Address, Env, Symbol, vec, Vec};
use crate::types::{AssetId, RoutingPath, RouteConfig};

/// Router engine for cross-asset payments
pub struct Router {
    env: Env,
}

impl Router {
    /// Create a new router
    pub fn new(env: &Env) -> Self {
        Self { env: env.clone() }
    }

    /// Build optimal routing path
    pub fn build_route(
        &self,
        config: &RouteConfig,
        path_candidates: &[RoutingPath],
    ) -> Option<RoutingPath> {
        if path_candidates.is_empty() {
            return None;
        }

        path_candidates
            .iter()
            .min_by_key(|path| path.calculate_fee(1))
            .cloned()
    }

    /// Validate route exists
    pub fn validate_route(
        &self,
        source: &AssetId,
        destination: &AssetId,
    ) -> bool {
        match (source, destination) {
            (AssetId::Native, AssetId::Native) => true,
            (AssetId::Native, _) | (_, AssetId::Native) => true,
            (AssetId::Token { .. }, AssetId::Token { .. }) => true,
            _ => false,
        }
    }

    /// Check slippage tolerance
    pub fn check_slippage(
        &self,
        expected: u128,
        actual: u128,
        max_slippage_bps: u32,
    ) -> bool {
        if expected == 0 {
            return actual == 0;
        }

        let diff = if actual > expected {
            actual - expected
        } else {
            expected - actual
        };

        let tolerance = (expected * max_slippage_bps as u128) / 10000;
        diff <= tolerance
    }

    /// Execute swap with route
    pub fn execute_swap(
        &self,
        _from: &Address,
        _amount: u128,
        _route: &RoutingPath,
    ) -> Result<u128, crate::Error> {
        // Placeholder for actual swap execution
        Ok(0)
    }

    /// Get fee for route
    pub fn get_route_fee(&self, route: &RoutingPath, amount: u128) -> u128 {
        route.calculate_fee(amount)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AssetId, RoutingPath};

    #[test]
    fn test_validate_native_to_native() {
        let router = Router::new(&Env::default());
        let source = AssetId::Native;
        let dest = AssetId::Native;
        assert!(router.validate_route(&source, &dest));
    }

    #[test]
    fn test_check_slippage_passes() {
        let router = Router::new(&Env::default());
        assert!(router.check_slippage(1000, 990, 100)); // 10% tolerance
    }

    #[test]
    fn test_check_slippage_fails() {
        let router = Router::new(&Env::default());
        assert!(!router.check_slippage(1000, 800, 100)); // 20% drop, only 10% tolerance
    }
}
