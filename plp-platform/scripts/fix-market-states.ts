/**
 * Fix marketState for resolved markets
 *
 * Updates marketState to 1 (Resolved) for all markets that have
 * resolution !== 'Unresolved' but marketState is still 0 (Active)
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { connectToDatabase, PredictionMarket } from '../src/lib/mongodb';

async function fixMarketStates() {
  console.log('🔧 Fixing marketState for resolved markets...\n');

  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Find all markets that are resolved but still have marketState = 0
    const brokenMarkets = await PredictionMarket.find({
      marketState: 0, // Active
      resolution: { $ne: 'Unresolved' } // But resolved
    });

    console.log(`Found ${brokenMarkets.length} markets with incorrect marketState\n`);

    if (brokenMarkets.length === 0) {
      console.log('✅ No markets to fix!');
      process.exit(0);
    }

    // Update each market
    for (const market of brokenMarkets) {
      console.log(`Fixing market: ${market.marketName}`);
      console.log(`  Address: ${market.marketAddress}`);
      console.log(`  Resolution: ${market.resolution}`);
      console.log(`  Current marketState: ${market.marketState}`);

      await PredictionMarket.updateOne(
        { _id: market._id },
        {
          $set: {
            marketState: 1, // Set to Resolved
          }
        }
      );

      console.log(`  ✅ Updated marketState to 1 (Resolved)\n`);
    }

    console.log(`\n✅ Fixed ${brokenMarkets.length} markets!`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing market states:', error);
    process.exit(1);
  }
}

fixMarketStates();
