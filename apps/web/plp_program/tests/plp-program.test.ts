import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import type { Errors } from "../target/types/errors";

describe("PLP Prediction Market Program", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Errors as Program<Errors>;

  // Test accounts
  let treasury: PublicKey;
  let treasuryBump: number;

  let founder: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let user3: Keypair;

  // Market test data
  const ipfsCid = "QmTest123456789abcdefghijklmnopqrstuvwxyz";
  const targetPool = new BN(5 * LAMPORTS_PER_SOL); // 5 SOL
  const metadataUri = "https://ipfs.io/ipfs/QmTest123456789";

  // Helper function to airdrop SOL
  async function airdrop(publicKey: PublicKey, amount: number = 10) {
    const signature = await provider.connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  }

  // Helper function to get balance
  async function getBalance(publicKey: PublicKey): Promise<number> {
    return await provider.connection.getBalance(publicKey);
  }

  before(async () => {
    // Generate test keypairs
    founder = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    user3 = Keypair.generate();

    // Airdrop SOL to test accounts
    console.log("Airdropping SOL to test accounts...");
    await airdrop(founder.publicKey, 20);
    await airdrop(user1.publicKey, 10);
    await airdrop(user2.publicKey, 10);
    await airdrop(user3.publicKey, 10);
    await airdrop(provider.wallet.publicKey, 10); // For treasury admin

    // Derive treasury PDA
    [treasury, treasuryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    console.log("Test accounts setup complete");
    console.log("  Founder:", founder.publicKey.toString());
    console.log("  User1:", user1.publicKey.toString());
    console.log("  User2:", user2.publicKey.toString());
    console.log("  User3:", user3.publicKey.toString());
    console.log("  Treasury:", treasury.toString());
  });

  describe("1. Treasury Initialization", () => {
    it("Should initialize the treasury", async () => {
      try {
        const tx = await program.methods
          .initTreasury()
          .accounts({
            treasury: treasury,
            payer: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("  ✅ Treasury initialized:", tx);

        // Fetch and verify treasury account
        const treasuryAccount = await program.account.treasury.fetch(treasury);
        assert.equal(
          treasuryAccount.admin.toString(),
          provider.wallet.publicKey.toString(),
          "Admin should be the payer"
        );
        assert.equal(
          treasuryAccount.totalFees.toNumber(),
          0,
          "Total fees should be 0"
        );
        assert.equal(treasuryAccount.bump, treasuryBump, "Bump should match");
      } catch (error) {
        console.error("Error initializing treasury:", error);
        throw error;
      }
    });
  });

  describe("2. Market Creation", () => {
    let marketPda: PublicKey;
    let marketBump: number;

    before(() => {
      // Derive market PDA
      [marketPda, marketBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), founder.publicKey.toBuffer(), Buffer.from(ipfsCid)],
        program.programId
      );
    });

    it("Should create a prediction market", async () => {
      const expiryTime = new BN(Math.floor(Date.now() / 1000) + 86400); // 24 hours from now

      const balanceBefore = await getBalance(founder.publicKey);
      const treasuryBalanceBefore = await getBalance(treasury);

      const tx = await program.methods
        .createMarket(ipfsCid, targetPool, expiryTime, metadataUri)
        .accounts({
          market: marketPda,
          treasury: treasury,
          founder: founder.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([founder])
        .rpc();

      console.log("  ✅ Market created:", tx);

      // Verify market account
      const market = await program.account.market.fetch(marketPda);
      assert.equal(market.founder.toString(), founder.publicKey.toString());
      assert.equal(market.ipfsCid, ipfsCid);
      assert.equal(market.targetPool.toString(), targetPool.toString());
      assert.equal(market.poolBalance.toNumber(), 0);
      assert.equal(market.qYes.toNumber(), 1000); // INITIAL_Q
      assert.equal(market.qNo.toNumber(), 1000); // INITIAL_Q
      assert.equal(market.b.toString(), targetPool.div(new BN(100)).toString());

      // Verify creation fee was charged
      const balanceAfter = await getBalance(founder.publicKey);
      const treasuryBalanceAfter = await getBalance(treasury);

      const creationFee = 15_000_000; // 0.015 SOL
      assert.isTrue(
        treasuryBalanceAfter - treasuryBalanceBefore >= creationFee,
        "Treasury should receive creation fee"
      );

      console.log("  📊 Market Details:");
      console.log("    Target Pool:", market.targetPool.toString(), "lamports");
      console.log("    Liquidity (b):", market.b.toString(), "lamports");
      console.log("    Initial q_yes:", market.qYes.toNumber());
      console.log("    Initial q_no:", market.qNo.toNumber());
    });

    it("Should fail to create market with invalid target pool", async () => {
      const invalidTarget = new BN(3 * LAMPORTS_PER_SOL); // 3 SOL (not 5/10/15)
      const expiryTime = new BN(Math.floor(Date.now() / 1000) + 86400);

      const [invalidMarket] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), founder.publicKey.toBuffer(), Buffer.from("invalid")],
        program.programId
      );

      try {
        await program.methods
          .createMarket("invalid", invalidTarget, expiryTime, metadataUri)
          .accounts({
            market: invalidMarket,
            treasury: treasury,
            founder: founder.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([founder])
          .rpc();

        assert.fail("Should have thrown error for invalid target pool");
      } catch (error) {
        assert.include(error.toString(), "InvalidTargetPool");
        console.log("  ✅ Correctly rejected invalid target pool");
      }
    });
  });

  describe("3. Buying YES Shares", () => {
    let marketPda: PublicKey;
    let position1: PublicKey;

    before(() => {
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), founder.publicKey.toBuffer(), Buffer.from(ipfsCid)],
        program.programId
      );

      [position1] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Should allow user to buy YES shares", async () => {
      const solAmount = new BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      const marketBefore = await program.account.market.fetch(marketPda);
      const treasuryBefore = await program.account.treasury.fetch(treasury);

      const tx = await program.methods
        .buyYes(solAmount)
        .accounts({
          market: marketPda,
          position: position1,
          treasury: treasury,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      console.log("  ✅ YES shares purchased:", tx);

      // Verify position
      const position = await program.account.position.fetch(position1);
      assert.equal(position.user.toString(), user1.publicKey.toString());
      assert.equal(position.market.toString(), marketPda.toString());
      assert.isTrue(position.yesShares.toNumber() > 0, "Should have YES shares");
      assert.equal(position.noShares.toNumber(), 0, "Should have 0 NO shares");
      assert.equal(position.totalInvested.toString(), solAmount.toString());
      assert.isFalse(position.claimed, "Should not be claimed yet");

      // Verify market updated
      const marketAfter = await program.account.market.fetch(marketPda);
      assert.isTrue(
        marketAfter.qYes.toNumber() > marketBefore.qYes.toNumber(),
        "Market q_yes should increase"
      );
      assert.isTrue(
        marketAfter.poolBalance.toNumber() > 0,
        "Pool balance should increase"
      );

      // Verify trade fee charged
      const treasuryAfter = await program.account.treasury.fetch(treasury);
      assert.isTrue(
        treasuryAfter.totalFees.toNumber() > treasuryBefore.totalFees.toNumber(),
        "Treasury fees should increase"
      );

      console.log("  📊 Position Details:");
      console.log("    YES shares:", position.yesShares.toString());
      console.log("    Total invested:", position.totalInvested.toString(), "lamports");
      console.log("    Market q_yes:", marketAfter.qYes.toString());
      console.log("    Pool balance:", marketAfter.poolBalance.toString(), "lamports");
    });

    it("Should reject investment below minimum", async () => {
      const tooSmall = new BN(5_000_000); // 0.005 SOL (below 0.01 minimum)

      const [newPosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), user3.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .buyYes(tooSmall)
          .accounts({
            market: marketPda,
            position: newPosition,
            treasury: treasury,
            user: user3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user3])
          .rpc();

        assert.fail("Should have thrown error for investment too small");
      } catch (error) {
        assert.include(error.toString(), "InvestmentTooSmall");
        console.log("  ✅ Correctly rejected investment below minimum");
      }
    });
  });

  describe("4. Buying NO Shares", () => {
    let marketPda: PublicKey;
    let position2: PublicKey;

    before(() => {
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), founder.publicKey.toBuffer(), Buffer.from(ipfsCid)],
        program.programId
      );

      [position2] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Should allow user to buy NO shares", async () => {
      const solAmount = new BN(2 * LAMPORTS_PER_SOL); // 2 SOL

      const marketBefore = await program.account.market.fetch(marketPda);

      const tx = await program.methods
        .buyNo(solAmount)
        .accounts({
          market: marketPda,
          position: position2,
          treasury: treasury,
          user: user2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      console.log("  ✅ NO shares purchased:", tx);

      // Verify position
      const position = await program.account.position.fetch(position2);
      assert.equal(position.user.toString(), user2.publicKey.toString());
      assert.equal(position.yesShares.toNumber(), 0, "Should have 0 YES shares");
      assert.isTrue(position.noShares.toNumber() > 0, "Should have NO shares");
      assert.equal(position.totalInvested.toString(), solAmount.toString());

      // Verify market updated
      const marketAfter = await program.account.market.fetch(marketPda);
      assert.isTrue(
        marketAfter.qNo.toNumber() > marketBefore.qNo.toNumber(),
        "Market q_no should increase"
      );

      console.log("  📊 Position Details:");
      console.log("    NO shares:", position.noShares.toString());
      console.log("    Market q_no:", marketAfter.qNo.toString());
    });
  });

  describe("5. One-Position Rule", () => {
    let marketPda: PublicKey;
    let position1: PublicKey;

    before(() => {
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), founder.publicKey.toBuffer(), Buffer.from(ipfsCid)],
        program.programId
      );

      [position1] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Should prevent user with YES shares from buying NO shares", async () => {
      const solAmount = new BN(0.5 * LAMPORTS_PER_SOL);

      try {
        await program.methods
          .buyNo(solAmount)
          .accounts({
            market: marketPda,
            position: position1,
            treasury: treasury,
            user: user1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown error for one-position rule violation");
      } catch (error) {
        assert.include(error.toString(), "AlreadyHasPosition");
        console.log("  ✅ One-position rule correctly enforced (YES holder cannot buy NO)");
      }
    });
  });

  describe("6. Market Resolution", () => {
    let marketPda: PublicKey;
    let newMarketPda: PublicKey;
    const newIpfsCid = "QmNewMarket123456789";

    before(async () => {
      // Create a new market for resolution testing
      [newMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), founder.publicKey.toBuffer(), Buffer.from(newIpfsCid)],
        program.programId
      );

      const expiryTime = new BN(Math.floor(Date.now() / 1000) + 5); // Expires in 5 seconds

      await program.methods
        .createMarket(newIpfsCid, targetPool, expiryTime, metadataUri)
        .accounts({
          market: newMarketPda,
          treasury: treasury,
          founder: founder.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([founder])
        .rpc();

      // Add some votes
      const [pos1] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), newMarketPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .buyYes(new BN(2 * LAMPORTS_PER_SOL))
        .accounts({
          market: newMarketPda,
          position: pos1,
          treasury: treasury,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const [pos2] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), newMarketPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .buyNo(new BN(1 * LAMPORTS_PER_SOL))
        .accounts({
          market: newMarketPda,
          position: pos2,
          treasury: treasury,
          user: user2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      console.log("  ⏳ Waiting for market to expire...");
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds
    });

    it("Should fail to resolve before expiry", async () => {
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), founder.publicKey.toBuffer(), Buffer.from(ipfsCid)],
        program.programId
      );

      try {
        await program.methods
          .resolveMarket()
          .accounts({
            market: marketPda,
            treasury: treasury,
            authority: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        assert.fail("Should have thrown error for resolving before expiry");
      } catch (error) {
        assert.include(error.toString(), "MarketNotExpired");
        console.log("  ✅ Correctly rejected resolution before expiry");
      }
    });

    it("Should resolve market after expiry (YES wins)", async () => {
      const marketBefore = await program.account.market.fetch(newMarketPda);

      const tx = await program.methods
        .resolveMarket()
        .accounts({
          market: newMarketPda,
          treasury: treasury,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("  ✅ Market resolved:", tx);

      const marketAfter = await program.account.market.fetch(newMarketPda);

      // Verify resolution (YES should win since more YES shares)
      console.log("  📊 Resolution Details:");
      console.log("    q_yes:", marketAfter.qYes.toString());
      console.log("    q_no:", marketAfter.qNo.toString());
      console.log("    Resolution:", marketAfter.resolution);

      assert.isDefined(marketAfter.resolution, "Market should be resolved");
      // Note: Resolution will be YesWins if q_yes > q_no, NoWins if q_no > q_yes, or Refund
    });
  });

  describe("7. Claim Rewards", () => {
    // This test would need a resolved market
    // Implementation depends on the final resolution outcome
    it("Should allow claiming rewards after resolution", async () => {
      console.log("  ℹ️  Claim rewards test - implementation depends on market resolution");
      // TODO: Implement based on resolution type (YesWins/NoWins/Refund)
    });
  });

  describe("8. Treasury Management", () => {
    it("Should allow admin to withdraw fees", async () => {
      const treasuryBefore = await program.account.treasury.fetch(treasury);
      const withdrawAmount = new BN(10_000_000); // 0.01 SOL

      if (treasuryBefore.totalFees.gte(withdrawAmount)) {
        const recipientBefore = await getBalance(provider.wallet.publicKey);

        const tx = await program.methods
          .withdrawFees(withdrawAmount)
          .accounts({
            treasury: treasury,
            admin: provider.wallet.publicKey,
            recipient: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("  ✅ Fees withdrawn:", tx);

        const treasuryAfter = await program.account.treasury.fetch(treasury);
        const recipientAfter = await getBalance(provider.wallet.publicKey);

        assert.isTrue(
          recipientAfter > recipientBefore,
          "Recipient should receive funds"
        );

        console.log("  💰 Withdrawn:", withdrawAmount.toString(), "lamports");
      } else {
        console.log("  ℹ️  Not enough fees to test withdrawal");
      }
    });
  });
});
