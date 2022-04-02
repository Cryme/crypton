use anchor_lang::prelude::*;
// use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("AugCL9CzhtXXsL5W8ZQNmSohqEz9gGBHQRKYE1DC5amA");

const SEED: &str = "admin";
const WALLET_SEED: &str = "wallet";

#[program]
mod crypton {
    use anchor_lang::solana_program::entrypoint::ProgramResult;
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        ctx.accounts.admin_settings.admin_key = ctx.accounts.admin.key.clone();
        msg!("New admin key: {}", ctx.accounts.admin_settings.admin_key);
        ctx.accounts.admin_settings.bump = *ctx.bumps.get(WALLET_SEED).unwrap();
        Ok(())
    }
    
    pub fn donate(ctx: Context<Donate>, data: u64) -> ProgramResult{
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.from_account.key(),
            &ctx.accounts.to_account.key(),
            data,
        );
        let res = anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.from_account.clone(),
                ctx.accounts.to_account.clone(),
                ctx.accounts.system_program.to_account_info(),
            ],
        );
        
        if res.is_ok(){
            ctx.accounts.admin_settings.history_donaters.push(ctx.accounts.from_account.key());
            ctx.accounts.admin_settings.history_amount.push(data);
            return Ok(());
        }
        
        res
    }
    
    pub fn claim_donates(ctx: Context<ClaimDonates>) -> ProgramResult{
        let prob_rent = Rent::get()?.minimum_balance(ctx.accounts.wallet.data_len());
    
        if **ctx.accounts.wallet.lamports.borrow() <= prob_rent{
            return Err(ProgramError::InsufficientFunds);
        }
        
        let available_amount = **ctx.accounts.wallet.lamports.borrow() - prob_rent;
        
        **ctx.accounts.wallet.try_borrow_mut_lamports()? -= available_amount;
        **ctx.accounts.owner.try_borrow_mut_lamports()? += available_amount;
        Ok(())
        
    }
}

// --> IdlError: Type not found: {"type":{"defined":"Donation"}}
//
// #[derive(
// BorshDeserialize,
// BorshSerialize,
// Clone,
// Copy,
// Default,
// Eq,
// Hash,
// Ord,
// PartialEq,
// PartialOrd,
// )]
// pub struct Donation{
//     donater: Pubkey,
//     amount: u64
// }

#[account]
pub struct AdminData {
    admin_key: Pubkey,
    bump: u8,
    history_donaters: Vec<Pubkey>,
    history_amount: Vec<u64>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    /// CHECK: nothing
    #[account(mut, signer)]
    pub from_account: AccountInfo<'info>,
    /// CHECK: nothing
    #[account(mut, seeds = [WALLET_SEED.as_bytes()], bump)]
    pub to_account: AccountInfo<'info>,
    #[account(mut, seeds = [SEED.as_bytes(), program_id.as_ref()], bump)]
    pub admin_settings: Account<'info, AdminData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimDonates<'info> {
    /// CHECK: nothing
    #[account(mut, constraint = admin_settings.admin_key == owner.key())]
    pub owner: AccountInfo<'info>,
    #[account(seeds = [SEED.as_bytes(), program_id.as_ref()], bump)]
    pub admin_settings: Account<'info, AdminData>,
    /// CHECK: nothing
    #[account(mut)]
    pub wallet: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        space = 8+32+(4*2+32*100)+(4*2+8*100)+1,
        payer = admin,
        seeds = [SEED.as_bytes(), program_id.as_ref()], bump
    )]
    pub admin_settings: Account<'info, AdminData>,
    /// CHECK: nothing
    #[account(init, space = 0, payer = admin, seeds = [WALLET_SEED.as_bytes()], bump)]
    pub wallet: AccountInfo<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}