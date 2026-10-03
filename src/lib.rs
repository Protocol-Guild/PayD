use soroban_sdk::{contract, contractimpl, Env, String, Map, Vec, Symbol, Address};

#[contract]
pub struct PayD;

#[contractimpl]
impl PayD {
    // Initialize the contract with metadata verification
    pub fn init(env: Env, admin: Address, name: String, symbol: String, decimals: u32) {
        admin.require_auth();
        
        // Store basic token metadata
        env.storage().instance().set(&Symbol::new(&env, "name"), &name);
        env.storage().instance().set(&Symbol::new(&env, "symbol"), &symbol);
        env.storage().instance().set(&Symbol::new(&env, "decimals"), &decimals);
        env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
        
        // Initialize metadata verification state
        let mut metadata_verified = Map::new(&env);
        metadata_verified.set(String::from_str(&env, "name"), false);
        metadata_verified.set(String::from_str(&env, "symbol"), false);
        metadata_verified.set(String::from_str(&env, "decimals"), false);
        metadata_verified.set(String::from_str(&env, "icon"), false);
        metadata_verified.set(String::from_str(&env, "organization"), false);
        metadata_verified.set(String::from_str(&env, "domain"), false);
        metadata_verified.set(String::from_str(&env, "description"), false);
        
        env.storage().instance().set(&Symbol::new(&env, "metadata_verified"), &metadata_verified);
        
        // Emit initialization event
        env.events().publish(
            (Symbol::new(&env, "metadata_init"),),
            (admin.clone(), name.clone(), symbol.clone(), decimals)
        );
    }
    
    // Verify individual metadata fields for SEP-1 compliance
    pub fn verify_metadata(
        env: Env, 
        admin: Address, 
        field: String, 
        value: String
    ) -> bool {
        admin.require_auth();
        
        let mut metadata_verified: Map<String, bool> = env.storage()
            .instance()
            .get(&Symbol::new(&env, "metadata_verified"))
            .unwrap_or_else(|| Map::new(&env));
        
        // Validate field exists
        if !metadata_verified.contains_key(field.clone()) {
            return false;
        }
        
        // Update verification status
        metadata_verified.set(field.clone(), true);
        env.storage().instance().set(&Symbol::new(&env, "metadata_verified"), &metadata_verified);
        
        // Store the verified value
        env.storage().instance().set(&Symbol::new(&env, &field), &value);
        
        // Emit verification event
        env.events().publish(
            (Symbol::new(&env, "metadata_verified"),),
            (admin, field, value)
        );
        
        true
    }
    
    // Check if all required metadata is verified for SEP-1 compliance
    pub fn is_sep1_compliant(env: Env) -> bool {
        let metadata_verified: Map<String, bool> = env.storage()
            .instance()
            .get(&Symbol::new(&env, "metadata_verified"))
            .unwrap_or_else(|| Map::new(&env));
        
        let required_fields = vec![
            &env,
            String::from_str(&env, "name"),
            String::from_str(&env, "symbol"),
            String::from_str(&env, "decimals"),
            String::from_str(&env, "icon"),
            String::from_str(&env, "organization"),
            String::from_str(&env, "domain"),
            String::from_str(&env, "description"),
        ];
        
        for field in required_fields.iter() {
            if !metadata_verified.get(field.clone()).unwrap_or(false) {
                return false;
            }
        }
        
        true
    }
    
    // Get metadata verification status
    pub fn get_metadata_status(env: Env) -> Map<String, bool> {
        env.storage()
            .instance()
            .get(&Symbol::new(&env, "metadata_verified"))
            .unwrap_or_else(|| Map::new(&env))
    }
    
    // Batch verify multiple metadata fields
    pub fn batch_verify_metadata(
        env: Env,
        admin: Address,
        fields: Vec<String>,
        values: Vec<String>
    ) -> bool {
        admin.require_auth();
        
        if fields.len() != values.len() {
            return false;
        }
        
        let mut all_verified = true;
        
        for i in 0..fields.len() {
            let field = fields.get(i).unwrap();
            let value = values.get(i).unwrap();
            
            if !Self::verify_metadata(env.clone(), admin.clone(), field, value) {
                all_verified = false;
                break;
            }
        }
        
        all_verified
    }
}
