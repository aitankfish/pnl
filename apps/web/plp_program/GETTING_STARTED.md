# 🚀 Getting Started - PLP Program Testing & Deployment

## **TL;DR - Quick Start**

```bash
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program

# Run everything (build + deploy + test) in one command:
anchor test

# That's it! 🎉
```

---

## **What You Need to Know**

### **Q: Do I need to deploy before testing?**

**A: No! `anchor test` does it automatically.**

When you run `anchor test`, it automatically:

```
Step 1: anchor build          ✅ Compiles your Rust code
Step 2: Start validator       ✅ Starts local blockchain
Step 3: anchor deploy         ✅ Deploys program to blockchain
Step 4: npm test              ✅ Runs your TypeScript tests
Step 5: Cleanup               ✅ Stops validator
```

So **you don't need to manually deploy** for testing!

---

## **Three Simple Ways to Test**

### **Option 1: One Command (Easiest) ⭐**

```bash
anchor test
```

**What it does:**
- Everything! (build, deploy, test, cleanup)
- Uses local validator (FREE, FAST)
- Takes ~30-60 seconds
- Perfect for development

**When to use:**
- Daily development
- Quick iteration
- Before pushing code

---

### **Option 2: With Script (Convenient) ⭐⭐**

```bash
./run-tests.sh local     # Local testing (default)
./run-tests.sh devnet    # Test on real devnet
./run-tests.sh build     # Just build, no tests
./run-tests.sh clean     # Clean everything
```

**What it does:**
- Same as `anchor test` but with nice colors and status messages
- Handles common errors
- Shows progress clearly

**When to use:**
- When you want prettier output
- When testing on devnet
- When you want guided workflow

---

### **Option 3: Manual Steps (Full Control) ⭐⭐⭐**

```bash
# Step 1: Build
anchor build

# Step 2: Start validator (Terminal 1)
solana-test-validator

# Step 3: Deploy (Terminal 2)
anchor deploy

# Step 4: Test
anchor test --skip-local-validator
```

**What it does:**
- Gives you control of each step
- Good for debugging
- Validator stays running between tests

**When to use:**
- Debugging issues
- Inspecting accounts between tests
- Learning how it works

---

## **Understanding the Flow**

```
┌─────────────────────────────────────────────┐
│  1. anchor build                            │
│     Compiles Rust → errors.so binary        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  2. solana-test-validator                   │
│     Starts local Solana blockchain          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  3. anchor deploy                           │
│     Uploads errors.so to blockchain         │
│     Program Address: 3jGpj7HY...            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  4. Tests run (TypeScript)                  │
│     ├─ Initialize treasury                  │
│     ├─ Create market                        │
│     ├─ Buy YES/NO shares                    │
│     ├─ Resolve market                       │
│     └─ Claim rewards                        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  5. Results                                 │
│     ✓ 15 passing (45s) ✅                   │
└─────────────────────────────────────────────┘
```

---

## **First Time Setup**

### **1. Install Dependencies**

```bash
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program

# Install Node packages
npm install
```

### **2. Verify Setup**

```bash
# Check Anchor
anchor --version
# Should show: anchor-cli 0.30.1

# Check Solana
solana --version
# Should show: solana-cli 1.18.x

# Check Node
node --version
# Should show: v18.x or higher
```

### **3. Run Your First Test**

```bash
anchor test
```

**Expected Output:**
```
Build complete
Starting test validator
Deploying program...
Running tests...

PLP Prediction Market Program
  1. Treasury Initialization
    ✅ Treasury initialized
  2. Market Creation
    ✅ Market created
  ...

  ✓ 15 passing (45s)
```

---

## **What Gets Tested?**

Your test suite automatically verifies:

