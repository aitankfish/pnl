# Token Governance & Trading Fee Escrow System

**Status**: Future Feature (Not Yet Implemented)
**Priority**: High - Voter Protection & Anti-Scam Mechanism
**Estimated Complexity**: Medium (Program Changes + Governance UI)

## Overview

A governance system where trading fees from launched tokens are held in escrow and controlled by token holders. This creates accountability for founders and protection for voters against scam projects.

## Problem Statement

### Current Issues
1. **No Accountability**: Founders can take Pump.fun trading fees and disappear
2. **Scam Risk**: Voters lose their betting stakes with no recourse
3. **Misaligned Incentives**: Founders motivated to pump & dump rather than deliver
4. **No Protection**: If project fails/scams, voters lose everything

### Current Flow
```
Token Launch (YES wins)
    ↓
Token trades on Pump.fun
    ↓
Trading fees accumulate in creator vault
    ↓
Founder withdraws fees anytime (no restrictions)
    ↓
Voters have no recourse if founder disappears
```

## Proposed Solution

### Key Innovation
**Market PDA owns the token, not the founder**
- Market PDA becomes the "creator" in Pump.fun
- Trading fees go to creator vault controlled by Market PDA
- Our program controls fee release via token-based governance
- Project's own launched token is used for governance voting

### New Flow
```
Token Launch (YES wins)
    ↓
Market PDA owns token (not founder)
    ↓
Token trades on Pump.fun
    ↓
Trading fees → Creator vault (Market PDA controlled)
    ↓
GOVERNANCE VOTE: Approve fee release OR flag as scam
    ↓
Scenario A (Legit):        Scenario B (Scam):
Founder gets fees          Voters recoup proportionally
```

## Architecture

### 1. Token Creation Change

**Current Implementation**
```typescript
// In prepare-jito-bundle/route.ts
const createIx = await pumpSdk.createV2Instruction({
  mint: tokenMintPubkey,
  creator: founderPubkey,  // ← Founder owns token
  user: founderPubkey,
  // ...
});
```

**Proposed Implementation**
```typescript
const createIx = await pumpSdk.createV2Instruction({
  mint: tokenMintPubkey,
  creator: marketPubkey,   // ← Market PDA owns token
  user: founderPubkey,     // ← Founder still pays for creation
  // ...
});
```

**Impact**: Trading fees go to Market PDA's creator vault instead of founder's

### 2. Market State Extensions

**Add to Market account**
```rust
pub struct Market {
    // ... existing fields

    // Token governance fields
    pub launched_token_mint: Option<Pubkey>,      // The token that was launched
    pub trading_fees_locked: bool,                // Are fees still locked?
    pub fee_governance_start: i64,                // When governance voting starts
    pub fee_release_votes: u64,                   // Token votes to release fees
    pub fee_scam_votes: u64,                      // Token votes to flag as scam
    pub fee_governance_resolved: bool,            // Has voting concluded?
    pub founder_fee_claimed: bool,                // Has founder claimed fees?
    pub total_recouped: u64,                      // Total lamports recouped by voters
}
```

### 3. New Program Instructions

#### a) `initialize_fee_governance`

**Called**: Automatically after token launch
**Purpose**: Set up governance parameters

```rust
pub fn initialize_fee_governance(ctx: Context<InitializeFeeGovernance>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    // Governance starts 30 days after token launch
    market.fee_governance_start = Clock::get()?.unix_timestamp + (30 * 24 * 60 * 60);
    market.trading_fees_locked = true;
    market.fee_release_votes = 0;
    market.fee_scam_votes = 0;

    Ok(())
}
```

#### b) `vote_on_fee_release`

**Called**: By token holders during governance period
**Purpose**: Vote to approve fee release (legit) or flag as scam

