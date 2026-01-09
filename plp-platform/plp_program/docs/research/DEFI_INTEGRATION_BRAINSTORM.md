# DeFi Integration Brainstorm: Staking, Lending & Borrowing for P&L

## Executive Summary

This document explores how P&L can integrate DeFi primitives (staking, lending, borrowing, yield) to create additional utility and revenue streams beyond the core prediction market functionality.

---

## DeFi Integration Opportunities Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         P&L DeFi Ecosystem                               │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   $PNL Staking  │  │ Position Finance│  │  Yield Strategy │         │
│  │                 │  │                 │  │                 │         │
│  │ • Revenue Share │  │ • Borrow vs     │  │ • LST Deposits  │         │
│  │ • Governance    │  │   Position      │  │ • LP Staking    │         │
│  │ • Tier Rewards  │  │ • Position NFTs │  │ • Auto-compound │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│           └────────────────────┼────────────────────┘                   │
│                                │                                         │
│                    ┌───────────▼───────────┐                            │
│                    │   Integration Layer   │                            │
│                    │                       │                            │
│                    │  Kamino │ Marginfi    │                            │
│                    │  Meteora│ Streamflow  │                            │
│                    └───────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Category 1: $PNL Token Staking

*Already covered in `PNL_TOKEN_UTILITY.md`*

### Core Features
- 2.5% platform fee → staked holders
- Tier multipliers (Bronze/Silver/Gold)
- SOL rewards (non-inflationary)

### Additional Staking Ideas

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Vote-Escrowed PNL (vePNL)** | Lock longer = more voting power + rewards | Medium |
| **Staking NFTs** | Receipt NFTs for staked positions | Low |
| **Staking Pools** | Different lock durations with different APYs | Medium |
| **Auto-compound** | Reinvest SOL rewards into $PNL | Medium |

---

## Category 2: Prediction Position Finance

### Concept: Position-Backed Lending

Users can borrow against their active prediction market positions.

```
User has position:
    - 10,000 YES shares in Market XYZ
    - Current value: ~50 SOL
    - Market expires in 30 days
        ↓
Deposit position as collateral
        ↓
Borrow up to 50% LTV (~25 SOL)
        ↓
Use borrowed SOL for:
    - More predictions
    - Other DeFi
    - Cash out early
        ↓
If market resolves in your favor:
    - Repay loan + interest
    - Keep profits

If market resolves against you:
    - Position liquidated
    - Lender made whole from collateral
```

### Implementation Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Position Lending Protocol                    │
│                                                               │
│  ┌─────────────────┐        ┌─────────────────┐             │
│  │  Position NFT   │        │   Lending Pool  │             │
│  │                 │        │                 │             │
│  │ • Market ID     │───────▶│ • SOL reserves  │             │
│  │ • YES/NO shares │        │ • Interest rate │             │
│  │ • Entry price   │        │ • LTV ratios    │             │
│  │ • Expiry        │        │ • Liquidation   │             │
│  └─────────────────┘        └─────────────────┘             │
│           │                          │                       │
│           │     Collateralize        │                       │
│           └──────────────────────────┘                       │
│                                                               │
│  Risk Parameters:                                             │
│  • LTV: 30-50% (based on time to expiry)                     │
│  • Liquidation: If position value < 120% of loan             │
│  • Interest: Variable based on utilization                    │
└──────────────────────────────────────────────────────────────┘
```

### Position NFT Design

Tokenize prediction positions as transferable NFTs:

```rust
pub struct PositionNFT {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub yes_shares: u64,
    pub no_shares: u64,
    pub entry_timestamp: i64,
    pub average_entry_price: u64,
    pub metadata_uri: String,
    // Lending status
    pub is_collateralized: bool,
    pub loan_amount: u64,
    pub lender: Option<Pubkey>,
}
```

**Benefits:**
- Positions become tradeable on secondary markets
- Can be used as collateral in other DeFi protocols
- Enables position transfers without closing

### Integration with Existing Protocols

#### Option A: Custom Lending Pool

Build P&L-native lending:

```rust
// Simplified lending pool structure
pub struct LendingPool {
    pub total_deposits: u64,
    pub total_borrowed: u64,
    pub interest_rate_model: InterestRateModel,
    pub accepted_collateral: Vec<CollateralType>,
}

