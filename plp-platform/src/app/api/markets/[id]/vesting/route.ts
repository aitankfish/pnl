/**
 * API endpoint to fetch vesting data for a market
 *
 * This is a lightweight endpoint that ONLY fetches vesting PDA data from blockchain.
 * Used only by founders to check their token/SOL vesting status.
 *
 * Main market data comes from MongoDB (synced via WebSocket) - no need for RPC calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Connection } from '@solana/web3.js';
import { createClientLogger } from '@/lib/logger';
import { SOLANA_NETWORK, PROGRAM_ID } from '@/config/solana';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketAddress } = await params;

    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Market address required' },
        { status: 400 }
      );
    }

    // Get network from query parameter
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network = (networkParam as 'mainnet-beta' | 'devnet' | null) || SOLANA_NETWORK;

    logger.info('Fetching vesting data', { marketAddress, network });

    // Convert address to PublicKey
    let marketPubkey;
    try {
      marketPubkey = new PublicKey(marketAddress);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid market address format' },
        { status: 400 }
      );
    }

    // Get RPC endpoint
    const heliusApiKey = process.env.HELIUS_API_KEY;
    if (!heliusApiKey) {
      return NextResponse.json(
        { success: false, error: 'RPC not configured' },
        { status: 500 }
      );
    }

    const rpcEndpoint = network === 'devnet'
      ? `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

    const connection = new Connection(rpcEndpoint, { commitment: 'confirmed' });

    // Fetch team_vesting PDA
    let teamVestingInitialized = false;
    let teamVestingData: any = null;

    try {
      const [teamVestingPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('team_vesting'), marketPubkey.toBytes()],
        PROGRAM_ID
      );
      const teamVestingAccount = await connection.getAccountInfo(teamVestingPda);
      teamVestingInitialized = teamVestingAccount !== null;

      if (teamVestingAccount && teamVestingAccount.data) {
        // Parse team_vesting account data
        const data = teamVestingAccount.data.slice(8); // Skip discriminator
        let offset = 96; // Skip market, team_wallet, token_mint

        const totalTokens = data.readBigUInt64LE(offset);
        offset += 8;
        const immediateTokens = data.readBigUInt64LE(offset);
        offset += 8;
        const vestingTokens = data.readBigUInt64LE(offset);
        offset += 8;
        const claimedTokens = data.readBigUInt64LE(offset);
        offset += 8;
        const immediateClaimed = data[offset] !== 0;
        offset += 1;
        const vestingStart = Number(data.readBigInt64LE(offset));
        offset += 8;
        const vestingDuration = Number(data.readBigInt64LE(offset));

        // Calculate vesting progress
        const currentTime = Math.floor(Date.now() / 1000);
        const elapsed = Math.max(0, currentTime - vestingStart);
        const vestingProgressPercent = Math.min(100, Math.floor((elapsed / vestingDuration) * 100));

        // Calculate unlocked vested tokens
        let vestedUnlocked = BigInt(0);
        if (elapsed >= vestingDuration) {
          vestedUnlocked = vestingTokens;
        } else if (elapsed > 0) {
          vestedUnlocked = (vestingTokens * BigInt(elapsed)) / BigInt(vestingDuration);
        }

        // Calculate claimable now
        let claimableNow = BigInt(0);
        if (!immediateClaimed) {
          claimableNow += immediateTokens;
        }
        const immediateSubtract = immediateClaimed ? immediateTokens : BigInt(0);
        const vestedAlreadyClaimed = claimedTokens > immediateSubtract
          ? claimedTokens - immediateSubtract
          : BigInt(0);
        const claimableVested = vestedUnlocked > vestedAlreadyClaimed
          ? vestedUnlocked - vestedAlreadyClaimed
          : BigInt(0);
        claimableNow += claimableVested;

        // Calculate next unlock
        const monthlyUnlock = vestingTokens / BigInt(12);
        const monthsElapsed = Math.floor(elapsed / (vestingDuration / 12));
        const nextUnlockTime = vestingStart + ((monthsElapsed + 1) * (vestingDuration / 12));
        const isVestingComplete = elapsed >= vestingDuration;

        teamVestingData = {
          totalTokens: totalTokens.toString(),
          immediateTokens: immediateTokens.toString(),
          vestingTokens: vestingTokens.toString(),
          claimedTokens: claimedTokens.toString(),
          immediateClaimed,
          vestingStart,
          vestingDuration,
          claimableNow: claimableNow.toString(),
          vestedUnlocked: vestedUnlocked.toString(),
          vestingProgressPercent,
          nextUnlockAmount: monthlyUnlock.toString(),
          nextUnlockTime: isVestingComplete ? null : nextUnlockTime,
        };
      }
    } catch (error) {
      logger.warn('Failed to fetch team vesting PDA', { error });
    }

    // Fetch founder_vesting PDA
    let founderVestingInitialized = false;
    let founderVestingData: any = null;

    try {
      const [founderVestingPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('founder_vesting'), marketPubkey.toBytes()],
        PROGRAM_ID
      );
      const founderVestingAccount = await connection.getAccountInfo(founderVestingPda);
      founderVestingInitialized = founderVestingAccount !== null;

      if (founderVestingAccount && founderVestingAccount.data) {
        // Parse founder_vesting account data
        const data = founderVestingAccount.data.slice(8); // Skip discriminator
        let offset = 64; // Skip market, founder

        const totalSol = data.readBigUInt64LE(offset);
        offset += 8;
        const immediateSol = data.readBigUInt64LE(offset);
        offset += 8;
        const vestingSol = data.readBigUInt64LE(offset);
        offset += 8;
        const claimedSol = data.readBigUInt64LE(offset);
        offset += 8;
        const immediateClaimed = data[offset] !== 0;
        offset += 1;
        const vestingStart = Number(data.readBigInt64LE(offset));
        offset += 8;
        const vestingDuration = Number(data.readBigInt64LE(offset));

        // Calculate vesting progress
        const currentTime = Math.floor(Date.now() / 1000);
        const elapsed = Math.max(0, currentTime - vestingStart);
        const vestingProgressPercent = Math.min(100, Math.floor((elapsed / vestingDuration) * 100));

        // Calculate unlocked vested SOL
        let vestedUnlocked = BigInt(0);
        if (elapsed >= vestingDuration) {
          vestedUnlocked = vestingSol;
        } else if (elapsed > 0) {
          vestedUnlocked = (vestingSol * BigInt(elapsed)) / BigInt(vestingDuration);
        }

        // Calculate claimable now
        let claimableNow = BigInt(0);
        if (!immediateClaimed) {
          claimableNow += immediateSol;
        }
        const immediateSubtract = immediateClaimed ? immediateSol : BigInt(0);
        const vestedAlreadyClaimed = claimedSol > immediateSubtract
          ? claimedSol - immediateSubtract
          : BigInt(0);
        const claimableVested = vestedUnlocked > vestedAlreadyClaimed
          ? vestedUnlocked - vestedAlreadyClaimed
          : BigInt(0);
        claimableNow += claimableVested;

        // Calculate next unlock
        const monthlyUnlock = vestingSol / BigInt(12);
        const monthsElapsed = Math.floor(elapsed / (vestingDuration / 12));
        const nextUnlockTime = vestingStart + ((monthsElapsed + 1) * (vestingDuration / 12));
        const isVestingComplete = elapsed >= vestingDuration;

        founderVestingData = {
          totalSol: totalSol.toString(),
          immediateSol: immediateSol.toString(),
          vestingSol: vestingSol.toString(),
          claimedSol: claimedSol.toString(),
          immediateClaimed,
          vestingStart,
          vestingDuration,
          claimableNow: claimableNow.toString(),
          vestedUnlocked: vestedUnlocked.toString(),
          vestingProgressPercent,
          nextUnlockAmount: monthlyUnlock.toString(),
          nextUnlockTime: isVestingComplete ? null : nextUnlockTime,
        };

        founderVestingInitialized = true;
      }
    } catch (error) {
      logger.warn('Failed to fetch founder vesting PDA', { error });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          teamVestingInitialized,
          teamVestingData,
          founderVestingInitialized,
          founderVestingData,
        },
      },
      {
        headers: {
          // Cache for 30 seconds - vesting data changes infrequently
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );

  } catch (error) {
    logger.error('Failed to fetch vesting data:', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vesting data' },
      { status: 500 }
    );
  }
}