```rust
pub fn vote_on_fee_release(
    ctx: Context<VoteOnFeeRelease>,
    vote_type: FeeGovernanceVote, // ReleaseToFounder or FlagAsScam
) -> Result<()> {
    let market = &ctx.accounts.market;
    let voter_token_account = &ctx.accounts.voter_token_account;

    // Must be past governance start time
    require!(
        Clock::get()?.unix_timestamp >= market.fee_governance_start,
        ErrorCode::GovernancePeriodNotStarted
    );

    // Get voter's token balance (voting power)
    let voting_power = voter_token_account.amount;

    // Record vote weighted by token holdings
    match vote_type {
        FeeGovernanceVote::ReleaseToFounder => {
            market.fee_release_votes += voting_power;
        }
        FeeGovernanceVote::FlagAsScam => {
            market.fee_scam_votes += voting_power;
        }
    }

    Ok(())
}
```

**Voting Power**: Based on project's launched token holdings
**Rationale**: Token holders have skin in the game, incentivized to vote correctly

#### c) `claim_trading_fees`

**Called**: By founder if governance approves
**Purpose**: Transfer fees from creator vault to founder

```rust
pub fn claim_trading_fees(ctx: Context<ClaimTradingFees>) -> Result<()> {
    let market = &ctx.accounts.market;

    // Check governance has resolved in founder's favor
    require!(
        market.fee_release_votes > market.fee_scam_votes,
        ErrorCode::GovernanceNotApproved
    );

    require!(
        !market.founder_fee_claimed,
        ErrorCode::FeesAlreadyClaimed
    );

    // CPI to Pump.fun to withdraw from creator vault
    // Creator vault owned by Market PDA, so we can sign for it
    withdraw_creator_fees(
        ctx.accounts.pump_program,
        ctx.accounts.creator_vault,
        ctx.accounts.market, // PDA signer
        ctx.accounts.founder, // Recipient
    )?;

    market.founder_fee_claimed = true;
    market.trading_fees_locked = false;

    Ok(())
}
```

#### d) `recoup_scam_fees`

**Called**: By YES voters if project flagged as scam
**Purpose**: Distribute fees proportionally to YES voters

```rust
pub fn recoup_scam_fees(ctx: Context<RecoupScamFees>) -> Result<()> {
    let market = &ctx.accounts.market;
    let voter = &ctx.accounts.voter;
    let voter_record = &mut ctx.accounts.voter_record;

    // Check governance resolved as scam
    require!(
        market.fee_scam_votes > market.fee_release_votes,
        ErrorCode::NotFlaggedAsScam
    );

    // Check voter hasn't claimed yet
    require!(
        !voter_record.has_recouped_fees,
        ErrorCode::FeesAlreadyClaimed
    );

    // Calculate proportional share
    // Only YES voters can recoup (they were the victims)
    let voter_shares = voter_record.yes_shares;
    let total_yes_shares = market.total_yes_shares;

    require!(voter_shares > 0, ErrorCode::NotYesVoter);

    // Get total fees in creator vault
    let creator_vault_balance = get_creator_vault_balance(
        ctx.accounts.creator_vault
    )?;

    // Calculate voter's share
    let voter_share = (creator_vault_balance as u128)
        .checked_mul(voter_shares as u128)
        .unwrap()
        .checked_div(total_yes_shares as u128)
        .unwrap() as u64;

    // CPI to withdraw voter's share
    withdraw_creator_fees_partial(
        ctx.accounts.pump_program,
        ctx.accounts.creator_vault,
        ctx.accounts.market, // PDA signer
        voter.key(), // Recipient
        voter_share,
    )?;

    voter_record.has_recouped_fees = true;
    market.total_recouped += voter_share;

    Ok(())
}
```

### 4. Voter Record Extensions

**Add to VoterRecord account**
```rust
pub struct VoterRecord {
    // ... existing fields

    // Fee recoup tracking
    pub has_recouped_fees: bool,      // Has this voter claimed scam recoup?
    pub recouped_amount: u64,         // Amount recouped (if scam)
}
```

## Governance Mechanics

### Timeline

```
Day 0: Token Launch
    ↓
Day 1-30: Grace Period
    - Founder builds project
    - Token trades, fees accumulate
    - No governance voting yet
    ↓
Day 30: Governance Opens
    - Token holders can vote
    - Vote with launched token balance
    - Voting power = token holdings
    ↓
Day 30-60: Voting Period (30 days)
    - Vote: "Release to Founder" OR "Flag as Scam"
    - Weighted by token holdings
    ↓
Day 60: Governance Resolves
    - If Release > Scam: Founder can claim
    - If Scam > Release: Voters can recoup
```

