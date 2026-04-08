/**
 * API endpoint to check market status directly from blockchain
 * Used as fallback when database update fails
 * Updated: Fixed byte offset parsing to match onchain route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress } = body;

    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing marketAddress' },
        { status: 400 }
      );
    }

    logger.info('Checking on-chain market status', { marketAddress });

    const connection = await getSolanaConnection();
    const marketPubkey = new PublicKey(marketAddress);

    // Fetch market account info directly from blockchain
    const accountInfo = await connection.getAccountInfo(marketPubkey);

    if (!accountInfo) {
      return NextResponse.json(
        { success: false, error: 'Market account not found on-chain' },
        { status: 404 }
      );
    }

    // Manually deserialize the account data - use exact same logic as onchain route
    const accountData = accountInfo.data;
    const dataWithoutDiscriminator = accountData.slice(8);
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
    const tokenMint = hasTokenMint ? new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32)).toString() : null;
    if (hasTokenMint) offset += 32;

    // Determine resolution status
    let resolution = 'Unresolved';
    if (resolutionByte === 1) {
      resolution = 'YesWins';
    } else if (resolutionByte === 2) {
      resolution = 'NoWins';
    } else if (resolutionByte === 3) {
      resolution = 'Refund';
    }

    const isResolved = resolutionByte !== 0;

    logger.info('On-chain market status checked', {
      marketAddress,
      resolution,
      isResolved,
      resolutionByte,
      phase: phaseByte,
    });

    return NextResponse.json({
      success: true,
      data: {
        isResolved,
        resolution,
        resolutionByte,
        phase: phaseByte,
        tokenMint,
      },
    });

  } catch (error) {
    logger.error('Failed to check on-chain market status:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check on-chain market status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
