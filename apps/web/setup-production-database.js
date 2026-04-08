/**
 * Setup Production Database
 * Creates plp_platform_prod database with all collections and indexes
 * This prepares the database structure for mainnet deployment
 */

const { MongoClient } = require('mongodb');

require('dotenv').config({ path: '.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const PROD_DB_NAME = 'plp_platform_prod';

// Collection names matching models.ts
const COLLECTIONS = {
  PROJECTS: 'projects',
  PREDICTION_MARKETS: 'predictionmarkets',
  PREDICTION_PARTICIPANTS: 'predictionparticipants',
  USER_PROFILES: 'user_profiles',
  TRADE_HISTORY: 'trade_history',
  MARKET_TIME_SERIES: 'market_time_series',
  NOTIFICATIONS: 'notifications',
};

// Indexes matching models.ts
const INDEXES = {
  projects: [
    { key: { founderWallet: 1 } },
    { key: { status: 1 } },
    { key: { createdAt: -1 } },
    { key: { category: 1 } },
  ],
  predictionmarkets: [
    { key: { marketAddress: 1 }, unique: true },
    { key: { projectId: 1 } },
    { key: { marketState: 1 } },
    { key: { expiryTime: 1 } },
    { key: { marketState: 1, createdAt: -1 } }, // Compound index
  ],
  predictionparticipants: [
    { key: { marketId: 1, participantWallet: 1, voteOption: 1 }, unique: true },
    { key: { participantWallet: 1 } },
    { key: { marketId: 1 } },
  ],
  user_profiles: [
    { key: { walletAddress: 1 }, unique: true },
    { key: { reputationScore: -1 } },
  ],
  trade_history: [
    { key: { walletAddress: 1 } },
    { key: { marketId: 1 } },
    { key: { createdAt: -1 } },
  ],
  market_time_series: [
    { key: { marketId: 1, timestamp: -1 } },
  ],
  notifications: [
    { key: { userId: 1, createdAt: -1 } },
    { key: { userId: 1, isRead: 1 } },
  ],
};

async function setupProductionDatabase() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('\n🚀 Setting Up Production Database');
    console.log('='.repeat(80));
    console.log(`Database: ${PROD_DB_NAME}\n`);

    const db = client.db(PROD_DB_NAME);

    // Check if database already exists
    const adminDb = client.db('admin');
    const databases = await adminDb.admin().listDatabases();
    const dbExists = databases.databases.some(d => d.name === PROD_DB_NAME);

    if (dbExists) {
      console.log(`⚠️  Database "${PROD_DB_NAME}" already exists`);
      const collections = await db.listCollections().toArray();
      console.log(`   Existing collections: ${collections.length}`);
      console.log('\nProceed with setup anyway? This will create missing collections and indexes.\n');
    }

    // Create collections
    console.log('📦 Creating Collections:');
    console.log('-'.repeat(80));

    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      try {
        // Check if collection exists
        const collections = await db.listCollections({ name: collectionName }).toArray();

        if (collections.length > 0) {
          console.log(`  ✓ ${collectionName.padEnd(30)} (already exists)`);
        } else {
          // Create collection
          await db.createCollection(collectionName);
          console.log(`  ✓ ${collectionName.padEnd(30)} (created)`);
        }
      } catch (error) {
        console.error(`  ✗ ${collectionName.padEnd(30)} Error: ${error.message}`);
      }
    }

    // Create indexes
    console.log('\n🔍 Creating Indexes:');
    console.log('-'.repeat(80));

    for (const [collectionName, indexes] of Object.entries(INDEXES)) {
      if (indexes.length === 0) {
        console.log(`  ⊘ ${collectionName.padEnd(30)} (no indexes)`);
        continue;
      }

      try {
        const collection = db.collection(collectionName);

        for (const indexSpec of indexes) {
          try {
            const options = {};
            if (indexSpec.unique) {
              options.unique = true;
            }

            await collection.createIndex(indexSpec.key, options);
          } catch (error) {
            // Index might already exist, that's okay
            if (!error.message.includes('already exists')) {
              throw error;
            }
          }
        }

        console.log(`  ✓ ${collectionName.padEnd(30)} (${indexes.length} indexes)`);
      } catch (error) {
        console.error(`  ✗ ${collectionName.padEnd(30)} Error: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ Production Database Setup Complete!\n');

    console.log('📊 Database Summary:');
    console.log('-'.repeat(80));
    const collections = await db.listCollections().toArray();

    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      const indexes = await db.collection(coll.name).indexes();
      console.log(`  ${coll.name.padEnd(30)} ${count} docs, ${indexes.length} indexes`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 Next Steps:');
    console.log('  1. When ready for mainnet, set: NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta');
    console.log('  2. Deploy your application');
    console.log('  3. Database will automatically be used for mainnet data\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
  }
}

setupProductionDatabase();
