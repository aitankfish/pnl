
# Mainnet Testing Checklist

## Overview
This document outlines the testing strategy for validating the PLP platform's token launch integration with Pump.fun before production deployment.

---

## Pre-Testing Setup

### Environment Configuration
- [ ] Switch `.env` to mainnet: `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
- [ ] Verify Helius mainnet RPC is configured
- [ ] Confirm you have ~0.2-0.5 SOL for testing (including fees)
- [ ] Have 2-3 test wallets ready for multi-user testing

### Safety Checks
- [ ] Backup current database
- [ ] Deploy to staging environment first (not production)
- [ ] Test with **small amounts only** (0.1 SOL target pool)

---

## Phase 1: Small-Scale Test (0.1 SOL Target Pool)

**Cost: ~$30-50 total**

### 1.1 Market Creation
- [ ] Create test market with:
  - Target pool: 0.1 SOL (instead of 5 SOL)
  - Use test project name (e.g., "Test Token ABC")
  - Set expiry to 1-2 hours for quick testing
- [ ] Verify market appears in browse page
- [ ] Check market details page loads correctly

### 1.2 Voting Phase
- [ ] Vote YES from 2-3 different wallets
  - [ ] Wallet 1: 0.05 SOL
  - [ ] Wallet 2: 0.03 SOL
  - [ ] Wallet 3: 0.03 SOL
- [ ] Verify votes are recorded on-chain
- [ ] Check voting stats update in UI
- [ ] Monitor pool progress reaches 100%

### 1.3 Market Resolution & Token Launch
- [ ] Wait for expiry OR fill pool to 100%
- [ ] Click "Launch Token Now" button
- [ ] **Monitor console logs carefully:**
  - [ ] "MAINNET MODE" message appears
  - [ ] Token mint address generated
  - [ ] PumpPortal API request succeeds
  - [ ] Token creation transaction sent
  - [ ] Resolution transaction sent
  - [ ] Both transactions confirmed

### 1.4 Pump.fun Verification
- [ ] Visit Pump.fun page: `https://pump.fun/[TOKEN_MINT]`
  - [ ] Token exists and is visible
  - [ ] Token name/symbol correct
  - [ ] Bonding curve chart shows
  - [ ] Can view token details
- [ ] Check Solscan: `https://solscan.io/token/[TOKEN_MINT]`
  - [ ] Token mint account exists
  - [ ] Supply matches expected amount
  - [ ] Transactions visible

### 1.5 Token Distribution
- [ ] YES voters can claim tokens:
  - [ ] Wallet 1 claims successfully
  - [ ] Wallet 2 claims successfully
  - [ ] Wallet 3 claims successfully
- [ ] Check token balances in wallets
- [ ] Verify claim amounts match shares (proportional to stake)

### 1.6 Team Vesting
- [ ] Founder can initialize team vesting
- [ ] Founder can claim immediate 5% allocation
- [ ] Vested 15% is locked correctly
- [ ] Check vesting schedule is accurate

### 1.7 Platform Tokens
- [ ] Platform 1% allocation can be claimed
- [ ] Tokens sent to correct platform wallet
- [ ] Amount is 1% of total supply

### 1.8 Trading Verification
- [ ] Try buying tokens on Pump.fun
  - [ ] Price increases with buy
  - [ ] Transaction succeeds
  - [ ] Tokens received in wallet
- [ ] Try selling tokens on Pump.fun
  - [ ] Price decreases with sell
  - [ ] SOL received in wallet
  - [ ] Transaction succeeds

---

## Phase 2: Medium-Scale Test (1 SOL Target Pool)

**Cost: ~$150-200 total**

Repeat all steps from Phase 1 with:
- [ ] Larger pool (1 SOL)
- [ ] More participants (5-10 wallets)
- [ ] Test both YES and NO scenarios
- [ ] Monitor Raydium migration threshold

---

## Phase 3: Raydium Migration Test

**Goal: Verify automatic migration to Raydium**

