# PLP Program Deployment Guide

## 🎯 Overview

This guide covers how to **build, deploy, and test** your PLP prediction market program on Solana.

---

## 📋 Prerequisites Checklist

Before deploying, make sure you have:

- ✅ Solana CLI installed
- ✅ Anchor CLI installed (v0.30.1)
- ✅ A Solana keypair/wallet
- ✅ SOL for deployment (devnet=free airdrop, mainnet=real SOL)

### Check Your Setup:

```bash
# Check Solana CLI
solana --version
# Should show: solana-cli 1.18.x or higher

# Check Anchor CLI
anchor --version
# Should show: anchor-cli 0.30.1

# Check your wallet
solana address
# Should show your wallet address

# Check your balance
solana balance
```

---

## 🚀 Deployment Process

### **Step 1: Build the Program**

This compiles your Rust code into a Solana program (BPF bytecode):

```bash
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program

# Build the program
anchor build
```

**What happens:**
- Compiles Rust code in `programs/errors/src/`
- Creates `.so` file in `target/deploy/errors.so`
- Generates TypeScript IDL in `target/types/errors.ts`
- Updates program ID in `target/idl/errors.json`

**Output:**
```
Compiling errors v0.1.0
    Finished release [optimized] target(s) in 45.32s
```

**Common Issues:**

```bash
# If build fails with "Cargo.lock version error"
rm Cargo.lock
cargo generate-lockfile

# If dependencies issue
cargo clean
anchor build
```

---

### **Step 2A: Deploy to Local Validator (Development)**

**Best for:** Rapid development and testing

```bash
# Terminal 1: Start local validator
solana-test-validator

# Terminal 2: Deploy
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program
anchor deploy
```

**What happens:**
- Uploads `errors.so` to local validator
- Deploys program to address: `3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4`
- Creates program account on blockchain
- **Cost:** FREE (local validator)

**Verify Deployment:**
```bash
# Check if program exists
solana program show 3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4

# Should show:
# Program Id: 3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4
# Owner: BPFLoaderUpgradeab1e11111111111111111111111
# ProgramData Address: ...
# Authority: <your-wallet>
# Last Deployed In Slot: ...
# Data Length: ... bytes
```

---

### **Step 2B: Deploy to Devnet (Testing)**

**Best for:** Testing in a public environment before mainnet

```bash
# 1. Switch to devnet
solana config set --url devnet

# 2. Get free devnet SOL
solana airdrop 5

# Check balance (need ~2-3 SOL for deployment)
solana balance

# 3. Deploy
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program
anchor deploy --provider.cluster devnet
```

**What happens:**
- Uploads program to Solana devnet
- **Cost:** ~2-3 SOL (devnet, free via airdrop)
- Program is publicly accessible
- Other developers can interact with it

**Verify Deployment:**
```bash
solana program show 3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4 --url devnet
```

**View on Explorer:**
```
https://explorer.solana.com/address/3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4?cluster=devnet
```

---

### **Step 2C: Deploy to Mainnet (Production)**

**⚠️ IMPORTANT:** Only do this when ready for production!

```bash
# 1. Switch to mainnet
solana config set --url mainnet-beta

# 2. Ensure you have enough SOL
solana balance
# Need ~5-10 SOL for initial deployment + buffer

# 3. Deploy (BE CAREFUL!)
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program
anchor deploy --provider.cluster mainnet-beta
```

**What happens:**
- Uploads program to Solana mainnet
- **Cost:** ~5-10 SOL (REAL MONEY!)
- Program is permanent and immutable (unless you set upgrade authority)
- Users can interact with real SOL

**⚠️ Pre-Mainnet Checklist:**

- [ ] All tests passing on devnet
- [ ] Security audit completed
- [ ] Frontend tested with devnet
- [ ] Backup upgrade authority keypair
- [ ] Have emergency plan for bugs
- [ ] Understand you're deploying with REAL SOL

---

## 🧪 Step 3: Run Tests

Now that the program is deployed, run tests:

### **Option A: Automatic (Build + Deploy + Test)**

This does everything in one command:

```bash
# Local (automatic validator start/stop)
anchor test

# Devnet (deploys first, then tests)
anchor test --provider.cluster devnet
```

**What `anchor test` does:**
```
1. anchor build          # Compile program
2. solana-test-validator # Start validator (if local)
3. anchor deploy         # Deploy program
4. npm test              # Run TypeScript tests
5. (cleanup)             # Stop validator
```

### **Option B: Manual (Already Deployed)**

If you already deployed, skip deployment:

```bash
# Local (validator already running)
anchor test --skip-local-validator

# Devnet (already deployed)
anchor test --provider.cluster devnet --skip-deploy
```

### **Option C: Using the Script**

```bash
# Local testing (easiest)
./run-tests.sh local

# Devnet testing
./run-tests.sh devnet
```

---

## 📊 Understanding Program Deployment

### **What Gets Deployed?**

