/**
 * Vanity Address Generator for PLP Platform
 *
 * Generates token mint addresses ending with "pnl" to brand
 * tokens launched from the PLP platform.
 */

import { Keypair } from '@solana/web3.js';

interface VanityOptions {
  suffix?: string;
  maxAttempts?: number;
  onProgress?: (attempts: number, rate: number) => void;
}

/**
 * Generate a vanity keypair ending with "pnl"
 * This brands all tokens launched from PLP platform
 */
export function generateVanityKeypair(options: VanityOptions = {}): Keypair | null {
  const {
    suffix = 'pnl',
    maxAttempts = 10_000_000,
    onProgress,
  } = options;

  const targetSuffix = suffix.toLowerCase();

  let attempts = 0;
  const startTime = Date.now();

  console.log('🔍 Generating vanity address ending with "pnl"...');
  console.log(`   This brands the token as launched from PNL platform`);
  console.log(`   Estimated time: 10-60 seconds`);
  console.log('');

  const progressInterval = 100_000;
  let lastProgress = 0;

  while (attempts < maxAttempts) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const checkAddress = address.toLowerCase();

    // Show progress
    if (onProgress && attempts - lastProgress >= progressInterval) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(attempts / elapsed);
      onProgress(attempts, rate);
      lastProgress = attempts;
    }

    // Check if matches suffix
    if (checkAddress.endsWith(targetSuffix)) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const rate = Math.round(attempts / (Date.now() - startTime) * 1000);

      console.log('✅ Vanity address found!');
      console.log(`   Address: ${address}`);
      console.log(`   Attempts: ${attempts.toLocaleString()}`);
      console.log(`   Time: ${elapsed}s`);
      console.log(`   Rate: ${rate.toLocaleString()} addresses/second`);
      console.log('');

      return keypair;
    }

    attempts++;
  }

  console.log('❌ Max attempts reached without finding match');
  console.log(`   Tried ${attempts.toLocaleString()} addresses`);
  console.log('');

  return null;
}
