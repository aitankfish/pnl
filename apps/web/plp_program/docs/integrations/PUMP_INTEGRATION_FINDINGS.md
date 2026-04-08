# Pump.fun Integration Findings

## ✅ Verified Information

### Program Details
- **Program ID**: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
- **Networks**: Mainnet-beta AND Devnet (same ID)
- **Framework**: Anchor-based
- **Token Standard**: 6-decimal SPL tokens (not 9!)

### Available Instructions
1. **`create()`** - Launch new token with bonding curve
2. **`buy()`** - Purchase tokens from bonding curve
3. **`sell()`** - Sell tokens back to bonding curve
4. **`migrate()`** - Migrate completed curve to PumpSwap (permissionless)

### Required Accounts (for create + buy)

**For `create()`:**
- `mint` (signer) - New token mint keypair
- `bonding_curve` (PDA) - Derived from `["bonding-curve", mint]`
- `associated_bonding_curve` (ATA) - Token account for bonding curve
- `global` (PDA) - Derived from `["global"]`
- `user` (signer) - Creator wallet
- `system_program`
- `token_program`
- `associated_token_program`
- `rent`
- `event_authority` (PDA) - Derived from `["__event_authority"]`

**For `buy()`:**
- All create accounts PLUS:
- `associated_user` - User's ATA for the token
- `fee_recipient` - Fee collection account (from global config)

### Fees & Mechanics
- **Trading Fee**: 1% (100 basis points)
- **Bonding Curve**: Uniswap V2 style (constant product)
- **Migration Cost**: Max 15M lamports (0.015 SOL)

---

## 🔧 Implementation Options

### Option 1: Full On-Chain CPI (Complex)

**Pros:**
- Fully decentralized
- No client-side steps

**Cons:**
- Requires ~12 accounts in `resolve_market` instruction
- Complex PDA derivations
- Higher compute cost
- Need to pass mint keypair or generate on-chain (tricky)

**Implementation:**
```toml
# Cargo.toml
[dependencies]
pump = { git = "https://github.com/s6nqou/pump-anchor", features = ["cpi"] }
```

```rust
// In resolve_market.rs
use pump::cpi;

pub fn handler(ctx: Context<ResolveMarket>) -> Result<()> {
    // ... resolution logic ...

    // Create token via CPI
    let mint = ctx.accounts.mint.key();
    pump::cpi::create(
        CpiContext::new(...),
        name,
        symbol,
        uri,
    )?;

    // Buy tokens via CPI
    pump::cpi::buy(
        CpiContext::new(...),
        amount,
        max_sol_cost,
    )?;

    Ok(())
}
```

---

### Option 2: Client-Side Creation (Recommended for MVP) ⭐

**Pros:**
- Simpler on-chain program
- Fewer accounts required
- Easier debugging
- Lower compute cost
- Can use existing Pump.fun libraries/SDKs

**Cons:**
- Requires 2-step process (create → resolve)
- Slightly less decentralized (but still trustless)

**Implementation Flow:**

**Step 1: Client creates token**
```typescript
// Frontend or API route
const mint = await createPumpToken({
  name: "PLP-xyz",
  symbol: "PLP",
  uri: metadata_uri,
  buyAmount: 0, // Don't buy yet
});
```

**Step 2: Resolve with existing mint**
```rust
// In resolve_market.rs - MUCH SIMPLER!
#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// Token mint created by client
    pub token_mint: Account<'info, Mint>,

    // ... other accounts ...
}

pub fn handler(ctx: Context<ResolveMarket>) -> Result<()> {
    // ... resolution logic ...

    match resolution {
        MarketResolution::YesWins => {
            // Store the mint address
            market.token_mint = Some(ctx.accounts.token_mint.key());

            // Buy tokens via CPI
            pump::cpi::buy(
                CpiContext::new(...),
                market.pool_balance, // Use all SOL
                u64::MAX, // No slippage limit for initial buy
            )?;

            // ... distribute tokens ...
        }
        // ...
    }

    Ok(())
}
```

---

### Option 3: Hybrid (Best of Both Worlds) 🚀

**Pros:**
- Most flexible
- Fallback if CPI fails
- Can optimize per-case

**Cons:**
- More complex codebase

**Implementation:**
- Frontend creates token by default
- On-chain has CPI capability as fallback
- Use feature flags to toggle behavior

---

## 📊 Comparison

| Feature | Option 1 (Full CPI) | Option 2 (Client-Side) | Option 3 (Hybrid) |
|---------|---------------------|------------------------|-------------------|
| Complexity | High | Low | Medium |
| Accounts Required | ~15 | ~8 | ~15 |
| Compute Units | High | Low | Medium |
| Decentralization | Full | High | Full |
| MVP Timeline | 2-3 days | 1 day | 2 days |
| Maintainability | Medium | High | Medium |

---

## 💡 Recommendation

**Go with Option 2 (Client-Side Creation) for MVP**, then upgrade to Option 3 (Hybrid) if needed.

**Reasoning:**
1. ✅ Faster to implement (1 day vs 3 days)
2. ✅ Lower compute costs (saves users money)
3. ✅ Easier debugging during testing
4. ✅ Still fully trustless (client can't cheat)
5. ✅ Can upgrade later without breaking changes

---

## 🎯 Next Steps

### For Option 2 (Recommended):

1. **Update resolve_market.rs** (30 min)
   - Add `token_mint: Account<'info, Mint>` account
   - Remove pump create CPI stub
   - Keep pump buy CPI (or stub for testing)

2. **Create API endpoint** (1 hour)
   - `/api/markets/create-token`
   - Uses pump-fun SDK or direct RPC calls
   - Returns mint address

3. **Update frontend** (1 hour)
   - Call create-token API before resolve
   - Pass mint address to resolve instruction

4. **Test on devnet** (2 hours)
   - Create market
   - Extend to funding
   - Resolve with token creation
   - Verify token minted and bought

### For Option 1 (Full CPI):

1. **Add pump-anchor dependency** (15 min)
2. **Update Cargo.toml and import crate** (15 min)
3. **Add 12+ accounts to ResolveMarket struct** (1 hour)
4. **Implement create + buy CPI calls** (2 hours)
5. **Handle mint keypair generation** (1 hour)
6. **Test extensively** (4 hours)

---

## 📚 Resources

- **Official Docs**: https://github.com/pump-fun/pump-public-docs
- **Anchor SDK**: https://github.com/s6nqou/pump-anchor
- **Testnet**: https://testnetpump.fun (Program ID: 6sbiyZ7mLKmYkES2AKYPHtg4FjQMaqVx3jTHez6ZtfmX)
- **Pump Portal**: https://pumpportal.fun/creation/

---

## ⚠️ Important Notes

1. **Tokens are 6-decimal**, not 9-decimal like standard SPL
2. **1% fee** applies to all buy/sell operations
3. **Bonding curve completes** when certain threshold reached
4. **Migration to PumpSwap** happens after curve completes
5. **On devnet**, test with small amounts first (0.1-1 SOL)