```
plp_program/
├── target/
│   ├── deploy/
│   │   └── errors.so          ← This binary file gets uploaded to Solana
│   ├── types/
│   │   └── errors.ts          ← TypeScript definitions for your program
│   └── idl/
│       └── errors.json        ← Interface Definition Language (like ABI)
```

### **Program Account Structure**

After deployment, Solana creates these accounts:

```
Program Account (3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4)
├── Owner: BPFLoaderUpgradeable
├── Data: Your compiled program code
└── ProgramData Account
    ├── Upgrade Authority: <your-wallet> (can update program)
    └── Program binary (errors.so)
```

### **Cost Breakdown**

| Network | Initial Deploy | Account Rent | Upgrade | Total |
|---------|---------------|--------------|---------|-------|
| **Localnet** | FREE | FREE | FREE | **FREE** |
| **Devnet** | ~2 SOL (airdrop) | FREE | ~1 SOL | **FREE** |
| **Mainnet** | ~5 SOL | ~2 SOL/year | ~3 SOL | **~10 SOL** |

---

## 🔄 Updating/Upgrading Your Program

### **After Making Code Changes:**

```bash
# 1. Rebuild
anchor build

# 2. Upgrade (keeps same program ID)
anchor upgrade target/deploy/errors.so --program-id 3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4

# OR redeploy (same effect if upgrade authority set)
anchor deploy
```

**Important:**
- Upgrading preserves all on-chain data (markets, positions, treasury)
- Only the program code changes
- Must be upgrade authority to upgrade

### **Make Program Immutable (Cannot Update):**

```bash
# Remove upgrade authority (PERMANENT!)
solana program set-upgrade-authority 3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4 --final

# ⚠️ WARNING: After this, you can NEVER update the program!
```

---

## 🐛 Troubleshooting Deployment

### **Error: "Insufficient funds"**

```bash
# Devnet
solana airdrop 5 --url devnet

# Mainnet
# You need to buy/transfer real SOL
```

### **Error: "Program already deployed"**

This is normal! Program updates are allowed:

```bash
# Just redeploy (will upgrade)
anchor deploy

# Or explicitly upgrade
anchor upgrade target/deploy/errors.so --program-id <PROGRAM_ID>
```

### **Error: "Failed to send transaction"**

```bash
# Check RPC health
solana cluster-version

# Try different RPC
solana config set --url https://api.devnet.solana.com

# Check validator logs
solana logs
```

### **Error: "Program size too large"**

```bash
# Optimize build
cargo build-bpf --release

# Check size
ls -lh target/deploy/errors.so
# Should be < 200KB for most programs
```

---

## ✅ Deployment Checklist

### **Before First Deployment:**

- [ ] Code compiles: `anchor build`
- [ ] Tests pass locally: `anchor test`
- [ ] Environment configured: `solana config get`
- [ ] Wallet has SOL: `solana balance`
- [ ] Program ID matches in code and `Anchor.toml`

### **After Deployment:**

- [ ] Verify program on explorer
- [ ] Initialize treasury: Call `init_treasury()`
- [ ] Create test market: Call `create_market()`
- [ ] Run integration tests
- [ ] Test with frontend

### **Before Mainnet:**

- [ ] All devnet tests passing
- [ ] Security audit completed
- [ ] Frontend tested end-to-end
- [ ] Upgrade authority backed up
- [ ] Emergency procedures documented
- [ ] Team reviewed deployment plan

---

## 📝 Quick Reference

### **Deployment Commands:**

```bash
# Build only
anchor build

# Deploy to local
solana-test-validator          # Terminal 1
anchor deploy                  # Terminal 2

# Deploy to devnet
solana config set --url devnet
solana airdrop 5
anchor deploy

# Deploy to mainnet
solana config set --url mainnet-beta
anchor deploy                  # ⚠️ COSTS REAL SOL

# Build + Deploy + Test (all in one)
anchor test
```

### **Useful Commands:**

```bash
# Check program info
solana program show <PROGRAM_ID>

# View program logs
solana logs --url devnet

# Check deployment status
solana program dump <PROGRAM_ID> program.so

# Close program (get SOL back) - CAREFUL!
solana program close <PROGRAM_ID>
```

---

## 🎯 Recommended Workflow

For best results, follow this order:

```
1. Development
   └─ anchor build + anchor test (local)
   └─ Iterate quickly

2. Integration Testing
   └─ anchor deploy (devnet)
   └─ Test with frontend on devnet
   └─ Get feedback

3. Staging
   └─ Security audit
   └─ Load testing on devnet
   └─ Fix issues

4. Production
   └─ anchor deploy (mainnet)
   └─ Initialize treasury
   └─ Monitor closely
   └─ Gradual rollout
```

---

## 🚀 Ready to Deploy?

**For local testing (safest):**
```bash
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program
./run-tests.sh local
```

**For devnet deployment:**
```bash
./run-tests.sh devnet
```

**For just building:**
```bash
./run-tests.sh build
```

Your program is ready! 🎉
