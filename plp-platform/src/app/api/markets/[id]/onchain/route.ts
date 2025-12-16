/**
 * API endpoint to fetch on-chain market data
 *
 * Returns the current state of the market from the Solana blockchain
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana';
import { createClientLogger } from '@/lib/logger';
import { SOLANA_NETWORK, PROGRAM_ID } from '@/config/solana';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

interface MarketAccount {
  founder: PublicKey;
  ipfsCid: string;
  targetPool: bigint;
  poolBalance: bigint;
  yesPool: bigint;
  noPool: bigint;
  totalYesShares: bigint;
  totalNoShares: bigint;
  expiryTime: bigint;
  phase: number;
  resolution: number;
  metadataUri: string;
  tokenMint: PublicKey | null;
  platformTokensAllocated: bigint;
  platformTokensClaimed: boolean;
  yesVoterTokensAllocated: bigint;
  founderExcessSolAllocated: bigint;
  founderVestingInitialized: boolean;
  treasury: PublicKey;
  bump: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketAddress } = await params;

    if (!marketAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market address required',
        },
        { status: 400 }
      );
    }

    // Get network from query parameter (frontend passes this based on user selection)
    // Fallback to environment variable if not provided
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network = (networkParam as 'mainnet-beta' | 'devnet' | null) || SOLANA_NETWORK;

    logger.info('Fetching on-chain market data', { marketAddress, network });

    // Convert address to PublicKey
    let marketPubkey;
    try {
      marketPubkey = new PublicKey(marketAddress);
      logger.info('PublicKey created successfully', { marketPubkey: marketPubkey.toBase58() });
    } catch (error) {
      logger.error('Invalid market address format', { marketAddress, error });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid market address format',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 400 }
      );
    }

    // Get Solana connection with network parameter
    let connection;
    try {
      connection = await getSolanaConnection(network);
      logger.info('Solana connection established', { network });
    } catch (error) {
      logger.error('Failed to establish Solana connection', { error, network });
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to connect to blockchain',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Fetch market account info directly
    let accountInfo;
    try {
      accountInfo = await connection.getAccountInfo(marketPubkey);
      if (!accountInfo) {
        logger.error('Market account not found', { marketAddress });
        return NextResponse.json(
          {
            success: false,
            error: 'Market not found on blockchain',
          },
          { status: 404 }
        );
      }
      logger.info('Market account info fetched', { marketAddress, dataLength: accountInfo.data.length });
    } catch (error) {
      logger.error('Failed to fetch market account', { marketAddress, error });
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch market data from blockchain',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Manually deserialize the account data
    // Account layout: discriminator (8 bytes) + struct data
    let marketAccount: MarketAccount;
    try {
      const accountData = accountInfo.data;
      // Skip the 8-byte discriminator
      const dataWithoutDiscriminator = accountData.slice(8);

      // Manual deserialization based on the Market struct
      // This is a simplified version - you may need to adjust based on actual struct layout
      const decoder = new TextDecoder();
      let offset = 0;

      // Read founder (32 bytes - PublicKey)
      const founder = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
      offset += 32;

      // Read ipfs_cid (String - 4 bytes length + data)
      const ipfsCidLen = dataWithoutDiscriminator.readUInt32LE(offset);
      offset += 4;
      const ipfsCid = decoder.decode(dataWithoutDiscriminator.slice(offset, offset + ipfsCidLen));
      offset += ipfsCidLen;

      // Read target_pool (8 bytes - u64)
      const targetPool = dataWithoutDiscriminator.readBigUInt64LE(offset);
      offset += 8;

      // Read pool_balance (8 bytes - u64)
      const poolBalance = dataWithoutDiscriminator.readBigUInt64LE(offset);
      offset += 8;

      // Read distribution_pool (8 bytes - u64)
      const distributionPool = dataWithoutDiscriminator.readBigUInt64LE(offset);
      offset += 8;

      // Read yes_pool (8 bytes - u64)
      const yesPool = dataWithoutDiscriminator.readBigUInt64LE(offset);
      offset += 8;

      // Read no_pool (8 bytes - u64)
      const noPool = dataWithoutDiscriminator.readBigUInt64LE(offset);
      offset += 8;

      // Read total_yes_shares (8 bytes - u64)
      const totalYesShares = dataWithoutDiscriminator.readBigUInt64LE(offset);
      offset += 8;

      // Read total_no_shares (8 bytes - u64)
      const totalNoShares = dataWithoutDiscriminator.readBigUInt64LE(offset);
      offset += 8;

      // Read expiry_time (8 bytes - i64)
      const expiryTime = dataWithoutDiscriminator.readBigInt64LE(offset);
      offset += 8;

      // Read phase (1 byte enum) - 0=Prediction, 1=Funding
      const phaseByte = dataWithoutDiscriminator[offset];
      offset += 1;

      // Read resolution (1 byte enum) - 0=Unresolved, 1=YesWins, 2=NoWins, 3=Refund
      const resolutionByte = dataWithoutDiscriminator[offset];
      offset += 1;

      // Read metadata_uri (String - 4 bytes length + data)
      const metadataUriLen = dataWithoutDiscriminator.readUInt32LE(offset);
      offset += 4;
      const metadataUri = decoder.decode(dataWithoutDiscriminator.slice(offset, offset + metadataUriLen));
      offset += metadataUriLen;

      // Read token_mint (Option<PublicKey> - 1 byte for Some/None + 32 bytes if Some)
      const hasTokenMint = dataWithoutDiscriminator[offset];
      offset += 1;
      const tokenMint = hasTokenMint ? new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32)) : null;
      if (hasTokenMint) offset += 32;

      // NEW FIELDS - May not exist in old markets, so handle gracefully
      let platformTokensAllocated = BigInt(0);
      let platformTokensClaimed = false;
      let yesVoterTokensAllocated = BigInt(0);
      let founderExcessSolAllocated = BigInt(0);
      let founderVestingInitialized = false;
      let bump = 0;

      // Check if there's enough data left for new fields (minimum 8 + 1 + 8 + 8 + 1 + 32 + 1 = 59 bytes)
      if (offset + 59 <= dataWithoutDiscriminator.length) {
        try {
          // Read platform_tokens_allocated (8 bytes - u64)
          platformTokensAllocated = dataWithoutDiscriminator.readBigUInt64LE(offset);
          offset += 8;

          // Read platform_tokens_claimed (1 byte - bool)
          platformTokensClaimed = dataWithoutDiscriminator[offset] !== 0;
          offset += 1;

          // Read yes_voter_tokens_allocated (8 bytes - u64)
          yesVoterTokensAllocated = dataWithoutDiscriminator.readBigUInt64LE(offset);
          offset += 8;

          // Read founder_excess_sol_allocated (8 bytes - u64)
          founderExcessSolAllocated = dataWithoutDiscriminator.readBigUInt64LE(offset);
          offset += 8;

          // Read founder_vesting_initialized (1 byte - bool)
          founderVestingInitialized = dataWithoutDiscriminator[offset] !== 0;
          offset += 1;

          // Read treasury (32 bytes - PublicKey)
          const treasury = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
          offset += 32;

          // Read bump (1 byte - u8)
          bump = dataWithoutDiscriminator[offset];
        } catch (e) {
          // Old market format - use defaults
          logger.info('Using defaults for new fields (old market format)', { marketAddress });
        }
      } else {
        // Old market format - use defaults
        logger.info('Old market format detected, using defaults for new fields', { marketAddress });
      }

      // Treasury and bump - for old markets, try to read treasury if available
      let treasury;
      if (offset + 33 <= dataWithoutDiscriminator.length) {
        treasury = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
      } else {
        // Default treasury to a placeholder
        treasury = PublicKey.default;
      }

      marketAccount = {
        founder,
        ipfsCid,
        targetPool,
        poolBalance,
        yesPool,
        noPool,
        totalYesShares,
        totalNoShares,
        expiryTime,
        phase: phaseByte, // 0=Prediction, 1=Funding
        resolution: resolutionByte, // 0=Unresolved, 1=YesWins, 2=NoWins, 3=Refund
        metadataUri,
        tokenMint,
        platformTokensAllocated,
        platformTokensClaimed,
        yesVoterTokensAllocated,
        founderExcessSolAllocated,
        founderVestingInitialized,
        treasury,
        bump,
      };

      logger.info('Market account deserialized successfully', { marketAddress });
    } catch (error) {
      logger.error('Failed to deserialize market account', { marketAddress, error });
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse market data',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    logger.info('On-chain market data fetched', {
      marketAddress,
      phase: marketAccount.phase,
      resolution: marketAccount.resolution,
      poolBalance: marketAccount.poolBalance.toString(),
    });

    // Check if team_vesting PDA exists (indicates team vesting has been initialized)
    let teamVestingInitialized = false;
    try {
      const [teamVestingPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('team_vesting'), marketPubkey.toBytes()],
        PROGRAM_ID
      );
      const teamVestingAccount = await connection.getAccountInfo(teamVestingPda);
      teamVestingInitialized = teamVestingAccount !== null;
      logger.info('Team vesting PDA check', {
        teamVestingPda: teamVestingPda.toBase58(),
        exists: teamVestingInitialized
      });
    } catch (error) {
      logger.warn('Failed to check team vesting PDA', { error });
    }

    // Convert phase enum byte to string
    // 0=Prediction, 1=Funding
    let phaseStatus: 'Prediction' | 'Funding';
    switch (marketAccount.phase) {
      case 0:
        phaseStatus = 'Prediction';
        break;
      case 1:
        phaseStatus = 'Funding';
        break;
      default:
        phaseStatus = 'Prediction';
    }

    // Convert resolution enum byte to string
    // 0=Unresolved, 1=YesWins, 2=NoWins, 3=Refund
    let resolutionStatus: 'Unresolved' | 'YesWins' | 'NoWins' | 'Refund';
    switch (marketAccount.resolution) {
      case 0:
        resolutionStatus = 'Unresolved';
        break;
      case 1:
        resolutionStatus = 'YesWins';
        break;
      case 2:
        resolutionStatus = 'NoWins';
        break;
      case 3:
        resolutionStatus = 'Refund';
        break;
      default:
        resolutionStatus = 'Unresolved';
    }

    // Convert expiryTime from BigInt to number for calculations
    const expiryTimeNumber = Number(marketAccount.expiryTime);
    const currentTime = Math.floor(Date.now() / 1000);

    logger.info('Expiry time comparison', {
      expiryTimeNumber,
      currentTime,
      isExpired: currentTime >= expiryTimeNumber,
      timeUntilExpiry: expiryTimeNumber - currentTime,
    });

    const onchainData = {
      founder: marketAccount.founder.toBase58(),
      ipfsCid: marketAccount.ipfsCid,
      targetPool: marketAccount.targetPool.toString(),
      poolBalance: marketAccount.poolBalance.toString(),
      yesPool: marketAccount.yesPool.toString(),
      noPool: marketAccount.noPool.toString(),
      totalYesShares: marketAccount.totalYesShares.toString(),
      totalNoShares: marketAccount.totalNoShares.toString(),
      expiryTime: expiryTimeNumber.toString(),
      phase: phaseStatus,
      resolution: resolutionStatus,
      metadataUri: marketAccount.metadataUri,
      tokenMint: marketAccount.tokenMint ? marketAccount.tokenMint.toBase58() : null,
      platformTokensAllocated: marketAccount.platformTokensAllocated.toString(),
      platformTokensClaimed: marketAccount.platformTokensClaimed,
      yesVoterTokensAllocated: marketAccount.yesVoterTokensAllocated.toString(),
      founderExcessSolAllocated: marketAccount.founderExcessSolAllocated.toString(),
      founderVestingInitialized: marketAccount.founderVestingInitialized,
      treasury: marketAccount.treasury.toBase58(),
      bump: marketAccount.bump,

      // Calculated fields
      poolProgressPercentage: Math.min(
        100,
        Math.floor(
          (Number(marketAccount.poolBalance) / Number(marketAccount.targetPool)) * 100
        )
      ),
      isExpired: currentTime >= expiryTimeNumber,
      isResolved: resolutionStatus !== 'Unresolved',
      // Founder SOL vesting - calculated from excess SOL
      hasExcessSol: Number(marketAccount.founderExcessSolAllocated) > 0,
      excessSolInSol: Number(marketAccount.founderExcessSolAllocated) / 1_000_000_000,
      // Team vesting - separate PDA check
      teamVestingInitialized,
    };

    return NextResponse.json(
      {
        success: true,
        data: onchainData,
      },
      {
        headers: {
          // Cache for 10 seconds, serve stale for 20 seconds while revalidating
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
        },
      }
    );

  } catch (error) {
    logger.error('Failed to fetch on-chain market data:', error as any);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch on-chain market data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