pub enum CollateralType {
    PositionNFT { min_ltv: u64, liquidation_threshold: u64 },
    PnlToken { min_ltv: u64, liquidation_threshold: u64 },
    LaunchedToken { min_ltv: u64, liquidation_threshold: u64 },
}
```

#### Option B: Rain.fi Integration

Rain.fi offers peer-to-peer NFT lending on Solana:

- No price-based liquidations
- Flexible loan terms
- Instant liquidity against NFTs

**Integration:** Mint Position NFTs → List on Rain.fi → Borrow SOL

#### Option C: Custom Orderbook Lending

Peer-to-peer lending with custom terms:

```
Borrower: "I'll pay 5% for 30-day loan against my YES position"
Lender: "I'll lend 20 SOL against that position at 5%"
        ↓
Match and execute
        ↓
Position locked until repayment or liquidation
```

---

## Category 3: Launched Token DeFi

After a market resolves YES and token launches, enable DeFi for that token.

### 3.1 Lending Markets for Launched Tokens

Partner with or integrate existing lending protocols:

| Protocol | SDK | Features |
|----------|-----|----------|
| **Kamino** | `@kamino-finance/klend-sdk` | Lending pools, leverage |
| **Marginfi** | `@mrgnlabs/marginfi-client-v2` | Multi-asset lending |
| **Solend** | `@solendprotocol/solend-sdk` | Permissionless pools |

**Integration Flow:**
```typescript
// After token graduates to DEX
async function enableLendingMarket(tokenMint: PublicKey) {
  // Option 1: Request Kamino listing
  // Option 2: Create Marginfi isolated pool
  // Option 3: Create Solend permissionless pool

  // Marginfi example
  const client = await MarginfiClient.fetch(config, wallet);
  const bank = await client.createBank({
    mint: tokenMint,
    oracleType: 'pyth', // or custom
    // ... config
  });
}
```

### 3.2 LP Staking Rewards

Incentivize liquidity provision for launched tokens:

```
Token graduates → Creates Raydium/Meteora LP
        ↓
P&L creates LP staking pool
        ↓
LP providers stake LP tokens
        ↓
Earn rewards in:
    • Launched token (from team allocation)
    • $PNL (platform incentive)
    • Trading fees
```

**Implementation with Streamflow:**
```typescript
// Create LP staking pool via Streamflow
const stakingPool = await streamflow.staking.createPool({
  token: LP_TOKEN_MINT,
  rewardTokens: [LAUNCHED_TOKEN, PNL_MINT],
  duration: 90 * 24 * 60 * 60, // 90 days
});
```

### 3.3 Token Buyback Vaults

Use protocol revenue to buy back launched tokens:

```
2.5% of fees → Revenue vault
        ↓
Periodic buybacks of top-performing tokens
        ↓
Distribute to:
    • $PNL stakers (bonus rewards)
    • Burn (deflationary)
    • DAO treasury
```

---

## Category 4: Liquid Staking Integration

### Accept LSTs for Predictions

Instead of only SOL, accept liquid staking tokens:

```
Supported Deposits:
    • SOL (native)
    • mSOL (Marinade)
    • JitoSOL (Jito)
    • bSOL (BlazeStake)
        ↓
Benefits:
    • Users earn staking yield (~7%) WHILE predicting
    • More capital efficiency
    • Attracts LST holders
```

### Implementation

```rust
// Modified buy_yes/buy_no to accept LSTs
pub fn buy_yes_with_lst(
    ctx: Context<BuyYesWithLst>,
    amount: u64,
    lst_type: LstType,
) -> Result<()> {
    // Convert LST amount to SOL equivalent using oracle
    let sol_value = get_lst_sol_value(lst_type, amount)?;

    // Credit position based on SOL value
    ctx.accounts.position.yes_shares += calculate_shares(sol_value)?;

    // Transfer LST to market vault
    transfer_lst(ctx.accounts.user_lst_account, ctx.accounts.market_lst_vault, amount)?;

    Ok(())
}
```

### LST Price Feeds

| LST | Pyth Feed | Exchange Rate |
|-----|-----------|---------------|
| mSOL | `mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So` | ~1.15 SOL |
| JitoSOL | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` | ~1.12 SOL |
| bSOL | `bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1` | ~1.08 SOL |