```
✅ Treasury
   └─ Initialize with admin
   └─ Withdraw fees
   └─ Set new admin

✅ Market Creation
   └─ Create with IPFS CID
   └─ Charge 0.015 SOL fee
   └─ Initialize LMSR (q_yes=1000, q_no=1000)
   └─ Reject invalid targets (not 5/10/15 SOL)

✅ Trading
   └─ Buy YES shares (1.5% fee, LMSR pricing)
   └─ Buy NO shares (1.5% fee, LMSR pricing)
   └─ Reject < 0.01 SOL minimum
   └─ Enforce one-position rule

✅ Resolution
   └─ Reject before expiry
   └─ Determine winner (YES/NO/Refund)
   └─ Charge 5% completion fee

✅ Claims
   └─ Proportional distribution
   └─ One-time claim enforcement
   └─ Full refunds when needed
```

---

## **Common Questions**

### **Q: Where does the program get deployed?**

**A:** To a **local test validator** (fake blockchain on your computer)

```
Program ID: 3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4
Network: localnet (http://127.0.0.1:8899)
Cost: FREE
```

### **Q: Do I need SOL to test?**

**A:** No! Local testing is FREE. The test validator gives you unlimited fake SOL.

```bash
# Local = FREE ✅
anchor test

# Devnet = FREE (via airdrop) ✅
solana airdrop 5 --url devnet

# Mainnet = COSTS REAL SOL ⚠️
# Don't deploy to mainnet yet!
```

### **Q: What if tests fail?**

**A:** Check the error message:

```bash
# Common fixes:

# 1. Clean and rebuild
anchor clean
anchor build

# 2. Reset validator
solana-test-validator --reset

# 3. Check program ID matches
grep "declare_id" programs/errors/src/lib.rs
grep "errors" Anchor.toml
```

### **Q: How do I see program logs?**

**A:** Run validator in separate terminal:

```bash
# Terminal 1: Validator with logs
solana-test-validator --log

# Terminal 2: Run tests
anchor test --skip-local-validator
```

### **Q: Can I test on real devnet?**

**A:** Yes! Use the script:

```bash
./run-tests.sh devnet
```

This:
- Switches to devnet
- Airdrops free SOL
- Deploys program
- Runs tests
- Shows results

---

## **Troubleshooting**

### **Error: "anchor: command not found"**

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1
```

### **Error: "Build failed"**

```bash
# Clean everything
./run-tests.sh clean

# Regenerate lockfile
rm Cargo.lock
cargo generate-lockfile

# Rebuild
anchor build
```

### **Error: "Test validator failed to start"**

```bash
# Kill any existing validators
pkill -f solana-test-validator

# Try again
anchor test
```

### **Error: "Cannot find module '../target/types/errors'"**

```bash
# Build first to generate types
anchor build

# Then test
anchor test
```

---

## **Next Steps**

After tests pass:

1. ✅ **Review Results** - Make sure all tests pass
2. 📝 **Add Custom Tests** - Test your specific scenarios
3. 🌐 **Test on Devnet** - `./run-tests.sh devnet`
4. 🔒 **Security Audit** - Review for vulnerabilities
5. 🚀 **Deploy to Mainnet** - When ready (see DEPLOYMENT_GUIDE.md)

---

## **Quick Reference Card**

```bash
# The One Command to Rule Them All
anchor test              # Build + Deploy + Test + Cleanup

# Alternative Workflows
./run-tests.sh local     # Same as above with pretty output
./run-tests.sh devnet    # Test on real devnet
./run-tests.sh build     # Just compile, don't test

# Manual Control
anchor build             # Compile only
anchor deploy            # Deploy only
npm test                 # Test only

# Debugging
solana logs              # View program logs
solana-test-validator    # Start validator manually
anchor clean             # Clean build artifacts
```

---

## **🎯 Ready? Let's Go!**

```bash
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program

# Run this:
anchor test

# Wait for:
✓ 15 passing (45s)

# You're done! 🎉
```

**Pro tip:** If you get lost, just run `anchor test`. It does everything for you!

---

## **Help & Resources**

- 📖 **Full Testing Guide:** `TEST_GUIDE.md`
- 🚀 **Deployment Guide:** `DEPLOYMENT_GUIDE.md`
- 🧪 **Test Code:** `tests/plp-program.test.ts`
- 🔧 **Run Script:** `./run-tests.sh --help`

Happy testing! 🚀
