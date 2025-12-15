# Treasury Wallet Setup & Management Guide

## Overview

The PNL platform uses a **two-wallet security model** for treasury management:

1. **Deployer Wallet** (Cold Storage) - Initializes treasury, then locked away
2. **Operational Wallet** (Warm Storage) - Day-to-day fee collection and operations

---

## Wallet Requirements

### 1. Deployer/Initialization Wallet
**Address**: *(Any secure wallet you control)*

**Purpose**:
- Initialize treasury PDA (one-time operation)
- Transfer admin rights to operational wallet
- Emergency admin recovery

**Security**:
- ✅ Cold storage (hardware wallet or offline)
- ✅ Used only for initialization and emergency
- ✅ Never exposed online after initial setup
- ✅ **MUST initialize immediately after program deployment** (race condition protection)

**Required For**:
- Treasury initialization (first-come-first-served)
- Admin transfer (if needed in future)

**Important**: No longer hardcoded! Use ANY secure wallet you control, but initialize IMMEDIATELY after deploying the program to prevent others from initializing first.

### 2. Operational Wallet
**Address**: *(You choose - will be set during setup)*

**Purpose**:
- Withdraw accumulated platform fees (5% completion fees)
- Day-to-day treasury operations
- No token claims (tokens automatically go to platform wallet)

**Security**:
- ✅ Warm wallet (secure but accessible)
- ✅ Multi-sig recommended for production
- ✅ Can be changed if compromised

### 3. Platform Token Wallet
**Current Address**: `3MihVtsLsVuEccpmz4YG72Cr8CJWf1evRorTPdPiHeEQ`

**Purpose**:
- Receives 1% platform token allocation from each token launch
- Hardcoded in program (cannot be changed without redeployment)

**Note**: Token claiming is permissionless - anyone can trigger it, but tokens always go to this wallet

---

## Setup Process

### Step 1: Initialize Treasury (Initialization Wallet)

**When**: **IMMEDIATELY after program deployment** (before anyone else!)

**Who**: Any secure wallet you control (preferably hardware wallet)

**How**:
1. Navigate to `/admin/treasury` on the frontend
2. Connect your secure wallet
3. Click "Initialize Treasury"
4. Sign transaction

**⚠️ CRITICAL**:
- Treasury can only be initialized ONCE (Anchor `init` enforces this)
- First person to call this becomes the admin
- Initialize IMMEDIATELY after deploying program to prevent others
- Use a secure wallet you control for the long term

**What Happens**:
- Treasury PDA created at: `seeds = [b"treasury"], bump`
- Your wallet set as initial admin
- Total fees counter initialized to 0

**Result**:
```
✅ Treasury initialized
   Initial admin: <your wallet address>
   Treasury PDA: <treasury PDA address>
   Bump: <bump seed>
Balance: 0 SOL
Total Fees: 0 SOL
```

---

### Step 2: Transfer Admin to Operational Wallet (Deployer Wallet)

**When**: Immediately after initialization

**Who**: Deployer wallet (current admin)

**How**:
1. Stay on `/admin/treasury` page
2. Enter operational wallet address in "Transfer Admin Control" section
3. Click "Set New Admin"
4. Sign transaction

**What Happens**:
- Treasury admin changed from deployer to operational wallet
- Deployer loses admin access
- Operational wallet gains fee withdrawal permissions

**Result**:
```
✅ Admin changed
Old Admin: <previous deployer wallet>
New Admin: <your operational wallet>
```

---

### Step 3: Secure Deployer Wallet (Cold Storage)

**When**: After admin transfer complete

**How**:
1. Export deployer wallet private key
2. Store in secure cold storage:
   - Hardware wallet
   - Encrypted USB drive
   - Safe deposit box
   - Multiple encrypted backups
3. Remove from hot wallet
4. Document recovery process

**Why**:
- Deployer can change admin if operational wallet compromised
- Emergency recovery capability
- Maximum security for deployment authority

---

### Step 4: Operational Wallet Daily Usage

**Who**: Operational wallet admin

**What You Can Do**:

#### Withdraw Accumulated Fees
1. Navigate to `/admin/treasury`
2. Connect operational wallet
3. View current treasury balance
4. Enter withdrawal amount and recipient
5. Click "Withdraw Fees"
6. Sign transaction

