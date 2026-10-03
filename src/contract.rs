use soroban_sdk::{contract, contractimpl, Env, Map, Vec, String, Symbol, Address, Events, log, storage::Storage};

#[contract]
pub struct PayDContract;

#[contractimpl]
impl PayDContract {
    // Optimized storage keys
    const ADMIN_KEY: Symbol = Symbol::short("ADMIN");
    const EMPLOYEE_COUNT: Symbol = Symbol::short("EMP_COUNT");
    const EMPLOYEE_IDS: Symbol = Symbol::short("EMP_IDS");
    const EMPLOYEE_DATA: Symbol = Symbol::short("EMP_DATA");
    const ASSET_REGISTRIES: Symbol = Symbol::short("ASSETS");
    const PAYROLL_HISTORY: Symbol = Symbol::short("PAYROLL_HIST");
    
    /// Initialize contract with optimized storage layout
    pub fn initialize(env: Env, admin: Address) {
        env.storage().set(&Self::ADMIN_KEY, &admin);
        env.storage().set(&Self::EMPLOYEE_COUNT, &0u32);
        env.storage().set(&Self::EMPLOYEE_IDS, &Vec::new(&env));
        env.storage().set(&Self::EMPLOYEE_DATA, &Map::new(&env));
        env.storage().set(&Self::ASSET_REGISTRIES, &Map::new(&env));
        env.storage().set(&Self::PAYROLL_HISTORY, &Vec::new(&env));
        
        // Publish initialization event
        env.events().publish(&Symbol::short("CONTRACT_INITIALIZED"), (admin,));
    }
    
    /// Batch employee addition for storage efficiency
    pub fn add_employees(env: Env, employees: Vec<EmployeeInput>) -> bool {
        let mut count: u32 = env.storage().get(&Self::EMPLOYEE_COUNT).unwrap_or(0);
        let mut ids: Vec<String> = env.storage().get(&Self::EMPLOYEE_IDS).unwrap_or(Vec::new(&env));
        let mut data: Map<String, EmployeeData> = env.storage().get(&Self::EMPLOYEE_DATA).unwrap_or(Map::new(&env));
        
        for emp in employees.iter() {
            // Check for duplicate IDs efficiently
            if !data.contains_key(emp.id.clone()) {
                ids.push_back(emp.id.clone());
                data.set(emp.id.clone(), EmployeeData::new(&emp));
                count += 1;
            }
        }
        
        // Single storage write for all employee data
        env.storage().set(&Self::EMPLOYEE_COUNT, &count);
        env.storage().set(&Self::EMPLOYEE_IDS, &ids);
        env.storage().set(&Self::EMPLOYEE_DATA, &data);
        
        // Publish indexed event for efficient querying
        env.events().publish(&Symbol::short("EMPLOYEES_ADDED"), (count, ids));
        true
    }
    
    /// Cross-asset payroll processing with optimized storage
    pub fn process_payroll(env: Env, request: PayrollRequest) -> bool {
        let mut asset_balances: Map<Address, i128> = env.storage().get(&Self::ASSET_REGISTRIES).unwrap_or(Map::new(&env));
        let mut payroll_history: Vec<PayrollRecord> = env.storage().get(&Self::PAYROLL_HISTORY).unwrap_or(Vec::new(&env));
        
        // Process payments in batch for efficiency
        for i in 0..request.employee_ids.len() {
            let emp_id = request.employee_ids.get(i).unwrap();
            let amount = request.amounts.get(i).unwrap();
            
            // Update asset balance with overflow protection
            let current_balance = asset_balances.get(request.asset.clone()).unwrap_or(0);
            if current_balance < amount {
                log!(&env, "Insufficient balance for asset: {}", request.asset);
                return false;
            }
            asset_balances.set(request.asset.clone(), current_balance - amount);
            
            // Create payroll record for indexing
            payroll_history.push_back(PayrollRecord {
                employee_id: emp_id.clone(),
                amount,
                asset: request.asset.clone(),
                timestamp: env.ledger().timestamp(),
            });
            
            // Publish individual event for real-time indexing
            env.events().publish(&Symbol::short("PAYROLL_PROCESSED"), (emp_id, amount, request.asset.clone()));
        }
        
        // Single storage write for all updates
        env.storage().set(&Self::ASSET_REGISTRIES, &asset_balances);
        env.storage().set(&Self::PAYROLL_HISTORY, &payroll_history);
        
        // Publish batch event for efficient querying
        env.events().publish(&Symbol::short("PAYROLL_BATCH_PROCESSED"), (request.employee_ids.len(), request.asset));
        true
    }
    
    /// Efficient employee retrieval with pagination
    pub fn get_employee(env: Env, employee_id: String) -> Option<EmployeeData> {
        let data: Map<String, EmployeeData> = env.storage().get(&Self::EMPLOYEE_DATA).unwrap_or(Map::new(&env));
        data.get(employee_id)
    }
    
    /// Batch employee retrieval for large datasets
    pub fn get_employees_batch(env: Env, offset: u32, limit: u32) -> Vec<EmployeeData> {
        let ids: Vec<String> = env.storage().get(&Self::EMPLOYEE_IDS).unwrap_or(Vec::new(&env));
        let data: Map<String, EmployeeData> = env.storage().get(&Self::EMPLOYEE_DATA).unwrap_or(Map::new(&env));
        
        let end = (offset + limit).min(ids.len() as u32);
        let mut result = Vec::new(&env);
        
        for i in offset..end {
            if let Some(emp_data) = data.get(ids.get(i as usize).unwrap()) {
                result.push_back(emp_data);
            }
        }
        result
    }
    
    /// Get payroll history with efficient indexing
    pub fn get_payroll_history(env: Env, employee_id: String, limit: u32) -> Vec<PayrollRecord> {
        let history: Vec<PayrollRecord> = env.storage().get(&Self::PAYROLL_HISTORY).unwrap_or(Vec::new(&env));
        let mut result = Vec::new(&env);
        let mut count = 0;
        
        for record in history.iter() {
            if record.employee_id == employee_id && count < limit {
                result.push_back(record);
                count += 1;
            }
        }
        result
    }
    
    /// Asset balance query for cross-asset logic
    pub fn get_asset_balance(env: Env, asset: Address) -> i128 {
        let balances: Map<Address, i128> = env.storage().get(&Self::ASSET_REGISTRIES).unwrap_or(Map::new(&env));
        balances.get(asset).unwrap_or(0)
    }
}

// Optimized data structures for storage efficiency
#[derive(Clone)]
pub struct EmployeeInput {
    pub id: String,
    pub name: String,
    pub position: String,
    pub salary: i128,
}

#[derive(Clone)]
pub struct EmployeeData {
    pub id: String,
    pub name: String,
    pub position: String,
    pub salary: i128,
    pub active: bool,
}

impl EmployeeData {
    pub fn new(input: &EmployeeInput) -> Self {
        EmployeeData {
            id: input.id.clone(),
            name: input.name.clone(),
            position: input.position.clone(),
            salary: input.salary,
            active: true,
        }
    }
}

#[derive(Clone)]
pub struct PayrollRequest {
    pub employee_ids: Vec<String>,
    pub amounts: Vec<i128>,
    pub asset: Address,
}

#[derive(Clone)]
pub struct PayrollRecord {
    pub employee_id: String,
    pub amount: i128,
    pub asset: Address,
    pub timestamp: u64,
}
