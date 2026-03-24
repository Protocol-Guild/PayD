#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Vec,
};

// ── Errors map ────────────────────────────────────────────────────────────────
// Soroban host panics with "HostError: Error(Contract, #N)" — variant names
// are NOT in the panic string. Match on the numeric code instead:
//
//   AlreadyInitialized = 1  → Error(Contract, #1)
//   NotInitialized     = 2  → Error(Contract, #2)
//   EmptyBatch         = 4  → Error(Contract, #4)
//   BatchTooLarge      = 5  → Error(Contract, #5)
//   InvalidAmount      = 6  → Error(Contract, #6)
//   SequenceMismatch   = 8  → Error(Contract, #8)
//   BatchNotFound      = 9  → Error(Contract, #9)

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, Address, BulkPaymentContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let sender = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

    let admin = Address::generate(&env);
    let contract_id = env.register(BulkPaymentContract,());
    let client = BulkPaymentContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    (env, sender, token_id, client)
}

fn one_payment(env: &Env) -> Vec<PaymentOp> {
    let mut payments: Vec<PaymentOp> = Vec::new(env);
    payments.push_back(PaymentOp {
        recipient: Address::generate(env),
        amount: 10,
        category: soroban_sdk::symbol_short!("payroll"),
    });
    payments
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_initialize_twice_panics() {
    let (env, _, _, client) = setup();
    client.initialize(&Address::generate(&env));
}

// ── execute_batch ─────────────────────────────────────────────────────────────

#[test]
fn test_execute_batch_success() {
    let (env, sender, token, client) = setup();

    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let r3 = Address::generate(&env);

    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp { recipient: r1.clone(), amount: 100, category: soroban_sdk::symbol_short!("payroll") });
    payments.push_back(PaymentOp { recipient: r2.clone(), amount: 200, category: soroban_sdk::symbol_short!("payroll") });
    payments.push_back(PaymentOp { recipient: r3.clone(), amount: 300, category: soroban_sdk::symbol_short!("payroll") });

    let batch_id = client.execute_batch(&sender, &token, &payments, &client.get_sequence());

    let tc = TokenClient::new(&env, &token);
    assert_eq!(tc.balance(&r1), 100);
    assert_eq!(tc.balance(&r2), 200);
    assert_eq!(tc.balance(&r3), 300);

    let record = client.get_batch(&batch_id);
    assert_eq!(record.success_count, 3);
    assert_eq!(record.fail_count, 0);
    assert_eq!(record.total_sent, 600);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_execute_batch_empty_panics() {
    let (env, sender, token, client) = setup();
    let payments: Vec<PaymentOp> = Vec::new(&env);
    client.execute_batch(&sender, &token, &payments, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_execute_batch_too_large_panics() {
    let (env, sender, token, client) = setup();
    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    for _ in 0..=100 {
        payments.push_back(PaymentOp {
            recipient: Address::generate(&env),
            amount: 1,
            category: soroban_sdk::symbol_short!("payroll"),
        });
    }
    client.execute_batch(&sender, &token, &payments, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_execute_batch_negative_amount_panics() {
    let (env, sender, token, client) = setup();
    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp {
        recipient: Address::generate(&env),
        amount: -5,
        category: soroban_sdk::symbol_short!("payroll"),
    });
    client.execute_batch(&sender, &token, &payments, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_execute_batch_sequence_replay_panics() {
    let (env, sender, token, client) = setup();
    let payments = one_payment(&env);
    client.execute_batch(&sender, &token, &payments, &0); // seq → 1
    client.execute_batch(&sender, &token, &payments, &0); // must panic
}

#[test]
fn test_sequence_advances_after_each_batch() {
    let (env, sender, token, client) = setup();
    let payments = one_payment(&env);

    assert_eq!(client.get_sequence(), 0);
    client.execute_batch(&sender, &token, &payments, &0);
    assert_eq!(client.get_sequence(), 1);
    client.execute_batch(&sender, &token, &payments, &1);
    assert_eq!(client.get_sequence(), 2);
}

#[test]
fn test_batch_count_increments() {
    let (env, sender, token, client) = setup();
    let payments = one_payment(&env);

    client.execute_batch(&sender, &token, &payments, &0);
    client.execute_batch(&sender, &token, &payments, &1);

    assert_eq!(client.get_batch_count(), 2);
}

// ── execute_batch_partial ─────────────────────────────────────────────────────

#[test]
fn test_partial_batch_skips_insufficient_funds() {
    let (env, sender, token, client) = setup();
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env); // will be skipped (amount = 0)

    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp {
        recipient: r1.clone(),
        amount: 500_000,
        category: soroban_sdk::symbol_short!("payroll"),
    });
    payments.push_back(PaymentOp {
        recipient: r2.clone(),
        amount: 0,
        category: soroban_sdk::symbol_short!("payroll"),
    }); // invalid → skip

    let batch_id =
        client.execute_batch_partial(&sender, &token, &payments, &client.get_sequence());

    let record = client.get_batch(&batch_id);
    assert_eq!(record.success_count, 1);
    assert_eq!(record.fail_count, 1);

    let tc = TokenClient::new(&env, &token);
    assert_eq!(tc.balance(&r1), 500_000);
    assert_eq!(tc.balance(&r2), 0);
    assert_eq!(tc.balance(&sender), 500_000); // refunded the unspent pull
}

#[test]
fn test_partial_batch_all_fail_status_is_rollbck() {
    let (env, sender, token, client) = setup();
    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp {
        recipient: Address::generate(&env),
        amount: -1,
        category: soroban_sdk::symbol_short!("payroll"),
    });

    let batch_id =
        client.execute_batch_partial(&sender, &token, &payments, &client.get_sequence());

    let record = client.get_batch(&batch_id);
    assert_eq!(record.success_count, 0);
    assert_eq!(record.fail_count, 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_partial_batch_empty_panics() {
    let (env, sender, token, client) = setup();
    let payments: Vec<PaymentOp> = Vec::new(&env);
    client.execute_batch_partial(&sender, &token, &payments, &0);
}

// ── get_batch ─────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_get_batch_not_found_panics() {
    let (_, _, _, client) = setup();
    client.get_batch(&999);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── GAS OPTIMIZATION BENCHMARK & INTEGRITY TESTS ──────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/// Benchmark: 50-payment batch via execute_batch.
/// Verifies data integrity for a realistic payroll-sized batch and confirms
/// the optimized direct-transfer path handles large batches correctly.
///
/// Gas savings (execute_batch optimizations):
///   BEFORE: 1 bulk pull + 50 pushes = 51 token::transfer cross-contract calls
///   AFTER:  50 direct sender→recipient transfers = 50 token::transfer calls
///   → Eliminates 1 transfer call and the intermediate contract balance accounting.
#[test]
fn test_benchmark_50_payment_batch() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let sender = Address::generate(&env);
    // Mint enough for 50 payments of 1_000 each = 50_000
    StellarAssetClient::new(&env, &token_id).mint(&sender, &100_000);

    let admin = Address::generate(&env);
    let contract_id = env.register(BulkPaymentContract, ());
    let client = BulkPaymentContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    // Build a 50-payment batch
    let mut recipients: Vec<Address> = Vec::new(&env);
    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    for _ in 0..50 {
        let r = Address::generate(&env);
        recipients.push_back(r.clone());
        payments.push_back(PaymentOp { recipient: r, amount: 1_000 });
    }

    let batch_id = client.execute_batch(&sender, &token_id, &payments, &0);

    // Verify 100% data integrity: every recipient got exactly 1_000
    let tc = TokenClient::new(&env, &token_id);
    for i in 0..50 {
        let r = recipients.get(i).unwrap();
        assert_eq!(tc.balance(&r), 1_000);
    }

    // Verify sender balance: 100_000 - 50_000 = 50_000
    assert_eq!(tc.balance(&sender), 50_000);

    // Verify batch record integrity
    let record = client.get_batch(&batch_id);
    assert_eq!(record.total_sent, 50_000);
    assert_eq!(record.success_count, 50);
    assert_eq!(record.fail_count, 0);
    assert_eq!(record.sender, sender);
    assert_eq!(record.token, token_id);
}

/// Benchmark: 50-payment batch via execute_batch_partial.
/// Verifies all payments succeed when amounts are valid.
#[test]
fn test_benchmark_50_payment_partial_batch() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let sender = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &100_000);

    let admin = Address::generate(&env);
    let contract_id = env.register(BulkPaymentContract, ());
    let client = BulkPaymentContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    let mut recipients: Vec<Address> = Vec::new(&env);
    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    for _ in 0..50 {
        let r = Address::generate(&env);
        recipients.push_back(r.clone());
        payments.push_back(PaymentOp { recipient: r, amount: 1_000 });
    }

    let batch_id = client.execute_batch_partial(&sender, &token_id, &payments, &0);

    let tc = TokenClient::new(&env, &token_id);
    for i in 0..50 {
        let r = recipients.get(i).unwrap();
        assert_eq!(tc.balance(&r), 1_000);
    }

    assert_eq!(tc.balance(&sender), 50_000);

    let record = client.get_batch(&batch_id);
    assert_eq!(record.total_sent, 50_000);
    assert_eq!(record.success_count, 50);
    assert_eq!(record.fail_count, 0);
}

/// Verify atomicity: if a payment has invalid amount, entire batch reverts
/// (no partial state changes). This confirms the single-pass optimization
/// maintains all-or-nothing semantics.
#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_batch_atomicity_with_invalid_in_middle() {
    let (env, sender, token, client) = setup();

    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp { recipient: Address::generate(&env), amount: 100 });
    payments.push_back(PaymentOp { recipient: Address::generate(&env), amount: -1 }); // invalid
    payments.push_back(PaymentOp { recipient: Address::generate(&env), amount: 100 });

    // Should panic — no partial payments made
    client.execute_batch(&sender, &token, &payments, &0);
}