---

## Category 5: Yield Aggregation

### P&L Yield Vaults

Deploy idle funds into yield strategies:

```
Market Pool (before resolution):
    • 1000 SOL sitting in vault
    • Market expires in 30 days
        ↓
Deploy to yield strategy:
    • Kamino SOL vault (~8% APY)
    • Marginfi lending (~6% APY)
    • Meteora dynamic vault (~10% APY)
        ↓
At resolution:
    • Withdraw principal + yield
    • Yield distributed to:
        - Winners (bonus)
        - Platform treasury
        - $PNL stakers
```

### Integration with Meteora Dynamic Vaults

```typescript
import { DynamicVault } from '@meteora-ag/dynamic-vault-sdk';

// Deposit market funds into yield vault
async function depositToYield(marketVault: PublicKey, amount: number) {
  const vault = new DynamicVault(connection, METEORA_SOL_VAULT);

  const depositIx = await vault.deposit({
    amount: new BN(amount),
    userTokenAccount: marketVault,
  });

  return depositIx;
}

// Withdraw when market resolves
async function withdrawFromYield(marketVault: PublicKey) {
  const vault = new DynamicVault(connection, METEORA_SOL_VAULT);

  const withdrawIx = await vault.withdraw({
    amount: new BN(0), // 0 = withdraw all
    userTokenAccount: marketVault,
  });

  return withdrawIx;
}
```

### Risk Considerations

| Risk | Mitigation |
|------|------------|
| Smart contract risk | Use audited protocols only |
| Liquidity risk | Only deploy % of pool, keep reserves |
| Timing risk | Withdraw before market expiry |
| Slippage | Use TWAP withdrawals for large amounts |

---

## Category 6: Composable Position Tokens

### Conditional Token Framework (CTF) Style

Similar to Polymarket's CTF, create composable YES/NO tokens:

```
User buys YES on Market XYZ
        ↓
Receives: YES-XYZ tokens (SPL token)
        ↓
Can use anywhere:
    • Trade on Jupiter
    • Provide liquidity
    • Use as collateral
    • Transfer to friends
```

### Benefits Over Current PDA Positions

| Current (PDA) | Composable (SPL Tokens) |
|---------------|-------------------------|
| Locked to user | Freely transferable |
| No secondary market | Trade on any DEX |
| Can't use as collateral | Use in DeFi |
| Manual claiming | Automatic redemption |

### Implementation

```rust
// Create conditional token mints per market
pub struct Market {
    pub yes_mint: Pubkey,  // SPL token for YES shares
    pub no_mint: Pubkey,   // SPL token for NO shares
    pub collateral_vault: Pubkey,  // SOL locked as collateral
    // ...
}

// Mint YES tokens when user buys
pub fn buy_yes(ctx: Context<BuyYes>, sol_amount: u64) -> Result<()> {
    let yes_tokens = calculate_yes_tokens(sol_amount)?;

    // Deposit SOL to collateral vault
    transfer_sol(ctx.accounts.user, ctx.accounts.collateral_vault, sol_amount)?;

    // Mint YES tokens to user
    mint_to(ctx.accounts.yes_mint, ctx.accounts.user_yes_account, yes_tokens)?;

    Ok(())
}

// Redeem after resolution
pub fn redeem(ctx: Context<Redeem>) -> Result<()> {
    require!(ctx.accounts.market.resolved, ErrorCode::NotResolved);

    if ctx.accounts.market.resolution == Resolution::Yes {
        // Burn YES tokens, pay out SOL
        let yes_balance = ctx.accounts.user_yes_account.amount;
        burn(ctx.accounts.yes_mint, ctx.accounts.user_yes_account, yes_balance)?;

        let payout = calculate_payout(yes_balance, ctx.accounts.market)?;
        transfer_sol(ctx.accounts.collateral_vault, ctx.accounts.user, payout)?;
    }
    // ... handle NO case

    Ok(())
}
```

---

## Category 7: Cross-Protocol Strategies

### Strategy 1: Leveraged Prediction

```
1. Deposit 100 SOL into prediction (YES)
2. Receive Position NFT worth ~100 SOL
3. Borrow 50 SOL against Position NFT
4. Use 50 SOL for more predictions
5. Effective leverage: 1.5x
```

