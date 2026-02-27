# PLP Program Testing Guide

## 🎯 Overview

This guide covers how to test your PLP prediction market program on Solana.

## 📋 Prerequisites

1. **Solana CLI installed**
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```

2. **Anchor CLI installed**
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install 0.30.1
   avm use 0.30.1
   ```

3. **Node.js and Yarn**
   ```bash
   # Install dependencies
   cd plp_program
   npm install
   ```

4. **Solana Wallet**
   ```bash
   # Generate a keypair if you don't have one
   solana-keygen new
   ```

## 🧪 Testing Options

### Option 1: Local Test Validator (Recommended for Development)

This runs tests on a local Solana validator - fast and free!

```bash
# Terminal 1: Start local validator
solana-test-validator

# Terminal 2: Run tests
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program

# Build the program
anchor build

# Run tests
anchor test --skip-local-validator
```

**What happens:**
- Starts a local Solana blockchain
- Deploys your program
- Runs comprehensive tests covering all instructions
- Shows detailed logs and results

### Option 2: Devnet Testing

Test on Solana's public devnet - slower but more realistic.

```bash
# 1. Configure Solana to use devnet
solana config set --url devnet

# 2. Get devnet SOL (free!)
solana airdrop 5

# 3. Build and deploy
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program
anchor build

# 4. Deploy to devnet
anchor deploy

# 5. Run tests against devnet
anchor test --provider.cluster devnet --skip-deploy
```

**Note:** Devnet airdrops are rate-limited. If you get "airdrop failed", wait a few minutes.

### Option 3: Unit Tests Only (No Deployment)

Test individual components without deploying:

```bash
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program

# Run Rust tests (LMSR math, etc.)
cargo test

# Run TypeScript tests
npm test
```

## 📊 Test Coverage

Our test suite covers:

### ✅ **1. Treasury Initialization**
- Creates global treasury PDA
- Verifies admin authority
- Checks initial state

### ✅ **2. Market Creation**
- Creates prediction market with IPFS CID
- Charges 0.015 SOL creation fee
- Initializes LMSR parameters (q_yes=1000, q_no=1000, b=target/100)
- Validates target pool (5/10/15 SOL)
- Rejects invalid inputs

### ✅ **3. Buying YES Shares**
- Validates minimum investment (0.01 SOL)
- Charges 1.5% trade fee
- Calculates shares using LMSR
- Updates market and position state
- Tracks total invested

### ✅ **4. Buying NO Shares**
- Same validations as YES
- Dynamic pricing via LMSR
- Updates q_no and pool balance

### ✅ **5. One-Position Rule**
- Prevents YES holders from buying NO
- Prevents NO holders from buying YES
- Enforced on-chain

### ✅ **6. Market Resolution**
- Rejects resolution before expiry
- Determines outcome (YesWins/NoWins/Refund)
- Charges 5% completion fee
- Updates market resolution state

### ✅ **7. Claim Rewards**
- YES winners get token airdrops (proportional)
- NO winners get SOL payouts (proportional)
- Refunds return 100% of invested
- One-time claim enforcement

### ✅ **8. Treasury Management**
- Admin can withdraw fees
- Set new admin
- Access control enforced

## 🔍 Understanding Test Output

### Successful Test Run:
```
PLP Prediction Market Program
  1. Treasury Initialization
    ✅ Treasury initialized: 5x2k...abc

  2. Market Creation
    ✅ Market created: 3h9f...xyz
    📊 Market Details:
      Target Pool: 5000000000 lamports
      Liquidity (b): 50000000 lamports
      Initial q_yes: 1000
      Initial q_no: 1000

  3. Buying YES Shares
    ✅ YES shares purchased: 2k4j...def
    📊 Position Details:
      YES shares: 987654321
      Total invested: 1000000000 lamports
      Market q_yes: 1987654321
      Pool balance: 985000000 lamports

  ... (more tests)

  ✓ 15 passing (45s)
```

### Common Errors:

**"Insufficient funds"**
```bash
# Get more devnet SOL
solana airdrop 5
```

**"Program not deployed"**
```bash
# Rebuild and deploy
anchor build
anchor deploy
```

**"Account already exists"**
```bash
# Clean and restart
anchor clean
solana-test-validator --reset
```

## 🐛 Debugging Tests

### Enable Detailed Logs:
```bash
# Set Solana log level
export RUST_LOG=solana_runtime::system_instruction_processor=trace,solana_runtime::message_processor=debug,solana_bpf_loader=debug,solana_rbpf=debug

# Run with verbose output
anchor test --skip-local-validator -- --nocapture
```

### View Program Logs:
```bash
# During local testing
solana logs

# For specific transaction
solana confirm -v <TRANSACTION_SIGNATURE>
```

### Inspect Accounts:
```bash
# View account data
solana account <ACCOUNT_ADDRESS>

# Decode program account (requires IDL)
anchor account market <MARKET_ADDRESS>
anchor account position <POSITION_ADDRESS>
```

## 📝 Writing Custom Tests

### Basic Test Structure:
```typescript
it("Should do something", async () => {
  // 1. Setup - derive PDAs, prepare data
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), founder.publicKey.toBuffer(), Buffer.from(ipfsCid)],
    program.programId
  );

  // 2. Execute - call program instruction
  const tx = await program.methods
    .buyYes(new BN(1 * LAMPORTS_PER_SOL))
    .accounts({
      market: marketPda,
      position: positionPda,
      treasury: treasury,
      user: user1.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([user1])
    .rpc();

  // 3. Verify - check on-chain state
  const market = await program.account.market.fetch(marketPda);
  assert.isTrue(market.qYes.toNumber() > 0);
});
```

### Testing Error Cases:
```typescript
it("Should reject invalid input", async () => {
  try {
    await program.methods
      .buyYes(new BN(100)) // Too small
      .accounts({ /* ... */ })
      .rpc();

    assert.fail("Should have thrown error");
  } catch (error) {
    assert.include(error.toString(), "InvestmentTooSmall");
  }
});
```

## 🚀 Next Steps

1. **Run the basic tests** to verify your program works
2. **Add custom test cases** for your specific scenarios
3. **Test on devnet** before mainnet deployment
4. **Audit the program** for security vulnerabilities
5. **Deploy to mainnet** when ready

## 📚 Resources

- [Anchor Testing Docs](https://www.anchor-lang.com/docs/testing)
- [Solana CLI Reference](https://docs.solana.com/cli)
- [Solana Program Testing](https://docs.solana.com/developing/test-validator)

## 💡 Tips

- Always test on localnet first (fastest iteration)
- Use `console.log()` liberally for debugging
- Check account balances before/after transactions
- Verify all PDAs are derived correctly
- Test edge cases (minimum values, maximum values, boundary conditions)
- Clean up test accounts between runs to avoid conflicts

---

**Ready to test?** Run:
```bash
cd /Users/bishwanathbastola/CascadeProjects/PLP/plp-platform/plp_program
anchor test
```