- [ ] Continue buying tokens on Pump.fun
- [ ] Monitor when market cap approaches threshold (~$69k)
- [ ] Verify automatic Raydium pool creation
- [ ] Check liquidity is transferred
- [ ] Confirm trading works on Raydium

---

## Expected Console Output

### Devnet Mode
```
═══════════════════════════════════════════════════
🚀 TOKEN LAUNCH FLOW STARTED
═══════════════════════════════════════════════════
Network: DEVNET
...

⚠️  DEVNET MODE DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pump.fun is NOT available on devnet.
Creating simple SPL token for testing purposes.
```

### Mainnet Mode
```
═══════════════════════════════════════════════════
🚀 TOKEN LAUNCH FLOW STARTED
═══════════════════════════════════════════════════
Network: MAINNET-BETA
...

✅ MAINNET MODE - FULL PUMP.FUN INTEGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Token will be created on Pump.fun bonding curve
Automatic Raydium migration when threshold reached

🎫 Generated token mint: [MINT_ADDRESS]
📤 Requesting pump.fun create transaction from PumpPortal...
✅ Received create transaction from PumpPortal
...
✅ Token created on Pump.fun!
   Token is now live: https://pump.fun/[MINT_ADDRESS]

🎉 MAINNET TOKEN LAUNCH SUCCESSFUL!
```

---

## Issue Tracking

### If Token Doesn't Appear on Pump.fun
- [ ] Check transaction succeeded on Solscan
- [ ] Verify PumpPortal API response was successful
- [ ] Check token mint address matches
- [ ] Wait 1-2 minutes for indexing
- [ ] Contact Pump.fun support if persistent

### If Distribution Fails
- [ ] Check market resolution succeeded
- [ ] Verify token mint is stored in database
- [ ] Check voter positions are recorded correctly
- [ ] Review on-chain program logs

### If Raydium Migration Doesn't Trigger
- [ ] Verify market cap threshold reached
- [ ] Check bonding curve completion percentage
- [ ] Monitor Pump.fun for migration status
- [ ] May take 5-10 minutes to process

---

## Success Criteria

### ✅ Phase 1 Passes If:
1. Token created on Pump.fun successfully
2. All YES voters can claim tokens
3. Team vesting works correctly
4. Platform fee allocated
5. Token tradeable on Pump.fun
6. No console errors
7. Database updates correctly

### ✅ Ready for Production If:
1. Phase 1 passes completely
2. Phase 2 passes with larger amounts
3. Raydium migration verified (if tested)
4. No unexpected errors
5. All distribution percentages correct
6. UI behaves as expected

---

## Rollback Plan

### If Critical Issues Found:
1. Switch back to devnet mode
2. Do NOT create more markets on mainnet
3. Document all issues found
4. Fix issues in devnet first
5. Re-test on mainnet with fixes

---

## Cost Summary

| Phase | Target Pool | Estimated Cost |
|-------|-------------|----------------|
| Phase 1 | 0.1 SOL | ~$30-50 |
| Phase 2 | 1 SOL | ~$150-200 |
| Phase 3 | To threshold | ~$500-1000 |

**Recommendation:** Start with Phase 1 only. Only proceed to Phase 2/3 if Phase 1 is 100% successful.

---

## Post-Testing

### After Successful Test:
- [ ] Document any issues encountered
- [ ] Update this checklist with learnings
- [ ] Share results with team
- [ ] Set target pool limits for production (e.g., 5 SOL minimum)
- [ ] Deploy to production
- [ ] Monitor first few real markets closely

---

## Notes

- **IMPORTANT:** Never test with more than you can afford to lose
- Keep detailed logs of all transactions
- Take screenshots of successful flows
- If anything looks wrong, STOP and investigate
- When in doubt, test on devnet first

---

## Contact & Support

- Pump.fun Discord: https://discord.gg/pumpfun
- PumpPortal Docs: https://pumpportal.fun/docs
- Solana Explorer: https://solscan.io

---

**Last Updated:** 2025-01-18
**Version:** 1.0
