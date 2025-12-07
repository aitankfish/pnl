/**
 * Verify Pump.fun PDA Derivations
 *
 * This script verifies that our PDA derivations match what Pump.fun expects
 * based on the error message we received.
 */

import { PublicKey } from '@solana/web3.js';
import {
  userVolumeAccumulatorPda,
  creatorVaultPda,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  PUMP_FEE_CONFIG_PDA,
} from '@pump-fun/pump-sdk';

console.log('═══════════════════════════════════════════════════');
console.log('🔍 PUMP.FUN PDA VERIFICATION');
console.log('═══════════════════════════════════════════════════');
console.log('');

// From your actual transaction attempt
const marketPubkey = new PublicKey('FEtwfas8LAGPns7yHJCXv4ovybGhzn5N8FPJR8ui7bD7');
const founderPubkey = new PublicKey('7iyZKvd28ZcfVKUxeezwSkvdoQ9sN1D7pEGe42w8yTkZ');
const creatorPubkey = new PublicKey('7iyZKvd28ZcfVKUxeezwSkvdoQ9sN1D7pEGe42w8yTkZ'); // Same as founder

console.log('📋 Input addresses:');
console.log(`   Market:  ${marketPubkey.toBase58()}`);
console.log(`   Founder: ${founderPubkey.toBase58()}`);
console.log(`   Creator: ${creatorPubkey.toBase58()}`);
console.log('');

console.log('🔧 Deriving PDAs...');
console.log('');

// Global PDAs (same for everyone)
const globalVolumeAccumulator = GLOBAL_VOLUME_ACCUMULATOR_PDA;
const feeConfig = PUMP_FEE_CONFIG_PDA;

console.log('✅ Global PDAs:');
console.log(`   global_volume_accumulator: ${globalVolumeAccumulator.toBase58()}`);
console.log(`   fee_config:                ${feeConfig.toBase58()}`);
console.log('');

// User-specific PDAs
const creatorVault = creatorVaultPda(creatorPubkey);
const userVolumeAccumulator_market = userVolumeAccumulatorPda(marketPubkey);
const userVolumeAccumulator_founder = userVolumeAccumulatorPda(founderPubkey);

console.log('✅ Creator-specific PDAs:');
console.log(`   creator_vault: ${creatorVault.toBase58()}`);
console.log('');

console.log('🔍 User Volume Accumulator (CRITICAL):');
console.log(`   From market PDA:   ${userVolumeAccumulator_market.toBase58()}`);
console.log(`   From founder/caller: ${userVolumeAccumulator_founder.toBase58()}`);
console.log('');

console.log('═══════════════════════════════════════════════════');
console.log('📊 ERROR ANALYSIS FROM PREVIOUS ATTEMPT:');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log('Error: ConstraintSeeds violation on user_volume_accumulator');
console.log('   Left (Expected by Pump.fun): 9oRJY24UiSatsSXEmYQpmvgJGkpvN1ahfwCnUHCoLD9Z');
console.log('   Right (What we provided):    8CoWghe2MyyJRfVfTytkWvz1LTAxCaVnescJQ2YsJn91');
console.log('');

// Verify which matches
const expectedPDA = '9oRJY24UiSatsSXEmYQpmvgJGkpvN1ahfwCnUHCoLD9Z';
const providedPDA = '8CoWghe2MyyJRfVfTytkWvz1LTAxCaVnescJQ2YsJn91';

const matchesExpected_market = userVolumeAccumulator_market.toBase58() === expectedPDA;
const matchesExpected_founder = userVolumeAccumulator_founder.toBase58() === expectedPDA;
const matchesProvided_market = userVolumeAccumulator_market.toBase58() === providedPDA;
const matchesProvided_founder = userVolumeAccumulator_founder.toBase58() === providedPDA;

console.log('🔎 Matching results:');
console.log(`   userVolumeAccumulator(market) == Expected?   ${matchesExpected_market ? '✅ YES' : '❌ NO'}`);
console.log(`   userVolumeAccumulator(founder) == Expected?  ${matchesExpected_founder ? '✅ YES' : '❌ NO'}`);
console.log(`   userVolumeAccumulator(market) == Provided?   ${matchesProvided_market ? '✅ YES' : '❌ NO'}`);
console.log(`   userVolumeAccumulator(founder) == Provided?  ${matchesProvided_founder ? '✅ YES' : '❌ NO'}`);
console.log('');

console.log('═══════════════════════════════════════════════════');
console.log('✅ CONCLUSION:');
console.log('═══════════════════════════════════════════════════');
console.log('');

if (matchesExpected_founder) {
  console.log('✅ CORRECT: Use userVolumeAccumulatorPda(callerPubkey)');
  console.log('   Pump.fun expects volume tracking for the CALLER/FOUNDER,');
  console.log('   not the market PDA, even though market PDA signs the buy().');
  console.log('');
  console.log('   Backend should use:');
  console.log('   const userVolumeAccumulator = userVolumeAccumulatorPda(callerPubkey);');
} else if (matchesExpected_market) {
  console.log('❌ INCORRECT: Should NOT use marketPubkey');
  console.log('   This would cause ConstraintSeeds error!');
  console.log('');
  console.log('   Current backend is WRONG:');
  console.log('   const userVolumeAccumulator = userVolumeAccumulatorPda(marketPubkey);');
} else {
  console.log('⚠️  UNEXPECTED: Neither derivation matches!');
  console.log('   This suggests a different issue.');
}

console.log('');
console.log('═══════════════════════════════════════════════════');