### Voting Power

**WHO can vote**: Holders of the project's launched token
**WHY**: Token holders have strongest incentive to vote correctly
- If project is good: Token value ↑, want founder to succeed
- If project is scam: Token value ↓, want to recoup losses

**Vote weight**: Proportional to token holdings
```
Your voting power = Your token balance
Example:
- Alice holds 1000 tokens → 1000 votes
- Bob holds 500 tokens → 500 votes
- Total supply: 10,000 tokens
- Alice has 10% voting power
```

### Evidence-Based Governance Criteria

**CRITICAL DESIGN PRINCIPLE**: Governance votes must be based on **objective deliverables**, not token price performance.

#### The Problem: Price ≠ Scam

```
Bad Scenario (unfair to founders):
├── Token launches at $0.10
├── Founder works hard, ships product
├── Bear market hits, token drops to $0.01 (90% down)
├── Token holders vote "scam" just because price dropped
└── Founder loses fees despite delivering on promises
```

This would be **completely unfair** and discourage legitimate founders from using the platform.

#### The Solution: Objective Evaluation Criteria

Governance votes should evaluate **what founder delivered**, not what the market did.

**Objective Metrics for "Release to Founder" Vote**:
```
✅ Did founder ship the product? (check website/app live)
✅ Did they deliver promised features? (roadmap vs reality)
✅ Did they maintain communication? (Discord/Twitter active)
✅ Is there GitHub activity? (code commits, development)
✅ Did team hold tokens? (or dump immediately?)
✅ Were marketing claims accurate? (vs delivered reality)
```

**Objective Metrics for "Flag as Scam" Vote**:
```
❌ Founder disappeared (no communication for 30+ days)
❌ No product shipped (empty GitHub, dead website)
❌ False advertising (promised X, delivered nothing)
❌ Team rugpulled (dumped all tokens immediately)
❌ Abandoned project (no updates, no progress)
```

**NOT Valid Criteria**:
```
🚫 "Token price is down" - NOT evidence of scam
🚫 "I lost money" - Market risk, not scam indicator
🚫 "Token didn't moon" - Unrealistic expectations
🚫 "Bear market" - External market conditions
```

#### Evidence Requirements

When voting "Flag as Scam", voters must provide **on-chain evidence**:

```rust
pub enum ScamReason {
    FounderDisappeared,      // No communication for 30+ days
    NoProductShipped,        // Nothing built (empty GitHub)
    FalseAdvertising,        // Promised features never delivered
    TeamRugpulled,          // Team dumped all tokens
    AbandonedProject,       // No development for 60+ days
}

pub struct ScamEvidence {
    pub evidence_url: String,        // Link to proof (archive.org, GitHub, etc.)
    pub reason: ScamReason,          // Specific scam type
    pub description: String,         // Detailed explanation
    pub submitted_by: Pubkey,        // Who submitted evidence
    pub timestamp: i64,              // When submitted
}

pub fn vote_on_fee_release(
    ctx: Context<VoteOnFeeRelease>,
    vote_type: FeeGovernanceVote,
    evidence: Option<ScamEvidence>,  // Required if voting "Scam"
) -> Result<()> {
    // If voting to flag as scam, must provide evidence
    if vote_type == FeeGovernanceVote::FlagAsScam {
        require!(
            evidence.is_some(),
            ErrorCode::ScamEvidenceRequired
        );
    }

    // ... rest of voting logic
}
```

#### Voting Thresholds

**Different thresholds for different outcomes** (prevents abuse):

```
Vote to Release Fees (Founder wins):
├── Threshold: Simple majority (>50% of token votes)
├── Evidence: Not required (default assumption: founder is legit)
├── Burden of proof: On scam accusers, not founder
└── Outcome: Founder claims all trading fees

Vote to Flag as Scam (Voters recoup):
├── Threshold: Supermajority (>66% of token votes)
├── Evidence: REQUIRED (must provide proof)
├── Burden of proof: On accusers (innocent until proven guilty)
└── Outcome: Fees distributed to YES voters proportionally
```

**Rationale**: Higher bar for "scam" prevents false accusations against honest founders who faced market headwinds.

