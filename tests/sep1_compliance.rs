use soroban_sdk::{Env, Address, String};

#[test]
fn test_metadata_initialization() {
    let env = Env::default();
    let admin = Address::random(&env);
    
    // Test initialization
    crate::PayD::init(
        &env, 
        &admin, 
        &String::from_str(&env, "TestToken"), 
        &String::from_str(&env, "TEST"), 
        &7
    );
    
    // Verify metadata status
    let status = crate::PayD::get_metadata_status(&env);
    assert_eq!(status.get(String::from_str(&env, "name")), Some(false));
    assert_eq!(status.get(String::from_str(&env, "symbol")), Some(false));
}

#[test]
fn test_metadata_verification() {
    let env = Env::default();
    let admin = Address::random(&env);
    
    crate::PayD::init(
        &env, 
        &admin, 
        &String::from_str(&env, "TestToken"), 
        &String::from_str(&env, "TEST"), 
        &7
    );
    
    // Verify name metadata
    let verified = crate::PayD::verify_metadata(
        &env,
        &admin,
        &String::from_str(&env, "name"),
        &String::from_str(&env, "Test Token")
    );
    assert!(verified);
    
    // Check compliance status
    let compliant = crate::PayD::is_sep1_compliant(&env);
    assert!(!compliant); // Should not be compliant yet
}

#[test]
fn test_batch_verification() {
    let env = Env::default();
    let admin = Address::random(&env);
    
    crate::PayD::init(
        &env, 
        &admin, 
        &String::from_str(&env, "TestToken"), 
        &String::from_str(&env, "TEST"), 
        &7
    );
    
    // Batch verify multiple fields
    let fields = vec![
        &env,
        String::from_str(&env, "name"),
        String::from_str(&env, "symbol"),
        String::from_str(&env, "description"),
    ];
    
    let values = vec![
        &env,
        String::from_str(&env, "Test Token"),
        String::from_str(&env, "TEST"),
        String::from_str(&env, "A test token for SEP-1 compliance"),
    ];
    
    let success = crate::PayD::batch_verify_metadata(&env, &admin, &fields, &values);
    assert!(success);
}
