//! Constant Product AMM for Prediction Markets
//!
//! Formula: x * y = k (constant product)
//!
//! Where:
//! - x = YES token reserves
//! - y = NO token reserves
//! - k = constant product (liquidity)
//!
//! Prices always sum to 1:
//! - YES price = y / (x + y)
//! - NO price = x / (x + y)
//!
//! When buying YES:
//! - User pays SOL
//! - YES reserves decrease (shares removed from pool)
//! - NO reserves increase (to maintain k)
//! - YES price goes up, NO price goes down

use crate::errors::ErrorCode;

/// Calculate shares received when buying from AMM
///
/// Formula derivation:
/// - Current: x_old * y_old = k
/// - User pays: sol_amount
/// - After trade: x_new * y_new = k (same constant)
/// - User receives: x_old - x_new shares
///
/// For buying YES (removing from x pool):
/// - y_new = y_old + sol_amount (SOL goes to NO pool)
/// - x_new = k / y_new
/// - shares = x_old - x_new
///
/// Args:
/// - yes_pool: Current YES token reserves (scaled by 1e9)
/// - no_pool: Current NO token reserves (scaled by 1e9)
/// - sol_lamports: Amount of SOL to spend (after fees)
/// - buy_yes: true if buying YES, false if buying NO
///
/// Returns: Number of shares (scaled by 1e9)
pub fn calculate_shares_from_sol(
    yes_pool: u64,
    no_pool: u64,
    sol_lamports: u64,
    buy_yes: bool,
) -> Result<u64, ErrorCode> {
    if yes_pool == 0 || no_pool == 0 {
        return Err(ErrorCode::MathError);
    }
    if sol_lamports == 0 {
        return Ok(0);
    }

    // Calculate k = x * y (use u128 to prevent overflow)
    let k = (yes_pool as u128)
        .checked_mul(no_pool as u128)
        .ok_or(ErrorCode::MathError)?;

    if buy_yes {
        // Buying YES: SOL goes to NO pool, YES shares decrease
        // y_new = y_old + sol_amount
        let no_pool_new = (no_pool as u128)
            .checked_add(sol_lamports as u128)
            .ok_or(ErrorCode::MathError)?;

        // x_new = k / y_new
        let yes_pool_new = k
            .checked_div(no_pool_new)
            .ok_or(ErrorCode::MathError)?;

        // shares = x_old - x_new
        let shares = (yes_pool as u128)
            .checked_sub(yes_pool_new)
            .ok_or(ErrorCode::MathError)?;

        // Ensure we don't drain the pool completely (keep minimum liquidity)
        // TODO: Revert to 0.1 SOL (100_000_000) after testing/launch
        if yes_pool_new < 10_000_000 {
            // Min 0.01 YES token (lowered for testing)
            return Err(ErrorCode::InsufficientBalance);
        }

        Ok(shares as u64)
    } else {
        // Buying NO: SOL goes to YES pool, NO shares decrease
        // x_new = x_old + sol_amount
        let yes_pool_new = (yes_pool as u128)
            .checked_add(sol_lamports as u128)
            .ok_or(ErrorCode::MathError)?;

        // y_new = k / x_new
        let no_pool_new = k
            .checked_div(yes_pool_new)
            .ok_or(ErrorCode::MathError)?;

        // shares = y_old - y_new
        let shares = (no_pool as u128)
            .checked_sub(no_pool_new)
            .ok_or(ErrorCode::MathError)?;

        // Ensure we don't drain the pool completely
        // TODO: Revert to 0.1 SOL (100_000_000) after testing/launch
        if no_pool_new < 10_000_000 {
            // Min 0.01 NO token (lowered for testing)
            return Err(ErrorCode::InsufficientBalance);
        }

        Ok(shares as u64)
    }
}

/// Get current price of YES in terms of probability (0 to 1, scaled by 1e9)
///
/// Price = NO_pool / (YES_pool + NO_pool)
///
/// Returns: Price scaled by 1e9 (e.g., 500_000_000 = 0.5 = 50%)
pub fn get_yes_price(yes_pool: u64, no_pool: u64) -> Result<u64, ErrorCode> {
    if yes_pool == 0 && no_pool == 0 {
        return Err(ErrorCode::MathError);
    }

    let total = (yes_pool as u128)
        .checked_add(no_pool as u128)
        .ok_or(ErrorCode::MathError)?;

    let price = ((no_pool as u128) * 1_000_000_000)
        .checked_div(total)
        .ok_or(ErrorCode::MathError)?;

    Ok(price as u64)
}

/// Get current price of NO in terms of probability (0 to 1, scaled by 1e9)
///
/// Price = YES_pool / (YES_pool + NO_pool)
///
/// Returns: Price scaled by 1e9
pub fn get_no_price(yes_pool: u64, no_pool: u64) -> Result<u64, ErrorCode> {
    if yes_pool == 0 && no_pool == 0 {
        return Err(ErrorCode::MathError);
    }

    let total = (yes_pool as u128)
        .checked_add(no_pool as u128)
        .ok_or(ErrorCode::MathError)?;

    let price = ((yes_pool as u128) * 1_000_000_000)
        .checked_div(total)
        .ok_or(ErrorCode::MathError)?;

    Ok(price as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_prices_are_50_50() {
        // Equal pools = 50/50 prices
        let yes_price = get_yes_price(1000_000_000_000, 1000_000_000_000).unwrap();
        let no_price = get_no_price(1000_000_000_000, 1000_000_000_000).unwrap();

        assert_eq!(yes_price, 500_000_000); // 0.5
        assert_eq!(no_price, 500_000_000); // 0.5
        assert_eq!(yes_price + no_price, 1_000_000_000); // Sum to 1.0
    }

    #[test]
    fn test_buying_yes_increases_yes_price() {
        let yes_pool = 1000_000_000_000;
        let no_pool = 1000_000_000_000;

        let initial_yes_price = get_yes_price(yes_pool, no_pool).unwrap();

        // Buy 100 SOL worth of YES
        let shares = calculate_shares_from_sol(yes_pool, no_pool, 100_000_000_000, true).unwrap();

        // New pools after purchase
        let yes_pool_new = yes_pool - shares;
        let no_pool_new = no_pool + 100_000_000_000;

        let new_yes_price = get_yes_price(yes_pool_new, no_pool_new).unwrap();

        // YES price should have increased
        assert!(new_yes_price > initial_yes_price);

        // Prices should still sum to 1.0
        let new_no_price = get_no_price(yes_pool_new, no_pool_new).unwrap();
        assert_eq!(new_yes_price + new_no_price, 1_000_000_000);
    }

    #[test]
    fn test_constant_product_maintained() {
        let yes_pool = 1000_000_000_000;
        let no_pool = 1000_000_000_000;
        let k = (yes_pool as u128) * (no_pool as u128);

        // Buy YES
        let shares = calculate_shares_from_sol(yes_pool, no_pool, 100_000_000_000, true).unwrap();

        let yes_pool_new = yes_pool - shares;
        let no_pool_new = no_pool + 100_000_000_000;
        let k_new = (yes_pool_new as u128) * (no_pool_new as u128);

        // k should be maintained (within rounding error)
        let diff = if k > k_new { k - k_new } else { k_new - k };
        assert!(diff < k / 1000); // Within 0.1% tolerance
    }
}
