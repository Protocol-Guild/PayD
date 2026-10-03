use soroban_sdk::Symbol;

pub struct AssetConfig {
    pub rate: f64,
    pub decimals: u32,
    pub max_supply: i128,
}

pub struct CrossAssetCalculator;

impl CrossAssetCalculator {
    pub fn calculate_conversion(
        from_amount: i128,
        from_rate: f64,
        to_rate: f64,
        decimals: u32,
    ) -> i128 {
        let base_value = (from_amount as f64) * from_rate;
        let converted = (base_value / to_rate) as i128;
        converted
    }
}