**When to Withdraw**:
- Monthly (recommended)
- When treasury balance reaches threshold (e.g., 10 SOL)
- Before major operations
- Regular accounting cycles

#### Monitor Treasury Stats
- Balance: Real-time SOL in treasury
- Total Fees: Cumulative fees collected
- Admin: Current admin wallet address

---

## Fee Collection Flow

### 5% Completion Fee (SOL)

**When Collected**:
- Market resolves with YES winning → 5% of pool to treasury
- Market resolves with NO winning → 5% of pool to treasury

**Flow**:
```
User bets → Market pool grows → Market resolves →
5% to treasury PDA → Admin withdraws periodically
```

**Example**:
```
Market Pool: 10 SOL
Resolution: YES wins
5% Fee: 0.5 SOL → Treasury
Remaining: 9.5 SOL → Token launch
```

### 1% Token Allocation

**When Collected**:
- After token launch (YES wins scenario)
- Tokens allocated during resolve_market
- Claimed via `claim_platform_tokens` instruction

**Flow**:
```
Token launched → 1% allocated to platform →
Anyone calls claim → Tokens transferred to platform wallet
```

**Important**:
- Claiming is permissionless (anyone can trigger)
- Tokens ALWAYS go to: `3MihVtsLsVuEccpmz4YG72Cr8CJWf1evRorTPdPiHeEQ`
- Can only be claimed once per token
- Frontend shows unclaimed platform tokens

---

## Admin Page Features

Access at: **`/admin/treasury`**

### Wallet Status Section
- Shows connected wallet
- Deployer status check
- Admin status check
- Current network

### Treasury Status Section
- Treasury PDA address
- Current admin wallet
- Real-time SOL balance
- Total fees collected (historical)

### Transfer Admin Control
- Input field for new admin address
- One-click admin transfer
- Warning about losing access

### Withdraw Fees
- Amount input (SOL)
- Recipient wallet input
- Available balance display
- One-click withdrawal

### Platform Token Wallet Info
- Display hardcoded platform wallet
- Explanation of permissionless claiming
- Link to view token holdings

---

## Security Best Practices

### Deployer Wallet
✅ **DO**:
- Use hardware wallet (Ledger, Trezor)
- Store backup seed phrase in multiple secure locations
- Use strong passphrase encryption
- Test recovery process
- Keep completely offline after setup

❌ **DON'T**:
- Store on internet-connected computer
- Use for daily operations
- Share private key
- Store seed phrase digitally
- Use on untrusted devices

### Operational Wallet
✅ **DO**:
- Use multi-sig wallet for production
- Regular security audits
- Monitor for suspicious activity
- Use withdrawal limits
- Document all withdrawals
- Regular backups

❌ **DON'T**:
- Use same wallet for other high-value operations
- Share private key with team members
- Store private key in code repository
- Use on compromised devices

### Platform Token Wallet
✅ **DO**:
- Monitor incoming token claims
- Track token allocations per market
- Secure private key (holds valuable tokens)
- Regular token inventory

❌ **DON'T**:
- Change address without program redeployment
- Use for other purposes
- Share access widely

---

## Emergency Procedures

### If Operational Wallet Compromised

1. **Immediate Actions**:
   - Stop all withdrawals
   - Access deployer wallet from cold storage
   - Generate new operational wallet

2. **Recovery**:
   - Use deployer wallet to call `set_admin`
   - Transfer admin to new operational wallet
   - Secure new operational wallet
   - Update documentation

3. **Investigation**:
   - Review all recent transactions
   - Identify compromise vector
   - Implement additional security measures

### If Deployer Wallet Lost

⚠️ **Critical**: Cannot recover admin access without deployer wallet

**Prevention**:
- Multiple encrypted backups of seed phrase
- Hardware wallet as primary
- Paper wallet backup in safe
- Trusted recovery agent with sealed envelope

**If Lost**:
- Cannot change admin
- Operational wallet retains access to withdrawals
- Cannot recover if operational wallet also compromised
- May require program redeployment

---

## Monitoring & Reporting

### Daily Checks
- Treasury balance
- Recent withdrawals
- Unusual activity

### Weekly Reports
- Total fees collected
- Withdrawals made
- Platform tokens claimed
- Outstanding claims