#### Appeal Mechanism

Founders can defend themselves if flagged:

```
Appeal Process:
├── Scam vote reaches >66% threshold
├── Founder has 7-day appeal window
├── Founder submits counter-evidence:
│   ├── Product delivery proof (screenshots, links, GitHub)
│   ├── Development activity logs
│   ├── Communication records
│   └── Explanation of circumstances
├── Community reviews appeal
├── Re-vote with founder's defense considered
└── Final decision binding
```

#### Milestone-Based Alternative (Future Enhancement)

Instead of binary "Release 100%" or "Scam 0%", use **tiered fee releases**:

```
Example: DeFi Trading Bot Project

Milestone 1 (30 days): Ship MVP bot
├── Evidence: Live bot on website
├── Vote: Did founder deliver?
├── If YES: Release 25% of fees
└── If NO: Hold remaining fees

Milestone 2 (60 days): Reach 100 active users
├── Evidence: On-chain user count
├── Vote: Did founder achieve this?
├── If YES: Release 25% of fees
└── If NO: Hold remaining fees

Milestone 3 (90 days): $10k in trading volume
├── Evidence: On-chain volume data
├── Vote: Did bot generate volume?
├── If YES: Release 25% of fees
└── If NO: Hold remaining fees

Milestone 4 (120 days): Product-market fit
├── Evidence: User retention, growth metrics
├── Vote: Is product successful?
├── If YES: Release final 25% of fees
└── If NO: Remaining fees → YES voters
```

**Benefits**:
- Founders rewarded for incremental progress
- Voters see delivery before releasing all fees
- Fair to honest founders who face market challenges
- Gradual trust-building process

### Outcome Scenarios (Evidence-Based)

#### Scenario A: Legitimate Project (Token Up) ✅

```
Token launched → Founder delivers on promises
    ↓
Product shipped: Working app, active GitHub, community engaged
    ↓
Token trades well on Pump.fun (price up 200%)
    ↓
Governance vote:
    - Evidence: Product live, features delivered, founder active
    - Vote: 85% "Release to Founder" (clear success)
    ↓
Founder calls claim_trading_fees()
    ↓
Gets all accumulated trading fees
    ↓
Win-win: Voters profit from token appreciation, founder rewarded for delivery
```

#### Scenario B: Honest Failure (Token Down, Product Delivered) ✅

```
Token launched → Founder works hard, ships product
    ↓
Product shipped: Working MVP, 50+ GitHub commits, Discord active
    ↓
Bear market hits: Token crashes 90% (external market conditions)
    ↓
Governance vote:
    - Evidence: Product exists, founder communicated, roadmap followed
    - Vote: 70% "Release to Founder" (delivered despite bad market)
    ↓
Founder calls claim_trading_fees()
    ↓
Gets all fees (earned them through delivery)
    ↓
Fair outcome: Founder tried hard, market was against them
    - Token holders lost on token, but founder delivered product
    - System protects honest founders from market volatility
```

#### Scenario C: Actual Scam (No Delivery) 🚫

```
Token launched → Founder disappears / rugpulls
    ↓
No product: Empty GitHub, dead website, no communication for 45+ days
    ↓
Team dumped all tokens immediately after launch
    ↓
Governance vote:
    - Evidence submitted:
      • Archive.org snapshot showing empty GitHub
      • Blockchain data showing team wallet sold 100% of tokens
      • Discord/Twitter inactive for 45 days (screenshot proof)
    - ScamReason: FounderDisappeared + TeamRugpulled
    - Vote: 82% "Flag as Scam" (exceeds 66% threshold)
    ↓
Each YES voter calls recoup_scam_fees()
    ↓
Gets proportional share of trading fees
    ↓
Partial recovery: Helps offset betting losses
```

## Economic Analysis

### Example: $10k Market

**Market Setup**
- Total pool: $10k (100 SOL at $100/SOL)
- YES voters: 60 SOL
- NO voters: 40 SOL
- Market fee (5%): 5 SOL → Treasury
- Remaining: 95 SOL

**Token Launch (YES wins)**
- Market buys 30 SOL of tokens (from 95 SOL pool)
- Market receives tokens, holds for distribution
- 65 SOL remains for YES voter claims

