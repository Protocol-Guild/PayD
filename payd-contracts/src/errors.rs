use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, ext_event)]
pub enum PayDContractError {
    InvalidAssetPair = 1850,
    InsufficientLiquidity = 1851,
    EventIndexingFailed = 1852,
    CrossAssetExecutionFailed = 1853,
    Unauthorized = 1,
    InvalidAmount = 2,
    InsufficientBalance = 3,
}