### Monthly Reconciliation
- Compare on-chain data with records
- Verify all withdrawals
- Update financial statements
- Security audit

---

## Testing Checklist

### Devnet Testing (Before Mainnet)

- [ ] Initialize treasury with deployer wallet
- [ ] Verify treasury PDA created
- [ ] Transfer admin to test operational wallet
- [ ] Verify admin change successful
- [ ] Create test market and resolve it
- [ ] Verify fees collected in treasury
- [ ] Test fee withdrawal
- [ ] Verify withdrawal successful
- [ ] Test claiming platform tokens
- [ ] Verify tokens received in platform wallet

### Mainnet Deployment

- [ ] Deployer wallet secured in cold storage
- [ ] Operational wallet created and secured
- [ ] Multi-sig configured (if using)
- [ ] Initialize treasury with deployer wallet
- [ ] Verify initialization successful
- [ ] Transfer admin to operational wallet
- [ ] Verify transfer successful
- [ ] Lock deployer wallet in cold storage
- [ ] Document all addresses
- [ ] Test withdrawal with small amount
- [ ] Monitor first fee collections
- [ ] Establish withdrawal schedule
- [ ] Set up monitoring alerts

---

## Wallet Addresses Reference

### Current Configuration

| Wallet Type | Address | Purpose | Security Level |
|------------|---------|---------|----------------|
| **Deployer** | *(Use default Solana CLI wallet or set DEPLOY_WALLET_PATH)* | Initialize treasury, emergency admin recovery | Cold Storage |
| **Operational** | *(TBD - Set during setup)* | Daily fee withdrawals | Warm Storage |
| **Platform Tokens** | `3MihVtsLsVuEccpmz4YG72Cr8CJWf1evRorTPdPiHeEQ` | Receive 1% token allocation | Warm Storage |
| **Treasury PDA** | *(Derived: seeds=[b"treasury"])* | Hold accumulated fees | Program-controlled |

> **⚠️ DEPRECATED:** The old deployer wallet `Djw83UQZaEmrmd3YCW9kCHv6ZJUY9V2LGNrcSuUXwB7c` was compromised (private key exposed in git history). Do NOT use this wallet for any purpose.

---

## FAQ

**Q: Can I use the same wallet for deployer and operational?**
A: Technically yes, but **not recommended**. Separating them provides better security - deployer stays offline.

**Q: What happens if I lose the deployer wallet?**
A: You cannot change the admin anymore, but operational wallet still works for withdrawals. Keep deployer wallet backed up!

**Q: Can I change the platform token wallet?**
A: Not without redeploying the program. It's hardcoded in `constants.rs`.

**Q: How often should I withdraw fees?**
A: Monthly is recommended, or when balance exceeds a threshold (e.g., 10 SOL).

**Q: Who can claim platform tokens?**
A: Anyone can trigger the claim, but tokens always go to the hardcoded platform wallet. It's permissionless.

**Q: What if operational wallet is compromised?**
A: Use deployer wallet to set a new admin. This is why you keep deployer in cold storage.

**Q: Can I have multiple admins?**
A: No, treasury supports only one admin at a time. Use multi-sig for the operational wallet if you need multiple signers.

---

## Appendix: Transaction Types

### Initialize Treasury
```
Instruction: init_treasury
Accounts:
  - treasury (writable, PDA)
  - payer (signer, writable) - must be deployer
  - system_program

Authorization: Deployer wallet only
```

### Set Admin
```
Instruction: set_admin
Args: new_admin (Pubkey)
Accounts:
  - treasury (writable)
  - current_admin (signer, writable)

Authorization: Current admin only
```

### Withdraw Fees
```
Instruction: withdraw_fees
Args: amount (u64 lamports)
Accounts:
  - treasury (writable)
  - admin (signer, writable)
  - recipient (writable)
  - system_program

Authorization: Admin only
```

### Claim Platform Tokens
```
Instruction: claim_platform_tokens
Accounts:
  - market (writable)
  - market_token_account (writable)
  - pnl_token_account (writable)
  - caller (signer) - can be anyone
  - token_program

Authorization: Permissionless (anyone can call)
```

---

**Last Updated**: 2025-01-18
**Version**: 1.0
**Status**: ✅ Ready for Production
