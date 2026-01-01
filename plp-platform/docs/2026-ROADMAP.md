# PLP 2026 Roadmap

## Vision
Keep users inside PLP for the entire lifecycle: **Predict → Launch → Trade → Track**

---

## Feature 1: Multi-Launchpad Support

### Goal
Let creators choose where their token launches while keeping all PLP mechanics identical.

### Supported Launchpads
| Launchpad | Status | Notes |
|-----------|--------|-------|
| Pump.fun | Current | Default option |
| Raydium LaunchLab | Planned | Revenue sharing, customizable |
| LetsBONK.fun | Planned | Uses Raydium infra |
| Moonshot | Planned | Mobile/fiat friendly |

### What Changes
- Creator selects launchpad during market creation
- `resolve_market` routes to different CPI based on selection
- Token URL points to correct platform

### What Stays The Same
- Market PDAs (derived from founder + ipfs_cid)
- Voting mechanics (YES/NO with SOL)
- AMM pricing (constant product)
- Distribution split (2% platform, 33% team, 65% voters)
- All other market logic

### Implementation Approach

**Database**
```
PredictionMarket {
  + launchpadType: 'pump_fun' | 'raydium' | 'bonk' | 'moonshot'
  + tokenAddress: string  // generic field (replaces pumpFunTokenAddress)
}
```

**Smart Contract**
```rust
// create_market: Add launchpad_type parameter
// resolve_market: Route CPI based on launchpad_type
match market.launchpad_type {
    0 => pump_fun_cpi(),
    1 => raydium_cpi(),
    2 => moonshot_cpi(),
}
```

**Frontend**
- Add launchpad dropdown in create market form
- Show launchpad icon/badge on market cards
- Dynamic "View on [Launchpad]" links

### Open Questions
- [ ] Should we set different default target pools per launchpad? (Pump=varies, Raydium=85 SOL)
- [ ] Allow launchpad-specific config (vesting, fees) or keep it simple?
- [ ] Devnet testing strategy for each launchpad?

---

## Feature 2: In-App Trading

### Goal
Users trade launched tokens without leaving PLP.

### Current State
- Market page has trading UI for YES/NO votes
- After launch, users must go to external sites (pump.fun, raydium, dexscreener)
- `JupiterSwap.tsx` component exists but underutilized

### Proposed Solution

**Option A: Repurpose Market Page**
- Before resolution: Vote YES/NO (current)
- After resolution (YES wins): Trade the launched token
- Same UI location, different function based on market state

**Option B: Dedicated "Launched" Section**
- New tab/page showing all successfully launched tokens
- Each token has: Chart, Swap widget, Basic stats
- Portfolio view of user's launched token holdings

**Option C: Both**
- Market page shows token trading post-launch
- Plus a "Launched" dashboard for discovery/portfolio

### Trading Integration

**Jupiter Aggregator** (recommended)
- Single integration covers ALL Solana DEXs
- Best price routing across Pump, Raydium, Orca, etc.
- Existing `JupiterSwap.tsx` can be enhanced
- Works regardless of which launchpad was used

**What to Show**
- Swap widget (SOL ↔ Token)
- Price chart (embed Birdeye or build custom with DexScreener API)
- Basic stats: MC, 24h volume, holders
- User's position: Holdings, PnL since launch

### Implementation Approach

**Phase 1: Basic Swap**
- Add Jupiter swap to launched token pages
- Pull price/MC from Birdeye API
- Simple chart embed

**Phase 2: Enhanced Trading**
- Custom chart with TradingView
- Transaction history
- Price alerts/notifications

**Phase 3: Portfolio**
- Dashboard of all user's PLP-launched tokens
- Aggregate PnL tracking
- Performance leaderboards

### Open Questions
- [ ] Which option (A, B, or C) do you prefer?
- [ ] Do we need limit orders or just market swaps?
- [ ] Should trading be available for ALL launched tokens or only ones user voted on?

---

## Implementation Priority

### Recommended Order

**Sprint 1: Trading Foundation**
- [ ] Enhance Jupiter integration on launched token pages
- [ ] Add basic price/chart display
- [ ] Repurpose market page post-resolution

*Why first: Immediate value, users already have launched tokens*

**Sprint 2: Multi-Launchpad Backend**
- [ ] Update database schema
- [ ] Modify smart contract with launchpad routing
- [ ] Add Raydium LaunchLab CPI

*Why second: Needs more testing, contract changes*

**Sprint 3: Multi-Launchpad Frontend**
- [ ] Launchpad selector in create form
- [ ] UI updates for different launchpads
- [ ] Add remaining launchpads (BONK, Moonshot)

**Sprint 4: Polish**
- [ ] Portfolio dashboard
- [ ] Enhanced charts
- [ ] Notifications

---

## Technical Notes

### Jupiter Integration
```typescript
// Already have @jup-ag/terminal
// Can use for simple swaps on any launched token
// Works with Pump.fun, Raydium, all DEXs
```

### Raydium LaunchLab
```
Program ID (Mainnet): LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj
Program ID (Devnet): DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6
SDK: @raydium-io/raydium-sdk-v2
```

### Smart Contract Size
Adding `launchpad_type` (u8) to Market struct: +1 byte
Minimal impact on rent.

---

## What We're NOT Doing (For Now)

- ❌ Kalshi/Polymarket integration (complex, phase 2)
- ❌ Secondary prediction markets on launched tokens (cool but scope creep)
- ❌ Full DEX features (order books, limit orders)
- ❌ Cross-chain anything

---

## Success Metrics

1. **Retention**: % of users who return after token launch
2. **Trading Volume**: SOL volume through PLP's Jupiter integration
3. **Launchpad Diversity**: % of markets using non-Pump launchpads
4. **Time on Site**: Average session duration post-launch

---

## Next Steps

1. Review this plan
2. Decide on open questions
3. Finalize sprint priorities
4. Start implementation
