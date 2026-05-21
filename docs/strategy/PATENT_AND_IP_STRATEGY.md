# PNL — Patent & IP Strategy

## Overview

PNL's core mechanism — using collective financial staking (prediction markets) to gate automated token launches — is novel and unpatented as of March 2026. No major player (Polymarket, Augur, Kalshi, pump.fun) holds patents on similar mechanisms. This document outlines the full IP protection strategy.
bals
---

## 1. Entity Structure

### Two-LLC Model (IP separated from operations)

```
Bishwanath Bastola (Inventor)
        │
        ├── PNL IP Holdings LLC (Wyoming or Delaware)
        │         │
        │         ├── Owns patent(s)
        │         ├── Owns trademarks (PNL, Predict & Launch)
        │         ├── Grants exclusive license to PNL Labs
        │         └── Future: can license to other verticals
        │
        └── PNL Labs LLC (Operating Company)
                  │
                  ├── Runs pnl.market
                  ├── Has users, revenue, employees
                  ├── Receives investor capital
                  └── Holds exclusive license from IP Holdings
```

### Why separate:
- **Liability shield** — if PNL Labs gets sued, the patent is untouchable in a separate entity
- **Tax efficiency** — licensing fees between entities can be structured favorably
- **Clean fundraising** — investors buy into PNL Labs; you retain 100% of IP Holdings
- **Acquisition flexibility** — buyer can acquire platform, IP, or both separately
- **Personal protection** — patent in an LLC, not your personal name, protects against personal legal risk

### Formation costs:
| Item | Cost |
|---|---|
| Wyoming LLC (IP Holdings) filing | ~$100 + $50/yr |
| Operating Agreement (attorney or DIY) | $500 - $1,000 |
| Patent license agreement (IP Holdings → PNL Labs) | $500 - $1,000 |
| **Total** | **~$1,000 - $2,000** |

### Key rules:
- Patent assignee = **PNL IP Holdings LLC**
- Inventor = **Bishwanath Bastola** (always you, legally)
- License to PNL Labs must be **exclusive, perpetual** (can set royalty-free or low fixed royalty)
- NEVER file patent under personal name
- Keep both LLCs in good standing (annual filings)

---

## 2. Provisional Patent

### What it does:
- Locks your **priority date** (first-to-file wins in the US since 2013)
- Grants **"patent pending"** status immediately
- Gives you **12 months** to file the full utility patent
- If you don't file utility within 12 months, provisional expires and priority date is lost

### What to include in the provisional (be BROAD):
The provisional is a technical disclosure, not formal claims. Describe EVERYTHING:

1. **Current mechanism (prediction market)**
   - Binary YES/NO voting with staked SOL
   - Time-bound market with deadline
   - Smart contract auto-resolution
   - Automated token deployment via bonding curve (pump.fun)
   - Proportional distribution to winning voters
   - Critic reward mechanism (NO voters split pool on negative resolution)

2. **Conviction market variation**
   - Stake influence grows with duration
   - No fixed deadline — threshold-based launch trigger
   - Accumulated conviction score per participant
   - Conviction decay on withdrawal

3. **Multi-choice variation**
   - Multiple outcome options beyond binary YES/NO
   - Ranked or weighted staking across options
   - Resolution based on plurality or threshold

4. **Quadratic funding variation**
   - Many small contributions weighted more than few large ones
   - Matching pool mechanics

5. **Hybrid models**
   - Prediction market for launch decision + conviction layer post-launch
   - Reputation-weighted staking (track record amplifies vote power)

6. **Protocol licensing model**
   - Token staking as license mechanism
   - Third parties stake PNL tokens to use patented mechanism
   - Programmatic license enforcement via smart contract

### Technical documentation to include:
- System architecture diagrams
- Smart contract state machine (create → vote → resolve → launch/distribute)
- On-chain transaction flow
- Solana program structure (Rust/Anchor)
- Screenshots of live platform
- Mainnet program ID: `C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86`

### Cost: ~$3,000
- DIY technical description (you write it) + attorney review and filing: $1,500 - $2,500
- Or full attorney drafting: $3,000 - $5,000

### Timeline: File ASAP (target: within 2 weeks)

---

## 3. Utility Patent (Full Patent)

### Deadline: Within 12 months of provisional filing

### Claim strategy — broad to narrow:

```
Claim 1 (broadest):
  "A blockchain-based system that uses collective financial staking
   to determine whether a new digital asset should be created and deployed"

  ├── Claim 2: ...wherein staking is binary (YES/NO)
  │     ├── Claim 5: ...with time-bound resolution
  │     └── Claim 6: ...with threshold-based resolution
  │
  ├── Claim 3: ...wherein staking influence increases with duration
  │     └── Claim 7: ...conviction-based accumulation model
  │
  ├── Claim 4: ...wherein staking supports multiple outcomes
  │     └── Claim 8: ...ranked choice staking
  │
  ├── Claim 9: ...wherein negative outcome redistributes pooled stakes to opposing participants
  ├── Claim 10: ...wherein digital asset deployment uses a bonding curve protocol
  ├── Claim 11: ...on a Solana blockchain network
  └── Claim 12: ...wherein third-party platforms stake tokens to license the mechanism
```