**Trading Activity**
- Token trades on Pump.fun for 30 days
- Total trading volume: 500 SOL
- Pump.fun fee (1%): 5 SOL
- Creator vault accumulates: 5 SOL

### Outcome A: Legit Project
```
YES voters claim shares:
- Get tokens worth $X (market dependent)
- Token may have appreciated if project good
- Total return: Token value + potential upside

Founder claims fees:
- Gets 5 SOL from creator vault
- Plus potential token holdings
- Plus project success rewards
```

### Outcome B: Scam Project
```
YES voters recoup:
- Vote flags as scam
- Each YES voter gets proportional share of 5 SOL
- Example: Voter with 10% of YES shares
  - Gets: 5 SOL * 10% = 0.5 SOL
  - Helps offset their 6 SOL betting loss

Founder gets:
- Nothing (fees locked in creator vault)
- Reputation damage
- Potential legal issues
```

## Benefits

### 1. Voter Protection
- **Scam Insurance**: Can recoup some losses if project fails
- **Reduces Risk**: Less catastrophic if make wrong bet
- **Fair Distribution**: Proportional to stake (YES shares)

### 2. Founder Accountability
- **Skin in Game**: Must deliver to unlock fees
- **Delayed Gratification**: 30-day lock encourages building
- **Reputation System**: Scam flag follows founder

### 3. Market Quality
- **Better Projects**: Only serious founders will participate
- **Less Scams**: Economic disincentive to rugpull
- **Community Trust**: Voters more willing to participate

### 4. Aligned Incentives
- **Founders**: Motivated to build, increase token value
- **Voters**: Protected from scams, share upside
- **Platform**: Higher quality markets attract more users

## Implementation Roadmap

### Phase 1: Program Changes (2-3 weeks)
- [ ] Add Market state fields for governance
- [ ] Implement `initialize_fee_governance` instruction
- [ ] Implement `vote_on_fee_release` instruction
- [ ] Implement `claim_trading_fees` instruction
- [ ] Implement `recoup_scam_fees` instruction
- [ ] Add VoterRecord fee tracking fields
- [ ] Comprehensive testing on devnet

### Phase 2: Frontend (1-2 weeks)
- [ ] Governance voting UI (token holders)
- [ ] Fee claim UI (founders)
- [ ] Recoup UI (scam victims)
- [ ] Governance status dashboard
- [ ] Vote history/transparency

### Phase 3: Integration (1 week)
- [ ] Modify token creation to use Market PDA as creator
- [ ] Update prepare-jito-bundle endpoint
- [ ] Update useResolution hook
- [ ] End-to-end testing

### Phase 4: Deployment (1 week)
- [ ] Audit program changes
- [ ] Deploy updated program to mainnet
- [ ] Update frontend to mainnet
- [ ] Monitor initial governance votes
- [ ] Document user flows

**Total Estimated Time**: 5-7 weeks

## Technical Considerations

### 1. Pump.fun Creator Vault Access

**Challenge**: Can Market PDA withdraw from Pump.fun creator vault?

**Solution**:
- Market PDA is the "creator" in createV2
- Pump.fun creator vault is PDA: `["creator-vault", creator]`
- Since Market PDA is creator, our program can sign for withdrawals
- Use CPI to call Pump.fun's withdraw function

**Verification Needed**:
- Check Pump.fun IDL for withdraw instruction
- Verify we can do CPI as creator vault owner
- Test on devnet first

### 2. Token-Based Voting

**Implementation**: Use SPL Token account balance as voting power

```rust
// Get voter's token balance
let voter_token_account = &ctx.accounts.voter_token_account;
let voting_power = voter_token_account.amount;

// Validate it's the correct token
require!(
    voter_token_account.mint == market.launched_token_mint,
    ErrorCode::WrongToken
);
```

**Considerations**:
- Snapshot mechanism? (prevent vote buying)
- Delegation? (allow proxy voting)
- Quorum requirements? (minimum participation)

### 3. Sybil Resistance

**Problem**: Founder could buy tokens to vote for themselves

