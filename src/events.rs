use soroban_sdk::Symbol;

pub struct PaymentEvent;
pub struct ConversionEvent;

impl PaymentEvent {
    pub fn topic(env: &soroban_sdk::Env, from: Address, to: Address, asset: Symbol) -> Vec<Symbol> {
        vec![env, Symbol::new(env, "payment"), from, to, asset]
    }
}

impl ConversionEvent {
    pub fn topic(env: &soroban_sdk::Env, from_asset: Symbol, to_asset: Symbol) -> Vec<Symbol> {
        vec![env, Symbol::new(env, "conversion"), from_asset, to_asset]
    }
}
