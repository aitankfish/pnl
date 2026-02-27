const { PublicKey, Connection } = require('@solana/web3.js');

const marketAddress = '2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX';
const programId = 'C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86';

(async () => {
  console.log('Debugging market resolution for:', marketAddress);
  console.log('Program ID:', programId);

  // Derive market_vault PDA
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('market_vault'), new PublicKey(marketAddress).toBuffer()],
    new PublicKey(programId)
  );

  console.log('\nMarket Vault PDA:', vaultPda.toBase58());
  console.log('Vault Bump:', vaultBump);

  // Connect to mainnet
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // Get account info
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  const marketInfo = await connection.getAccountInfo(new PublicKey(marketAddress));

  console.log('\n=== Market Vault Account ===');
  if (vaultInfo) {
    console.log('Owner:', vaultInfo.owner.toBase58());
    console.log('Lamports:', vaultInfo.lamports);
    console.log('Data length:', vaultInfo.data.length);
    console.log('Executable:', vaultInfo.executable);
    console.log('✅ Account exists');

    if (vaultInfo.owner.toBase58() === '11111111111111111111111111111111') {
      console.log('✅ Owned by System Program');
    } else {
      console.log('❌ NOT owned by System Program!');
      console.log('   Actual owner:', vaultInfo.owner.toBase58());
    }
  } else {
    console.log('❌ Account does NOT exist');
  }

  console.log('\n=== Market Account ===');
  if (marketInfo) {
    console.log('Owner:', marketInfo.owner.toBase58());
    console.log('Lamports:', marketInfo.lamports);
    console.log('Data length:', marketInfo.data.length);

    if (marketInfo.owner.toBase58() === programId) {
      console.log('✅ Owned by PLP Program');
    } else {
      console.log('❌ NOT owned by PLP Program!');
    }

    // Try to decode market data (basic check)
    console.log('\nFirst 100 bytes (hex):', marketInfo.data.slice(0, 100).toString('hex'));
  } else {
    console.log('❌ Market account does NOT exist');
  }
})();