**Mitigations**:
1. **Time Lock**: Tokens acquired after governance starts don't count
2. **Initial Distribution**: Market PDA holds majority of tokens for YES voters
3. **Quadratic Voting**: sqrt(token_balance) voting power (optional)
4. **Minimum Threshold**: Need >50% of total supply to resolve either way

**Recommended**: Start with simple time lock, iterate based on feedback

### 4. Gas Costs

**Concern**: Many voters claiming recoup = many transactions

**Optimization**:
- Batch claims? (claim for multiple voters at once)
- Merkle tree proofs? (like Solana airdrops)
- Off-chain computation, on-chain verification

**Initial**: Simple direct claims, optimize if becomes bottleneck

## Security Considerations

### 1. Fee Vault Ownership
- **Risk**: Pump.fun changes creator vault logic
- **Mitigation**: Test thoroughly, monitor Pump.fun updates
- **Fallback**: Emergency withdrawal mechanism for Market PDA

### 2. Governance Manipulation
- **Risk**: Whale controls majority of tokens
- **Mitigation**: Quadratic voting or time-weighted holdings
- **Monitoring**: Flag suspicious voting patterns

### 3. Reentrancy Protection
- **Risk**: Recursive calls to `recoup_scam_fees`
- **Mitigation**: Check-effects-interactions pattern
- **Validation**: Mark `has_recouped_fees` before transfer

### 4. Integer Overflow
- **Risk**: Large token supplies cause overflow
- **Mitigation**: Use checked math, u128 for calculations
- **Testing**: Fuzz testing with extreme values

## Open Questions

### 1. Governance Parameters
- Grace period duration? (30 days proposed)
- Voting period duration? (30 days proposed)
- Quorum requirement? (Minimum participation to resolve)
- Supermajority threshold? (Simple >50% or require 66%?)

### 2. Token Distribution
- Should Market PDA distribute tokens to YES voters immediately?
- Or hold in escrow until governance resolves?
- Linear vesting for founders? (prevent immediate dump)

### 3. Fee Claiming Timeline
- Can founder claim incrementally? (monthly releases)
- Or only lump sum after governance?
- Cliff vesting? (unlock 25% each quarter)

### 4. Multi-Market Scenarios
- What if same founder launches multiple tokens?
- Aggregate reputation tracking?
- Cross-market governance participation?

## Future Enhancements

### 1. Reputation System
- Track founder's historical governance outcomes
- "Trust Score": % of projects that passed governance
- Display on market creation UI

### 2. Token Distribution Options
- Allow YES voters to claim tokens proportionally
- Or market-based distribution (auction/bonding curve)
- Vesting schedules for large holders

### 3. Graduated Governance
- Smaller markets: Simple majority vote
- Larger markets: Require quorum + supermajority
- Very large markets: Tiered voting (founders, early investors, community)

### 4. Appeal Mechanism
- If flagged as scam, founder can appeal
- Requires providing evidence of progress
- Re-vote after appeal period

## Success Metrics

### Key Performance Indicators (KPIs)

1. **Scam Rate Reduction**
   - Baseline: Current % of failed token launches
   - Target: Reduce by 50% within 6 months

2. **Voter Confidence**
   - Survey: "How protected do you feel?"
   - Target: >80% feel more confident

3. **Fee Recovery Rate**
   - For scam-flagged projects: % of fees recouped
   - Target: Average 70% recovery for YES voters

4. **Governance Participation**
   - % of token holders who vote
   - Target: >30% participation rate

5. **Founder Quality**
   - % of founders who complete 30-day grace period
   - Target: >60% deliver on milestones

## Conclusion

This governance system transforms PLP from a simple prediction market into an **accountability layer for token launches**. By aligning incentives and providing voter protection, we:

1. **Reduce scams** (founders can't rugpull fees)
2. **Protect voters** (can recoup losses if scammed)
3. **Improve quality** (only serious founders participate)
4. **Build trust** (transparent, on-chain governance)

**Next Steps**:
1. Community feedback on governance parameters
2. Pump.fun creator vault CPI verification (devnet)
3. Detailed program architecture design
4. Testnet implementation and iteration

---

**Document Version**: 1.0
**Last Updated**: 2025-12-06
**Author**: Claude + PLP Team
**Status**: Design Phase - Pending Implementation
