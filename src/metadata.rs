use soroban_sdk::{Env, String, Map, Vec};

pub struct SEP1Metadata;

impl SEP1Metadata {
    // Validate metadata field according to SEP-1 standards
    pub fn validate_field(env: &Env, field: &String, value: &String) -> bool {
        let field_str = field.to_string();
        
        match field_str.as_str() {
            "name" => !value.is_empty() && value.len() <= 100,
            "symbol" => !value.is_empty() && value.len() <= 10,
            "decimals" => value.len() <= 2,
            "icon" => value.starts_with("data:image/") || value.starts_with("http"),
            "organization" => !value.is_empty() && value.len() <= 100,
            "domain" => !value.is_empty() && value.len() <= 253,
            "description" => !value.is_empty() && value.len() <= 500,
            _ => false,
        }
    }
    
    // Get all metadata fields
    pub fn get_all_metadata(env: &Env) -> Map<String, String> {
        let mut metadata = Map::new(env);
        
        // Retrieve stored metadata
        if let Some(name) = env.storage().instance().get(&Symbol::new(env, "name")) {
            metadata.set(String::from_str(env, "name"), name);
        }
        
        if let Some(symbol) = env.storage().instance().get(&Symbol::new(env, "symbol")) {
            metadata.set(String::from_str(env, "symbol"), symbol);
        }
        
        if let Some(decimals) = env.storage().instance().get(&Symbol::new(env, "decimals")) {
            metadata.set(String::from_str(env, "decimals"), decimals);
        }
        
        if let Some(icon) = env.storage().instance().get(&Symbol::new(env, "icon")) {
            metadata.set(String::from_str(env, "icon"), icon);
        }
        
        if let Some(organization) = env.storage().instance().get(&Symbol::new(env, "organization")) {
            metadata.set(String::from_str(env, "organization"), organization);
        }
        
        if let Some(domain) = env.storage().instance().get(&Symbol::new(env, "domain")) {
            metadata.set(String::from_str(env, "domain"), domain);
        }
        
        if let Some(description) = env.storage().instance().get(&Symbol::new(env, "description")) {
            metadata.set(String::from_str(env, "description"), description);
        }
        
        metadata
    }
    
    // Check SEP-1 compliance status
    pub fn check_compliance(env: &Env) -> bool {
        let metadata_verified: Map<String, bool> = env.storage()
            .instance()
            .get(&Symbol::new(env, "metadata_verified"))
            .unwrap_or_else(|| Map::new(env));
        
        let required_fields = vec![
            &env,
            String::from_str(env, "name"),
            String::from_str(env, "symbol"),
            String::from_str(env, "decimals"),
            String::from_str(env, "icon"),
            String::from_str(env, "organization"),
            String::from_str(env, "domain"),
            String::from_str(env, "description"),
        ];
        
        for field in required_fields.iter() {
            if !metadata_verified.get(field.clone()).unwrap_or(false) {
                return false;
            }
        }
        
        true
    }
}