### Strategy 2: Yield-Enhanced Prediction

```
1. Convert SOL → mSOL (earn staking yield)
2. Deposit mSOL into prediction
3. Earn staking yield + prediction outcome
4. Win scenario: staking yield + prediction payout
5. Lose scenario: still kept staking yield during period
```

### Strategy 3: Hedged Position

```
1. Buy YES on Market A with 50 SOL
2. Buy NO on Market A with 50 SOL
3. Guaranteed to win one side
4. Use winning position as collateral
5. Borrow against it immediately
```

---

## Integration Priority Matrix

| Feature | Impact | Complexity | Priority |
|---------|--------|------------|----------|
| $PNL Staking (revenue share) | High | Medium | **P0** |
| Position NFTs | High | Medium | **P1** |
| LST Deposits | Medium | Low | **P1** |
| Position-backed Lending | High | High | **P2** |
| Launched Token Lending | Medium | Medium | **P2** |
| Yield Vaults for Pools | Medium | High | **P3** |
| Composable YES/NO Tokens | High | Very High | **P3** |
| LP Staking Rewards | Medium | Medium | **P2** |

---

## SDK References

### Lending Protocols

| Protocol | Package | Docs |
|----------|---------|------|
| **Kamino** | `@kamino-finance/klend-sdk` | [GitHub](https://github.com/Kamino-Finance/klend-sdk) |
| **Marginfi** | `@mrgnlabs/marginfi-client-v2` | [Docs](https://docs.marginfi.com/ts-sdk) |
| **Solend** | `@solendprotocol/solend-sdk` | [GitHub](https://github.com/solendprotocol/solend-sdk) |

### Yield & Staking

| Protocol | Package | Docs |
|----------|---------|------|
| **Streamflow** | `@streamflow/stream` | [GitHub](https://github.com/streamflow-finance/js-sdk) |
| **Meteora** | `@meteora-ag/dynamic-vault-sdk` | [Docs](https://docs.meteora.ag) |
| **Marinade** | `@marinade.finance/marinade-ts-sdk` | [Docs](https://docs.marinade.finance) |

### NFT & Tokenization

| Protocol | Package | Docs |
|----------|---------|------|
| **Metaplex** | `@metaplex-foundation/js` | [Docs](https://docs.metaplex.com) |
| **Rain.fi** | N/A (UI only) | [App](https://rain.fi) |

---

## Revenue Model Impact

### Additional Revenue Streams

| Feature | Revenue Type | Estimate |
|---------|--------------|----------|
| Position Lending | Interest spread | 1-3% of borrowed |
| Yield Vaults | Performance fee | 10% of yield |
| LP Staking | Platform rewards | Inflationary |
| Position NFT Trading | Royalties | 2.5% of sales |

### Example: Full DeFi Flywheel

```
User Journey:
1. Stake $PNL → Earn 2.5% of platform fees
2. Deposit mSOL into prediction → Earn staking yield while predicting
3. Win prediction → Receive launched token
4. Stake LP tokens → Earn trading fees + $PNL rewards
5. Use Position NFT as collateral → Borrow more SOL
6. Repeat with leveraged capital

Platform Revenue:
• 5% completion fee (2.5% to stakers, 2.5% treasury)
• 1.5% trading fees
• Yield vault performance fees
• Lending interest spread
• NFT royalties
```

---

## Conclusion

P&L can evolve from a prediction market into a **full DeFi ecosystem** by:

1. **$PNL Staking** - Already planned, creates token demand
2. **Position NFTs** - Unlock composability and secondary markets
3. **LST Deposits** - Capital efficiency for users
4. **Position Lending** - Liquidity against locked positions
5. **Yield Optimization** - Put idle funds to work
6. **Composable Tokens** - Full CTF-style integration

The key is **incremental rollout** - start with staking, add Position NFTs, then progressively unlock more DeFi primitives as the platform scales.

---

## Next Steps

1. **Implement $PNL Staking** (already planned)
2. **Design Position NFT standard** (Metaplex compatible)
3. **Prototype LST deposit flow** (start with mSOL)
4. **Evaluate lending protocol partnerships** (Kamino, Marginfi)
5. **Explore yield vault integration** (Meteora Dynamic Vaults)
