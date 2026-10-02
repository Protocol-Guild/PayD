use soroban_sdk::{Address, Env, EventTopick2, Symbol, vec};
use crate::state;

/// Efficient event emission with indexed fields for off-chain indexing
pub fn emit_transfer(
    env: &Env,
    from: &Address,
    to: &Address,
    asset: &Symbol,
    amount: i128,
    ledger_seq: u32,
) {
    // Topic-indexed event for efficient filtering
    env.events().publish(
        (vec![env, EventTopick2::from_u32(0)],),
        (
            from.clone(),
            to.clone(),
            *asset,
            amount,
            ledger_seq,
        ),
    );

    // Secondary indexed event for cross-asset aggregation
    env.events().publish(
        (vec![env, EventTopick2::from_u32(1)],),
        (*asset, amount, ledger_seq),
    );
}

pub fn emit_swap(
    env: &Env,
    user: &Address,
    from_asset: &Symbol,
    to_asset: &Symbol,
    from_amount: i128,
    to_amount: i128,
    ledger_seq: u32,
) {
    env.events().publish(
        (vec![env, EventTopick2::from_u32(2)],),
        (
            user.clone(),
            *from_asset,
            *to_asset,
            from_amount,
            to_amount,
            ledger_seq,
        ),
    );
}