### Key phrases to include in claims:
- "collective financial staking" (covers all mechanisms)
- "signal accumulation" (covers conviction)
- "binary and multi-outcome" (covers multiple choice)
- "time-bound and threshold-based resolution" (covers both models)
- "automated digital asset deployment" (covers any token type)
- "proportional distribution" (covers reward mechanics)
- "programmatic license enforcement" (covers protocol licensing)

### What makes PNL's claims survive Alice (2014 ruling):
- NOT abstract — specific smart contract with defined state transitions
- Concrete technical implementation deployed on mainnet
- Produces tangible result (actual token deployed on bonding curve)
- Can point to deployed program ID as proof of implementation

### Cost: $15,000 - $25,000
| Component | Cost |
|---|---|
| Attorney drafting & filing | $10,000 - $20,000 |
| USPTO filing fee (small entity) | ~$800 |
| Office action responses (2-3 rounds) | $1,000 - $3,000 each |
| Issue fee | ~$1,000 |
| **Total through grant** | **$15,000 - $25,000** |

### Timeline: 18-30 months from filing to grant

### Maintenance fees (after grant):
| Year | Small entity |
|---|---|
| 3.5 | $1,600 |
| 7.5 | $3,600 |
| 11.5 | $7,400 |

---

## 4. What the Patent Covers (and doesn't)

### Covered (if broad claims approved):

| Mechanism | Covered? |
|---|---|
| Prediction market (binary YES/NO) → token launch | Yes |
| Prediction market with multiple choices → token launch | Yes |
| Conviction market → token launch | Yes |
| Quadratic funding → token launch | Yes |
| Bonding curve voting → token launch | Yes |
| Curation market → token launch | Yes |
| Any staking-based collective decision → token launch | Yes |

### NOT covered:
- Prediction markets that don't result in token launch (Polymarket-style pure betting)
- Token launches without collective staking mechanism (pump.fun as-is)
- Mechanisms outside US jurisdiction (US patents only apply in the US)

---

## 5. Future: Protocol Licensing via Token

### The vision (v2 play, post-patent-grant):

PNL becomes a **protocol**, not just a platform. The patent covers the mechanism. Anyone can build their own PNL-like platform for any vertical, but they MUST:

1. Stake X million PNL tokens (license key)
2. Pay Y% of platform fees back to PNL treasury
3. While staked = licensed. Unstake = license revoked. Violate terms = stake slashed.

### Potential verticals:
- **Music** — crowd decides which artists get a record deal
- **Film** — crowd funds which scripts get produced
- **Research** — crowd decides which studies get grants
- **Real estate** — crowd decides which developments get funded
- **Gaming** — crowd decides which indie games launch

### Cost to set up token licensing:
| Item | Cost |
|---|---|
| IP attorney for token-license legal structure | $5,000 - $10,000 |
| Token + licensing smart contract | Built in-house |
| **Total** | **~$5,000 - $10,000** |

### When to pursue: After patent is granted and platform has traction. Not before.

---

## 6. Attorney Requirements

Look for a patent attorney who specializes in:
- Software patents (specifically post-Alice claim drafting)
- Blockchain / DeFi / fintech patents
- Ideally has filed Solana or smart contract-related patents
- Do NOT use a general patent attorney

---

## 7. Action Plan & Total Budget

| Step | Action | Cost | When |
|---|---|---|---|
| 1 | Form PNL IP Holdings LLC (Wyoming) | ~$100 | This week |
| 2 | Write technical description (DIY) | $0 | Week 1-2 |
| 3 | Attorney review + file provisional patent | ~$3,000 | Week 2-3 |
| 4 | Draft license agreement (IP Holdings → PNL Labs) | ~$1,000 | Before raising |
| 5 | File utility patent | ~$15-20K | Month 8-12 |
| 6 | Office action responses | ~$3-6K | Month 12-30 |
| 7 | Patent granted | ~$1K | Month 24-36 |
| 8 | Explore token licensing model | ~$5-10K | Post-grant |
| **Total** | | **~$25-35K** | |

### Priority: Steps 1-4 are critical and cost under $5K. Do them NOW.

---

## 8. Key Risks

| Risk | Mitigation |
|---|---|
| Broad claims rejected by USPTO (Alice) | File narrow claims as fallback; describe concrete implementation |
| Competitor files first | File provisional ASAP to lock priority date |
| Enforcement cost ($100K+ to litigate) | Patent acts as deterrent; licensing is cheaper than litigation for both parties |
| Crypto community anti-patent backlash | Frame as defensive IP, not offensive patent trolling |
| Patent becomes irrelevant if mechanism evolves | Include all variations in provisional (conviction, multi-choice, quadratic, etc.) |
| Provisional expires without utility filing | Calendar reminder at month 9; budget utility filing in fundraise |

---

## 9. Prior Art Status (as of March 2026)

- **Polymarket**: No patents. Only trademarks. Open infrastructure.
- **Augur**: No patents. Fully open source (GPL/MIT).
- **Kalshi**: No patents. Moat is regulatory (CFTC-regulated).
- **Pump.fun**: No patents on launch mechanism.
- **PumpMarket**: Prediction markets ON pump.fun tokens, not gating launches. No patents.
- **No existing patent found** combining prediction markets + automated token creation/launch.

**The window is open. File now.**