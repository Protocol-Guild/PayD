#![no_std]

use soroban_sdk::{
    Address, Env, String, Symbol, Vec, contract, contracterror, contractevent, contractimpl,
    contracttype, symbol_short, token, map, Map
};

/// Errors for path payment operations
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum PathPaymentError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientBalance = 4,
    InvalidAmount = 5,
    PathNotFound = 6,
    SlippageExceeded = 7,
    NoLiquidity = 8,
    PaymentNotFound = 9,
    PaymentNotPending = 10,
    InvalidPath = 11,
    PriceImpactTooHigh = 12,
    TransferFailed = 13,
    PayrollRunNotFound = 14,
    InvalidPayrollRun = 15,
    EmployeeNotFound = 16,
    DuplicateEmployeeInBatch = 17,
    BatchTooLarge = 18,
    InvalidEmployer = 19,
}

/// Storage keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PaymentCount,
    Payment(u64),
    PayrollRunCount,
    PayrollRun(u64),
    EmployerConfig(Address),
    BatchLimit,
}

/// Path hop representing intermediate asset in path payment
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PathHop {
    pub asset: Address,
    pub pool_id: Option<Address>,
}

/// Payment record for tracking path payments
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PathPaymentRecord {
    pub from: Address,
    pub to: Address,
    pub source_asset: Address,
    pub dest_asset: Address,
    pub source_amount: i128,
    pub dest_min_amount: i128,
    pub maximum_source_amount: i128,
    pub actual_dest_amount: Option<i128>,
    pub actual_source_amount: Option<i128>,
    pub path: Vec<Address>,
    pub status: Symbol,
    pub error_message: Option<String>,
    pub partial_failure: bool,
    pub payroll_run_id: Option<u64>,
    pub employee_id: Option<String>,
}

/// Employer configuration for payroll path payments
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EmployerConfig {
    pub employer: Address,
    pub default_source_asset: Address,
    pub max_slippage_bps: u32,  // basis points (e.g., 500 = 5%)
    pub max_price_impact_bps: u32,
    pub auto_approve_threshold: i128,
    pub is_active: bool,
}

/// Employee payment item for batch payroll
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EmployeePayment {
    pub employee_id: String,
    pub employee_address: Address,
    pub dest_asset: Address,
    pub dest_amount: i128,
    pub max_source_amount: i128,
    pub min_dest_amount: i128,
    pub status: Symbol,
}

/// Payroll run record for batch payments
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PayrollRun {
    pub run_id: u64,
    pub employer: Address,
    pub source_asset: Address,
    pub total_employees: u32,
    pub successful_payments: u32,
    pub failed_payments: u32,
    pub total_source_amount: i128,
    pub total_dest_amount: i128,
    pub status: Symbol,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub error_message: Option<String>,
}

/// Event emitted when a path payment is initiated
#[contractevent]
pub struct PathPaymentInitiated {
    pub payment_id: u64,
    pub from: Address,
    pub to: Address,
    pub source_asset: Address,
    pub dest_asset: Address,
    pub source_amount: i128,
    pub dest_min_amount: i128,
}

/// Event emitted when a path payment completes
#[contractevent]
pub struct PathPaymentCompleted {
    pub payment_id: u64,
    pub actual_source_amount: i128,
    pub actual_dest_amount: i128,
}

/// Event emitted when a path payment fails
#[contractevent]
pub struct PathPaymentFailed {
    pub payment_id: u64,
    pub error_code: u32,
    pub error_message: String,
    pub partial_failure: bool,
}

/// Event emitted when a payroll run is initiated
#[contractevent]
pub struct PayrollRunInitiated {
    pub run_id: u64,
    pub employer: Address,
    pub source_asset: Address,
    pub total_employees: u32,
    pub total_source_amount: i128,
}

/// Event emitted when a payroll run completes
#[contractevent]
pub struct PayrollRunCompleted {
    pub run_id: u64,
    pub successful_payments: u32,
    pub failed_payments: u32,
    pub total_dest_amount: i128,
}

/// Event emitted when an employee payment in payroll completes
#[contractevent]
pub struct EmployeePaymentCompleted {
    pub run_id: u64,
    pub employee_id: String,
    pub employee_address: Address,
    pub dest_asset: Address,
    pub actual_dest_amount: i128,
    pub actual_source_amount: i128,
}

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const TEMPORARY_TTL_THRESHOLD: u32 = 2_000;
const TEMPORARY_TTL_EXTEND_TO: u32 = 20_000;
const DEFAULT_BATCH_LIMIT: u32 = 100;

#[contract]
pub struct AssetPathPaymentContract;

#[contractimpl]
impl AssetPathPaymentContract {
    // ── SEP-0034 Contract Metadata ───────────────────────────

