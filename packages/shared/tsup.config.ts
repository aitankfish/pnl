import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'config/index': 'src/config/index.ts',
    'solana/index': 'src/solana/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    'types/index': 'src/types/index.ts',
    'services/index': 'src/services/index.ts',
    'contexts/index': 'src/contexts/index.tsx',
    'utils/index': 'src/utils/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: false, // Disabled: consuming apps use transpilePackages to resolve types from src
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@privy-io/react-auth',
    '@privy-io/react-auth/solana',
    '@solana/web3.js',
    '@solana/spl-token',
    '@coral-xyz/anchor',
    '@pump-fun/pump-sdk',
    'socket.io-client',
    'swr',
    'crypto',
    'buffer',
  ],
  treeshake: true,
});
