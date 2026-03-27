#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, token};

#[contracttype]
#[derive(Clone, Default, Debug, Eq, PartialEq)]
pub struct YieldConfig {
    pub is_opted_in: bool,
    pub safety_buffer_percent: u32,
}

#[contract]
pub struct YieldManagementContract;

#[contractimpl]
impl YieldManagementContract {
    pub fn configure_yield(env: Env, employer: Address, opt_in: bool, safety_buffer: u32) {
        employer.require_auth();
        assert!(safety_buffer <= 100, "Buffer cannot exceed 100%");
        let config = YieldConfig { is_opted_in: opt_in, safety_buffer_percent: safety_buffer };
        env.storage().persistent().set(&employer, &config);
    }

    pub fn deposit_idle_funds(env: Env, employer: Address, token_address: Address, amount: i128) {
        employer.require_auth();
        let config: YieldConfig = env.storage().persistent().get(&employer).unwrap_or_default();
        if !config.is_opted_in { panic!("Not opted in"); }

        let buffer_amount = (amount * config.safety_buffer_percent as i128) / 100;
        let investable_amount = amount - buffer_amount;

        let token = token::Client::new(&env, &token_address);
        token.transfer(&employer, &env.current_contract_address(), &investable_amount);

        let mut invested: i128 = env.storage().persistent().get(&(employer.clone(), token_address.clone())).unwrap_or(0);
        invested += investable_amount;
        env.storage().persistent().set(&(employer, token_address), &invested);
    }

    pub fn withdraw_for_payroll(env: Env, employer: Address, token_address: Address) {
        let invested: i128 = env.storage().persistent().get(&(employer.clone(), token_address.clone())).unwrap_or(0);
        if invested == 0 { return; }

        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &employer, &invested);
        env.storage().persistent().set(&(employer, token_address), &0_i128);
    }
}