use soroban_sdk::{Env, Symbol, String, Map, Vec};

pub struct MetadataEvents;

impl MetadataEvents {
    pub fn emit_metadata_init(env: &Env, admin: String, name: String, symbol: String, decimals: u32) {
        env.events().publish(
            (Symbol::new(env, "metadata_init"),),
            (admin, name, symbol, decimals)
        );
    }
    
    pub fn emit_metadata_verified(env: &Env, admin: String, field: String, value: String) {
        env.events().publish(
            (Symbol::new(env, "metadata_verified"),),
            (admin, field, value)
        );
    }
    
    pub fn emit_batch_verification(env: &Env, admin: String, success: bool) {
        env.events().publish(
            (Symbol::new(env, "batch_verification"),),
            (admin, success)
        );
    }
    
    pub fn emit_compliance_check(env: &Env, compliant: bool) {
        env.events().publish(
            (Symbol::new(env, "compliance_check"),),
            (compliant,)
        );
    }
}