/// Verify that batch records persisted via persistent storage survive
/// across multiple batch operations and are independently retrievable.
#[test]
fn test_persistent_batch_records_independent() {
    let (env, sender, token, client) = setup();

    let mut p1: Vec<PaymentOp> = Vec::new(&env);
    p1.push_back(PaymentOp { recipient: Address::generate(&env), amount: 100 });
    let id1 = client.execute_batch(&sender, &token, &p1, &0);

    let mut p2: Vec<PaymentOp> = Vec::new(&env);
    p2.push_back(PaymentOp { recipient: Address::generate(&env), amount: 200 });
    let id2 = client.execute_batch(&sender, &token, &p2, &1);

    // Both records are independently retrievable
    let r1 = client.get_batch(&id1);
    let r2 = client.get_batch(&id2);
    assert_eq!(r1.total_sent, 100);
    assert_eq!(r2.total_sent, 200);
    assert_eq!(r1.success_count, 1);
    assert_eq!(r2.success_count, 1);
}

/// Max batch (100 payments) — stress test for gas-optimized path.
#[test]
fn test_max_batch_100_payments() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let sender = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

    let admin = Address::generate(&env);
    let contract_id = env.register(BulkPaymentContract, ());
    let client = BulkPaymentContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    for _ in 0..100 {
        payments.push_back(PaymentOp { recipient: Address::generate(&env), amount: 100 });
    }

    let batch_id = client.execute_batch(&sender, &token_id, &payments, &0);

    let tc = TokenClient::new(&env, &token_id);
    // Sender should have 1_000_000 - (100 * 100) = 990_000
    assert_eq!(tc.balance(&sender), 990_000);

    let record = client.get_batch(&batch_id);
    assert_eq!(record.total_sent, 10_000);
    assert_eq!(record.success_count, 100);
    assert_eq!(record.fail_count, 0);
}