    /// Returns the human-readable contract name (SEP-0034).
    pub fn name(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_NAME"))
    }

    /// Returns the contract version string (SEP-0034).
    pub fn version(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_VERSION"))
    }

    /// Returns the contract author / organization (SEP-0034).
    pub fn author(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_AUTHORS"))
    }

    /// Initialize the contract with an admin address
    pub fn init(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::PaymentCount, &0u64);
        env.storage()
            .persistent()
            .set(&DataKey::PayrollRunCount, &0u64);
        env.storage()
            .persistent()
            .set(&DataKey::BatchLimit, &DEFAULT_BATCH_LIMIT);
        Self::bump_core_ttl(&env);
    }

    /// Extend TTL for core storage entries
    pub fn bump_ttl(env: Env) {
        Self::require_admin(&env);
        Self::bump_core_ttl(&env);
    }

    /// Initiate a path payment with slippage protection
    ///
    /// # Arguments
    /// * `from` - Source account initiating the payment
    /// * `to` - Destination account receiving the payment
    /// * `source_asset` - Asset to send
    /// * `dest_asset` - Asset to receive
    /// * `source_amount` - Amount of source asset to send
    /// * `dest_min_amount` - Minimum destination amount (slippage protection)
    /// * `maximum_source_amount` - Maximum source amount to protect against slippage
    /// * `path` - Intermediate assets in the path (empty for direct path)
    pub fn initiate_path_payment(
        env: Env,
        from: Address,
        to: Address,
        source_asset: Address,
        dest_asset: Address,
        source_amount: i128,
        dest_min_amount: i128,
        maximum_source_amount: i128,
        path: Vec<Address>,
    ) -> Result<u64, PathPaymentError> {
        from.require_auth();

        // Validate amounts
        if source_amount <= 0 {
            return Err(PathPaymentError::InvalidAmount);
        }
        if dest_min_amount <= 0 {
            return Err(PathPaymentError::InvalidAmount);
        }
        if maximum_source_amount < source_amount {
            return Err(PathPaymentError::SlippageExceeded);
        }

        // Transfer source tokens to contract (escrow)
        let token_client = token::Client::new(&env, &source_asset);
        let contract_addr = env.current_contract_address();

        token_client.transfer(&from, &contract_addr, &source_amount);

        // Increment payment counter
        Self::bump_core_ttl(&env);
        let mut count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::PaymentCount)
            .unwrap_or(0);
        count += 1;
        env.storage()
            .persistent()
            .set(&DataKey::PaymentCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::PaymentCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        // Create payment record
        let record = PathPaymentRecord {
            from: from.clone(),
            to: to.clone(),
            source_asset: source_asset.clone(),
            dest_asset: dest_asset.clone(),
            source_amount,
            dest_min_amount,
            maximum_source_amount,
            actual_dest_amount: None,
            actual_source_amount: None,
            path: path.clone(),
            status: symbol_short!("pending"),
            error_message: None,
            partial_failure: false,
        };

        // Store the payment record
        let payment_key = DataKey::Payment(count);
        env.storage().temporary().set(&payment_key, &record);
        env.storage().temporary().extend_ttl(
            &payment_key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        PathPaymentInitiated {
            payment_id: count,
            from,
            to,
            source_asset,
            dest_asset,
            source_amount,
            dest_min_amount,
        }
        .publish(&env);

        Ok(count)
    }

    /// Complete a path payment after it has been processed off-chain
    ///
    /// This function is called by the backend after executing the path payment
    /// on the Stellar network
    pub fn complete_path_payment(
        env: Env,
        payment_id: u64,
        actual_source_amount: i128,
        actual_dest_amount: i128,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        let key = DataKey::Payment(payment_id);
        let mut record: PathPaymentRecord = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(PathPaymentError::PaymentNotFound)?;

        if record.status != symbol_short!("pending") {
            return Err(PathPaymentError::PaymentNotPending);
        }

        // Verify slippage protection
        if actual_dest_amount < record.dest_min_amount {
            record.status = symbol_short!("failed");
            record.error_message = Some(String::from_str(&env, "Destination amount below minimum"));
            record.partial_failure = true;
            env.storage().temporary().set(&key, &record);

            PathPaymentFailed {
                payment_id,
                error_code: PathPaymentError::SlippageExceeded as u32,
                error_message: String::from_str(&env, "Slippage exceeded"),
                partial_failure: true,
            }
            .publish(&env);

            return Err(PathPaymentError::SlippageExceeded);
        }

        // Update record
        record.actual_source_amount = Some(actual_source_amount);
        record.actual_dest_amount = Some(actual_dest_amount);
        record.status = symbol_short!("completed");

        env.storage().temporary().set(&key, &record);
        env.storage().temporary().extend_ttl(
            &key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        PathPaymentCompleted {
            payment_id,
            actual_source_amount,
            actual_dest_amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Mark a path payment as failed with error details
    pub fn fail_path_payment(
        env: Env,
        payment_id: u64,
        error_code: u32,
        error_message: String,
        partial_failure: bool,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        let key = DataKey::Payment(payment_id);
        let mut record: PathPaymentRecord = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(PathPaymentError::PaymentNotFound)?;

        if record.status != symbol_short!("pending") {
            return Err(PathPaymentError::PaymentNotPending);
        }

        record.status = symbol_short!("failed");
        record.error_message = Some(error_message.clone());
        record.partial_failure = partial_failure;

        env.storage().temporary().set(&key, &record);

        PathPaymentFailed {
            payment_id,
            error_code,
            error_message,
            partial_failure,
        }
        .publish(&env);

        Ok(())
    }

    /// Get payment details by ID
    pub fn get_payment(env: Env, payment_id: u64) -> Option<PathPaymentRecord> {
        let key = DataKey::Payment(payment_id);
        let record: Option<PathPaymentRecord> = env.storage().temporary().get(&key);

        if record.is_some() {
            env.storage().temporary().extend_ttl(
                &key,
                TEMPORARY_TTL_THRESHOLD,
                TEMPORARY_TTL_EXTEND_TO,
            );
        }
        record
    }

    /// Get total payment count
    pub fn get_payment_count(env: Env) -> u64 {
        let key = DataKey::PaymentCount;
        let count = env.storage().persistent().get(&key).unwrap_or(0);

        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        count
    }

    /// Admin-only function to withdraw tokens (for refunds)
    pub fn withdraw(
        env: Env,
        asset: Address,
        amount: i128,
        to: Address,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        if amount <= 0 {
            return Err(PathPaymentError::InvalidAmount);
        }

        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        Ok(())
    }

    // ── PAYROLL INTEGRATION FUNCTIONS ─────────────────────────────────

    /// Configure employer settings for payroll path payments
    pub fn configure_employer(
        env: Env,
        employer: Address,
        default_source_asset: Address,
        max_slippage_bps: u32,
        max_price_impact_bps: u32,
        auto_approve_threshold: i128,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        if max_slippage_bps > 10000 || max_price_impact_bps > 10000 {
            return Err(PathPaymentError::InvalidAmount);
        }

        let config = EmployerConfig {
            employer: employer.clone(),
            default_source_asset,
            max_slippage_bps,
            max_price_impact_bps,
            auto_approve_threshold,
            is_active: true,
        };

        let key = DataKey::EmployerConfig(employer);
        env.storage().persistent().set(&key, &config);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        Ok(())
    }

    /// Get employer configuration
    pub fn get_employer_config(env: Env, employer: Address) -> Option<EmployerConfig> {
        let key = DataKey::EmployerConfig(employer);
        let config: Option<EmployerConfig> = env.storage().persistent().get(&key);

        if config.is_some() {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        config
    }

    /// Initiate batch payroll using path payments
    /// This function supports both PathPaymentStrictSend and PathPaymentStrictReceive
    pub fn initiate_payroll_run(
        env: Env,
        employer: Address,
        source_asset: Address,
        employees: Vec<EmployeePayment>,
        payment_type: Symbol, // "strict_send" or "strict_receive"
    ) -> Result<u64, PathPaymentError> {
        employer.require_auth();

        // Validate employer configuration
        let config = Self::get_employer_config(env.clone(), employer.clone())
            .ok_or(PathPaymentError::InvalidEmployer)?;

        if !config.is_active {
            return Err(PathPaymentError::InvalidEmployer);
        }

        // Check batch size limit
        let batch_limit: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::BatchLimit)
            .unwrap_or(DEFAULT_BATCH_LIMIT);

        if employees.len() > batch_limit {
            return Err(PathPaymentError::BatchTooLarge);
        }

        // Validate employees and check for duplicates
        let mut employee_set = map![&env];
        let mut total_source_amount = 0i128;
        let mut total_dest_amount = 0i128;

        for employee in employees.iter() {
            if employee_set.contains_key(employee.employee_id.clone()) {
                return Err(PathPaymentError::DuplicateEmployeeInBatch);
            }
            employee_set.set(employee.employee_id.clone(), true);

            if employee.dest_amount <= 0 || employee.max_source_amount <= 0 {
                return Err(PathPaymentError::InvalidAmount);
            }

            if payment_type == symbol_short!("strict_send") {
                total_source_amount += employee.max_source_amount;
            } else {
                total_dest_amount += employee.dest_amount;
            }
        }

        // Create payroll run record
        Self::bump_core_ttl(&env);
        let mut run_count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::PayrollRunCount)
            .unwrap_or(0);
        run_count += 1;
        env.storage()
            .persistent()
            .set(&DataKey::PayrollRunCount, &run_count);

        let payroll_run = PayrollRun {
            run_id: run_count,
            employer: employer.clone(),
            source_asset: source_asset.clone(),
            total_employees: employees.len() as u32,
            successful_payments: 0,
            failed_payments: 0,
            total_source_amount,
            total_dest_amount,
            status: symbol_short!("pending"),
            created_at: env.ledger().timestamp(),
            completed_at: None,
            error_message: None,
        };

        let run_key = DataKey::PayrollRun(run_count);
        env.storage().persistent().set(&run_key, &payroll_run);
        env.storage().persistent().extend_ttl(
            &run_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        // If using strict_send, transfer total source amount to contract
        if payment_type == symbol_short!("strict_send") && total_source_amount > 0 {
            let token_client = token::Client::new(&env, &source_asset);
            let contract_addr = env.current_contract_address();
            token_client.transfer(&employer, &contract_addr, &total_source_amount);
        }

        PayrollRunInitiated {
            run_id: run_count,
            employer,
            source_asset,
            total_employees: employees.len() as u32,
            total_source_amount,
        }
        .publish(&env);

        Ok(run_count)
    }

    /// Process individual employee payment in payroll run (called by backend)
    pub fn process_employee_payment(
        env: Env,
        run_id: u64,
        employee_id: String,
        actual_source_amount: i128,
        actual_dest_amount: i128,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        let run_key = DataKey::PayrollRun(run_id);
        let mut payroll_run: PayrollRun = env
            .storage()
            .persistent()
            .get(&run_key)
            .ok_or(PathPaymentError::PayrollRunNotFound)?;

        if payroll_run.status != symbol_short!("pending") {
            return Err(PathPaymentError::InvalidPayrollRun);
        }

        payroll_run.successful_payments += 1;
        payroll_run.total_dest_amount += actual_dest_amount;

        env.storage().persistent().set(&run_key, &payroll_run);
        env.storage().persistent().extend_ttl(
            &run_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        Ok(())
    }

    /// Complete payroll run
    pub fn complete_payroll_run(
        env: Env,
        run_id: u64,
        successful_payments: u32,
        failed_payments: u32,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        let run_key = DataKey::PayrollRun(run_id);
        let mut payroll_run: PayrollRun = env
            .storage()
            .persistent()
            .get(&run_key)
            .ok_or(PathPaymentError::PayrollRunNotFound)?;

        if payroll_run.status != symbol_short!("pending") {
            return Err(PathPaymentError::InvalidPayrollRun);
        }

        payroll_run.status = symbol_short!("completed");
        payroll_run.successful_payments = successful_payments;
        payroll_run.failed_payments = failed_payments;
        payroll_run.completed_at = Some(env.ledger().timestamp());

        env.storage().persistent().set(&run_key, &payroll_run);
        env.storage().persistent().extend_ttl(
            &run_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        PayrollRunCompleted {
            run_id,
            successful_payments,
            failed_payments,
            total_dest_amount: payroll_run.total_dest_amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Get payroll run details
    pub fn get_payroll_run(env: Env, run_id: u64) -> Option<PayrollRun> {
        let key = DataKey::PayrollRun(run_id);
        let run: Option<PayrollRun> = env.storage().persistent().get(&key);

        if run.is_some() {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        run
    }

    /// Get total payroll run count
    pub fn get_payroll_run_count(env: Env) -> u64 {
        let key = DataKey::PayrollRunCount;
        let count = env.storage().persistent().get(&key).unwrap_or(0);

        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        count
    }

    /// Set batch size limit (admin only)
    pub fn set_batch_limit(env: Env, limit: u32) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        if limit == 0 || limit > 1000 {
            return Err(PathPaymentError::InvalidAmount);
        }

        env.storage().persistent().set(&DataKey::BatchLimit, &limit);
        env.storage().persistent().extend_ttl(
            &DataKey::BatchLimit,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        Ok(())
    }

    /// Get current batch limit
    pub fn get_batch_limit(env: Env) -> u32 {
        let key = DataKey::BatchLimit;
        let limit = env.storage().persistent().get(&key).unwrap_or(DEFAULT_BATCH_LIMIT);

        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        limit
    }

    /// Require admin authorization
    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Admin not set; contract may not be initialized");
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        admin.require_auth();
    }

    /// Extend TTL for core storage entries
    fn bump_core_ttl(env: &Env) {
        for key in [
            DataKey::Admin, 
            DataKey::PaymentCount, 
            DataKey::PayrollRunCount,
            DataKey::BatchLimit
        ] {
            if env.storage().persistent().has(&key) {
                env.storage().persistent().extend_ttl(
                    &key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
    }
}

mod test;
