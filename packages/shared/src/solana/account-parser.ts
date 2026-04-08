/**
 * Account Parser (shared)
 * Deserializes market and position PDA account data from blockchain
 */

import { PublicKey } from '@solana/web3.js';
import { createClientLogger } from '../utils/logger';

const logger = createClientLogger();

export interface ParsedMarketAccount {
  founder: string;
  ipfsCid: string;
  targetPool: string;
  poolBalance: string;
  yesPool: string;
  noPool: string;
  totalYesShares: string;
  totalNoShares: string;
  expiryTime: string;
  phase: number;
  resolution: number;
  metadataUri: string;
  tokenMint: string | null;
  platformTokensAllocated: string;
  platformTokensClaimed: boolean;
  yesVoterTokensAllocated: string;
  founderExcessSolAllocated: string;
  founderVestingInitialized: boolean;
  distributionPool: string;
  treasury: string;
  bump: number;
}

export interface ParsedPositionAccount {
  user: string;
  market: string;
  yesShares: string;
  noShares: string;
  totalInvested: string;
  claimed: boolean;
  bump: number;
}

export function parseMarketAccount(base64Data: string): ParsedMarketAccount {
  try {
    const accountData = Buffer.from(base64Data, 'base64');
    const dataWithoutDiscriminator = accountData.slice(8);
    const decoder = new TextDecoder();
    let offset = 0;

    const founder = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
    offset += 32;

    const ipfsCidLen = dataWithoutDiscriminator.readUInt32LE(offset);
    offset += 4;
    const ipfsCid = decoder.decode(dataWithoutDiscriminator.slice(offset, offset + ipfsCidLen));
    offset += ipfsCidLen;

    const targetPool = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const poolBalance = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const distributionPool = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const yesPool = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const noPool = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const totalYesShares = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const totalNoShares = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const expiryTime = dataWithoutDiscriminator.readBigInt64LE(offset); offset += 8;

    const phaseByte = dataWithoutDiscriminator[offset]; offset += 1;
    const resolutionByte = dataWithoutDiscriminator[offset]; offset += 1;

    const metadataUriLen = dataWithoutDiscriminator.readUInt32LE(offset); offset += 4;
    const metadataUri = decoder.decode(dataWithoutDiscriminator.slice(offset, offset + metadataUriLen));
    offset += metadataUriLen;

    const hasTokenMint = dataWithoutDiscriminator[offset]; offset += 1;
    const tokenMint = hasTokenMint ? new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32)).toBase58() : null;
    if (hasTokenMint) offset += 32;

    const platformTokensAllocated = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const platformTokensClaimed = dataWithoutDiscriminator[offset] !== 0; offset += 1;
    const yesVoterTokensAllocated = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const founderExcessSolAllocated = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const founderVestingInitialized = dataWithoutDiscriminator[offset] !== 0; offset += 1;

    const treasury = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
    offset += 32;
    const bump = dataWithoutDiscriminator[offset];

    return {
      founder: founder.toBase58(), ipfsCid, targetPool: targetPool.toString(), poolBalance: poolBalance.toString(),
      distributionPool: distributionPool.toString(), yesPool: yesPool.toString(), noPool: noPool.toString(),
      totalYesShares: totalYesShares.toString(), totalNoShares: totalNoShares.toString(),
      expiryTime: expiryTime.toString(), phase: phaseByte, resolution: resolutionByte, metadataUri,
      tokenMint, platformTokensAllocated: platformTokensAllocated.toString(), platformTokensClaimed,
      yesVoterTokensAllocated: yesVoterTokensAllocated.toString(),
      founderExcessSolAllocated: founderExcessSolAllocated.toString(), founderVestingInitialized,
      treasury: treasury.toBase58(), bump,
    };
  } catch (error) {
    logger.error('Failed to parse market account:', error);
    throw error;
  }
}

export function parsePositionAccount(base64Data: string): ParsedPositionAccount {
  try {
    const accountData = Buffer.from(base64Data, 'base64');
    const dataWithoutDiscriminator = accountData.slice(8);
    let offset = 0;

    const user = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32)); offset += 32;
    const market = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32)); offset += 32;
    const yesShares = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const noShares = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const totalInvested = dataWithoutDiscriminator.readBigUInt64LE(offset); offset += 8;
    const claimed = dataWithoutDiscriminator[offset] !== 0; offset += 1;
    const bump = dataWithoutDiscriminator[offset];

    return {
      user: user.toBase58(), market: market.toBase58(),
      yesShares: yesShares.toString(), noShares: noShares.toString(),
      totalInvested: totalInvested.toString(), claimed, bump,
    };
  } catch (error) {
    logger.error('Failed to parse position account:', error);
    throw error;
  }
}

export function calculateDerivedFields(market: ParsedMarketAccount) {
  const poolBalance = BigInt(market.poolBalance);
  const targetPool = BigInt(market.targetPool);
  const totalYesShares = BigInt(market.totalYesShares);
  const totalNoShares = BigInt(market.totalNoShares);

  const poolProgressPercentage = targetPool > 0n ? Math.min(100, Number((poolBalance * 100n) / targetPool)) : 0;
  const totalShares = totalYesShares + totalNoShares;
  const sharesYesPercentage = totalShares > 0n ? Math.round(Number((totalYesShares * 100n) / totalShares)) : 50;
  const yesPercentage = sharesYesPercentage;

  const totalYesStake = Number(totalYesShares) / 1_000_000_000;
  const totalNoStake = Number(totalNoShares) / 1_000_000_000;

  const currentTime = Math.floor(Date.now() / 1000);
  const expiryTime = Number(market.expiryTime);
  const isExpired = currentTime >= expiryTime;
  const isResolved = market.resolution !== 0;

  const availableActions: string[] = [];
  if (!isResolved) {
    if (!isExpired && poolProgressPercentage < 100) availableActions.push('vote');
    if (isExpired || poolProgressPercentage >= 100) {
      availableActions.push('resolve');
      if (poolProgressPercentage >= 100 && sharesYesPercentage > 50) availableActions.push('extend');
    }
  }
  if (isResolved) availableActions.push('claim');

  return { poolProgressPercentage, yesPercentage, sharesYesPercentage, totalYesStake, totalNoStake, isExpired, isResolved, availableActions };
}
