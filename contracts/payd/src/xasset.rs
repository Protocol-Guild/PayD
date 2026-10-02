use soroban_sdk::{Env, Symbol};
use crate::state;

/// Get the current exchange rate between two assets
pub fn get_rate(env: &Env, from: &Symbol, to: &Symbol) -> i128 {
    state::get_rate(env, from, to)
}

/// Calculate output amount based on rate (with 9 decimal precision)
pub fn calculate_output(env: &Env, input: i128, rate: &i128) -> i128 {
    // Rate is in basis points * 10^9 (1e9 = 1.0)
    // output = input * rate / 1e9
    const DECIMAL_PRECISION: i128 = 1_000_000_000;
    (input as i128)
        .checked_mul(*rate)
        .unwrap()
        .checked_div(DECIMAL_PRECISION)
        .unwrap()
}

/// Set a new exchange rate (admin only)
pub fn set_rate(env: &Env, from: &Symbol, to: &Symbol, rate: i128) {
    let admin = state::get_admin(env);
    admin.require_auth();
    state::set_rate(env, from, to, rate);
}

/// Get the inverse rate for reverse swaps
pub fn get_inverse_rate(env: &Env, from: &Symbol, to: &Symbol) -> i128 {
    let rate = state::get_rate(env, from, to);
    const DECIMAL_PRECISION: i128 = 1_000_000_000;
    if rate == 0 {
        0
    } else {
        DECIMAL_PRECISION.checked_mul(DECIMAL_PRECISION).unwrap()
            / rate
    }
}
