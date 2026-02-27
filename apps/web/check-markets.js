require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
const dbName = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
  ? process.env.MONGODB_PROD_DATABASE
  : process.env.MONGODB_DEV_DATABASE;

console.log('Connecting to database:', dbName);

mongoose.connect(MONGODB_URI, { dbName }).then(async () => {
  const PredictionMarket = mongoose.model('PredictionMarket', new mongoose.Schema({}, { strict: false }), 'predictionmarkets');
  const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');

  const markets = await PredictionMarket.find({}).populate('projectId').select('marketAddress marketState resolution phase projectId').lean();

  console.log('\n========================================');
  console.log('Total markets in database:', markets.length);
  console.log('========================================\n');

  markets.forEach((m, i) => {
    console.log(`${i+1}. Market: ${m.projectId?.name || 'Unknown'}`);
    console.log(`   Address: ${m.marketAddress?.slice(0, 12)}...`);
    console.log(`   marketState: ${m.marketState} ${m.marketState === 0 ? '(Active ✅)' : m.marketState === 1 ? '(Resolved ❌)' : '(Canceled ❌)'}`);
    console.log(`   resolution: ${m.resolution || 'Unresolved'}`);
    console.log(`   phase: ${m.phase} ${m.phase === 0 ? '(Prediction)' : m.phase === 1 ? '(Funding)' : ''}`);
    console.log('');
  });

  const activeMarkets = markets.filter(m => m.marketState === 0);
  console.log('========================================');
  console.log('Markets with marketState=0 (Active):', activeMarkets.length);
  console.log('These are the ones shown on /browse');
  console.log('========================================\n');

  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
