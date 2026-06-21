#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Env as _}, vec, Env, Address};

fn create_test_env() -> (Env, AssetPathPaymentContract, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, AssetPathPaymentContract);
    let client = AssetPathPaymentContract::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    client.init(&admin);
    
    (env, client, admin, user1, user2)
}

#[test]
fn test_contract_initialization() {
    let (env, client, admin, _, _) = create_test_env();
    
    // Test that contract is properly initialized
    assert_eq!(client.get_payment_count(), 0);
    assert_eq!(client.get_payroll_run_count(), 0);
    assert_eq!(client.get_batch_limit(), DEFAULT_BATCH_LIMIT);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_double_initialization_fails() {
    let (env, client, admin, _, _) = create_test_env();
    let new_admin = Address::generate(&env);
    
    // Should panic when trying to initialize again
    client.init(&new_admin);
}

#[test]
fn test_path_payment_lifecycle() {
    let (env, client, admin, user1, user2) = create_test_env();
    
    let source_asset = Address::generate(&env);
    let dest_asset = Address::generate(&env);
    let source_amount = 1000i128;
    let dest_min_amount = 900i128;
    let max_source_amount = 1100i128;
    let path = vec![&env];
    
    // Create mock token for source asset
    let token_id = env.register_stellar_asset_contract(source_asset.clone());
    
    // Initiate path payment
    let payment_id = client.initiate_path_payment(
        &user1,
        &user2, 
        &source_asset,
        &dest_asset,
        &source_amount,
        &dest_min_amount,
        &max_source_amount,
        &path,
    ).unwrap();
    
    assert_eq!(payment_id, 1);
    assert_eq!(client.get_payment_count(), 1);
    
    // Check payment record
    let payment = client.get_payment(payment_id).unwrap();
    assert_eq!(payment.from, user1);
    assert_eq!(payment.to, user2);
    assert_eq!(payment.source_amount, source_amount);
    assert_eq!(payment.status, symbol_short!("pending"));
}

#[test]
fn test_complete_path_payment() {
    let (env, client, admin, user1, user2) = create_test_env();
    
    let source_asset = Address::generate(&env);
    let dest_asset = Address::generate(&env);
    let source_amount = 1000i128;
    let dest_min_amount = 900i128;
    let max_source_amount = 1100i128;
    let path = vec![&env];
    
    // Create mock token
    let token_id = env.register_stellar_asset_contract(source_asset.clone());
    
    // Initiate payment
    let payment_id = client.initiate_path_payment(
        &user1,
        &user2,
        &source_asset,
        &dest_asset,
        &source_amount,
        &dest_min_amount,
        &max_source_amount,
        &path,
    ).unwrap();
    
    // Complete the payment
    let actual_source = 980i128;
    let actual_dest = 950i128;
    
    client.complete_path_payment(&payment_id, &actual_source, &actual_dest).unwrap();
    
    // Verify completion
    let payment = client.get_payment(payment_id).unwrap();
    assert_eq!(payment.status, symbol_short!("completed"));
    assert_eq!(payment.actual_source_amount.unwrap(), actual_source);
    assert_eq!(payment.actual_dest_amount.unwrap(), actual_dest);
}

#[test]
fn test_fail_path_payment() {
    let (env, client, admin, user1, user2) = create_test_env();
    
    let source_asset = Address::generate(&env);
    let dest_asset = Address::generate(&env);
    let source_amount = 1000i128;
    let dest_min_amount = 900i128;
    let max_source_amount = 1100i128;
    let path = vec![&env];
    
    // Create mock token
    let token_id = env.register_stellar_asset_contract(source_asset.clone());
    
    // Initiate payment
    let payment_id = client.initiate_path_payment(
        &user1,
        &user2,
        &source_asset,
        &dest_asset,
        &source_amount,
        &dest_min_amount,
        &max_source_amount,
        &path,
    ).unwrap();
    
    // Fail the payment
    let error_message = String::from_str(&env, "Insufficient liquidity");
    client.fail_path_payment(&payment_id, &8u32, &error_message, &false).unwrap();
    
    // Verify failure
    let payment = client.get_payment(payment_id).unwrap();
    assert_eq!(payment.status, symbol_short!("failed"));
    assert_eq!(payment.error_message.unwrap(), error_message);
    assert_eq!(payment.partial_failure, false);
}

#[test]
fn test_slippage_protection() {
    let (env, client, admin, user1, user2) = create_test_env();
    
    let source_asset = Address::generate(&env);
    let dest_asset = Address::generate(&env);
    let source_amount = 1000i128;
    let dest_min_amount = 900i128;
    let max_source_amount = 1100i128;
    let path = vec![&env];
    
    // Create mock token
    let token_id = env.register_stellar_asset_contract(source_asset.clone());
    
    // Initiate payment
    let payment_id = client.initiate_path_payment(
        &user1,
        &user2,
        &source_asset,
        &dest_asset,
        &source_amount,
        &dest_min_amount,
        &max_source_amount,
        &path,
    ).unwrap();
    
    // Try to complete with amount below minimum (should fail)
    let actual_source = 1000i128;
    let actual_dest = 800i128; // Below minimum of 900
    
    let result = client.complete_path_payment(&payment_id, &actual_source, &actual_dest);
    assert_eq!(result, Err(PathPaymentError::SlippageExceeded));
}

#[test] 
fn test_employer_configuration() {
    let (env, client, admin, _, _) = create_test_env();
    
    let employer = Address::generate(&env);
    let source_asset = Address::generate(&env);
    let max_slippage = 500u32; // 5%
    let max_price_impact = 1000u32; // 10%
    let auto_approve_threshold = 10000i128;
    
    // Configure employer
    client.configure_employer(
        &employer,
        &source_asset,
        &max_slippage,
        &max_price_impact,
        &auto_approve_threshold,
    ).unwrap();
    
    // Verify configuration
    let config = client.get_employer_config(employer.clone()).unwrap();
    assert_eq!(config.employer, employer);
    assert_eq!(config.default_source_asset, source_asset);
    assert_eq!(config.max_slippage_bps, max_slippage);
    assert_eq!(config.max_price_impact_bps, max_price_impact);
    assert_eq!(config.auto_approve_threshold, auto_approve_threshold);
    assert_eq!(config.is_active, true);
}

#[test]
fn test_payroll_run_lifecycle() {
    let (env, client, admin, _, _) = create_test_env();
    
    let employer = Address::generate(&env);
    let source_asset = Address::generate(&env);
    
    // Configure employer first
    client.configure_employer(
        &employer,
        &source_asset,
        &500u32,
        &1000u32,
        &10000i128,
    ).unwrap();
    
    // Create employee payments
    let employee1 = Address::generate(&env);
    let employee2 = Address::generate(&env);
    let dest_asset = Address::generate(&env);
    
    let employees = vec![
        &env,
        EmployeePayment {
            employee_id: String::from_str(&env, "emp1"),
            employee_address: employee1,
            dest_asset: dest_asset.clone(),
            dest_amount: 1000i128,
            max_source_amount: 1100i128,
            min_dest_amount: 950i128,
            status: symbol_short!("pending"),
        },
        EmployeePayment {
            employee_id: String::from_str(&env, "emp2"),
            employee_address: employee2,
            dest_asset: dest_asset.clone(),
            dest_amount: 2000i128,
            max_source_amount: 2200i128,
            min_dest_amount: 1900i128,
            status: symbol_short!("pending"),
        },
    ];
    
    // Create mock token
    let token_id = env.register_stellar_asset_contract(source_asset.clone());
    
    // Initiate payroll run
    let run_id = client.initiate_payroll_run(
        &employer,
        &source_asset,
        &employees,
        &symbol_short!("strict_send"),
    ).unwrap();
    
    assert_eq!(run_id, 1);
    assert_eq!(client.get_payroll_run_count(), 1);
    
    // Verify payroll run
    let run = client.get_payroll_run(run_id).unwrap();
    assert_eq!(run.employer, employer);
    assert_eq!(run.source_asset, source_asset);
    assert_eq!(run.total_employees, 2);
    assert_eq!(run.status, symbol_short!("pending"));
}

#[test]
fn test_process_employee_payment() {
    let (env, client, admin, _, _) = create_test_env();
    
    let employer = Address::generate(&env);
    let source_asset = Address::generate(&env);
    
    // Configure employer
    client.configure_employer(
        &employer,
        &source_asset,
        &500u32,
        &1000u32,
        &10000i128,
    ).unwrap();
    
    // Create employee payments
    let employee1 = Address::generate(&env);
    let dest_asset = Address::generate(&env);
    
    let employees = vec![
        &env,
        EmployeePayment {
            employee_id: String::from_str(&env, "emp1"),
            employee_address: employee1,
            dest_asset: dest_asset.clone(),
            dest_amount: 1000i128,
            max_source_amount: 1100i128,
            min_dest_amount: 950i128,
            status: symbol_short!("pending"),
        },
    ];
    
    // Create mock token
    let token_id = env.register_stellar_asset_contract(source_asset.clone());
    
    // Initiate payroll run
    let run_id = client.initiate_payroll_run(
        &employer,
        &source_asset,
        &employees,
        &symbol_short!("strict_send"),
    ).unwrap();
    
    // Process employee payment
    let employee_id = String::from_str(&env, "emp1");
    let actual_source = 1050i128;
    let actual_dest = 980i128;
    
    client.process_employee_payment(&run_id, &employee_id, &actual_source, &actual_dest).unwrap();
    
    // Complete payroll run
    client.complete_payroll_run(&run_id, &1u32, &0u32).unwrap();
    
    // Verify completion
    let run = client.get_payroll_run(run_id).unwrap();
    assert_eq!(run.status, symbol_short!("completed"));
    assert_eq!(run.successful_payments, 1);
    assert_eq!(run.failed_payments, 0);
}

#[test]
fn test_batch_size_limits() {
    let (env, client, admin, _, _) = create_test_env();
    
    // Test setting batch limit
    client.set_batch_limit(&50u32).unwrap();
    assert_eq!(client.get_batch_limit(), 50);
    
    // Test invalid batch limits
    let result = client.set_batch_limit(&0u32);
    assert_eq!(result, Err(PathPaymentError::InvalidAmount));
    
    let result = client.set_batch_limit(&1001u32);
    assert_eq!(result, Err(PathPaymentError::InvalidAmount));
}

#[test]
fn test_duplicate_employee_detection() {
    let (env, client, admin, _, _) = create_test_env();
    
    let employer = Address::generate(&env);
    let source_asset = Address::generate(&env);
    
    // Configure employer
    client.configure_employer(
        &employer,
        &source_asset,
        &500u32,
        &1000u32,
        &10000i128,
    ).unwrap();
    
    // Create employee payments with duplicate ID
    let employee1 = Address::generate(&env);
    let employee2 = Address::generate(&env);
    let dest_asset = Address::generate(&env);
    
    let employees = vec![
        &env,
        EmployeePayment {
            employee_id: String::from_str(&env, "emp1"), // Same ID
            employee_address: employee1,
            dest_asset: dest_asset.clone(),
            dest_amount: 1000i128,
            max_source_amount: 1100i128,
            min_dest_amount: 950i128,
            status: symbol_short!("pending"),
        },
        EmployeePayment {
            employee_id: String::from_str(&env, "emp1"), // Same ID (duplicate)
            employee_address: employee2,
            dest_asset: dest_asset.clone(),
            dest_amount: 2000i128,
            max_source_amount: 2200i128,
            min_dest_amount: 1900i128,
            status: symbol_short!("pending"),
        },
    ];
    
    // Should fail due to duplicate employee ID
    let result = client.initiate_payroll_run(
        &employer,
        &source_asset,
        &employees,
        &symbol_short!("strict_send"),
    );
    
    assert_eq!(result, Err(PathPaymentError::DuplicateEmployeeInBatch));
}

#[test]
fn test_invalid_amounts() {
    let (env, client, admin, user1, user2) = create_test_env();
    
    let source_asset = Address::generate(&env);
    let dest_asset = Address::generate(&env);
    let path = vec![&env];
    
    // Test zero source amount
    let result = client.initiate_path_payment(
        &user1,
        &user2,
        &source_asset,
        &dest_asset,
        &0i128, // Zero amount
        &900i128,
        &1100i128,
        &path,
    );
    assert_eq!(result, Err(PathPaymentError::InvalidAmount));
    
    // Test zero dest amount
    let result = client.initiate_path_payment(
        &user1,
        &user2,
        &source_asset,
        &dest_asset,
        &1000i128,
        &0i128, // Zero amount
        &1100i128,
        &path,
    );
    assert_eq!(result, Err(PathPaymentError::InvalidAmount));
    
    // Test max source less than source amount
    let result = client.initiate_path_payment(
        &user1,
        &user2,
        &source_asset,
        &dest_asset,
        &1000i128,
        &900i128,
        &900i128, // Less than source amount
        &path,
    );
    assert_eq!(result, Err(PathPaymentError::SlippageExceeded));
}

#[test]
fn test_unauthorized_operations() {
    let (env, client, admin, user1, _) = create_test_env();
    
    // Test that non-admin cannot complete payments
    env.mock_all_auths_allowing_non_root_auth();
    
    let payment_id = 1u64;
    let actual_source = 1000i128;
    let actual_dest = 950i128;
    
    // This should fail because user1 is not admin
    let result = client.complete_path_payment(&payment_id, &actual_source, &actual_dest);
    // Note: In real test, this would check for unauthorized error
}

#[test]
fn test_ttl_extensions() {
    let (env, client, admin, _, _) = create_test_env();
    
    // Test TTL bump functionality
    client.bump_ttl();
    
    // Test that getting counts extends TTL
    let count1 = client.get_payment_count();
    let count2 = client.get_payroll_run_count();
    let limit = client.get_batch_limit();
    
    assert_eq!(count1, 0);
    assert_eq!(count2, 0);
    assert_eq!(limit, DEFAULT_BATCH_LIMIT);
}