# AMM Design Discussion: Shares vs SOL for Winner Determination

**Date:** 2025-12-17
**Status:** Pending Discussion
**Priority:** Design Review

## Observation

In market `FVRwozVtfCZMe9ahVZTc23V8mr2WXSfW5PDPNcfQpjYK`:
- YES side: **0.05 SOL** staked → **44%** shares (0.0356 tokens)
- NO side: **0.04 SOL** staked → **56%** shares (0.0442 tokens)
- **Result:** NO won despite having less SOL invested

## Current Design

Winner is determined by **total shares**, not total SOL:
```rust
// resolve_market.rs:161-166
if market.total_yes_shares > market.total_no_shares {
    MarketResolution::YesWins
} else if market.total_no_shares > market.total_yes_shares {
    MarketResolution::NoWins
}
```

The AMM uses constant product formula where:
- Buying one side increases its price
- Early buyers get more shares per SOL
- Late buyers get fewer shares per SOL

## Why This Happens

| Timing | Price Effect | Shares per SOL |
|--------|--------------|----------------|
| Early buyer | Low price | More shares |
| Late buyer | High price | Fewer shares |

If NO voters bought early (cheap) and YES voters bought late (expensive), NO can win with less total SOL.

## Question to Discuss

**Should winner be determined by:**
1. **Shares (current)** - Rewards early conviction, enables price discovery
2. **SOL amount** - More intuitive, "whoever invests more wins"
3. **Hybrid** - Some combination

## Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| Shares (current) | Price discovery, discourages bandwagon | Can be counterintuitive to users |
| SOL amount | Simple, intuitive | No price signal, encourages late voting |

## Conclusion (Pending)

Current behavior is **NOT a bug** - it's working as designed per standard AMM prediction market mechanics (similar to Polymarket).

However, may want to:
1. Add better UI explanation of how shares work
2. Consider if simpler model is better for user experience
3. Evaluate if price discovery is valuable for this use case

---
*To be discussed when time permits*
