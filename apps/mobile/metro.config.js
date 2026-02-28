const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const emptyModule = path.resolve(projectRoot, 'shims/empty.js');
const privyShim = path.resolve(projectRoot, 'shims/privy-react-auth.js');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro resolve packages from the monorepo root and project
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// pnpm uses symlinks — Metro needs to follow them
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Pre-resolve real paths at startup (follows pnpm symlinks)
const realPaths = {
  react: fs.realpathSync(require.resolve('react')),
  'react/jsx-runtime': fs.realpathSync(require.resolve('react/jsx-runtime')),
  'react/jsx-dev-runtime': fs.realpathSync(require.resolve('react/jsx-dev-runtime')),
};

// Polyfill/shim Node core modules for React Native
config.resolver.extraNodeModules = {
  crypto: require.resolve('expo-crypto'),
  stream: require.resolve('readable-stream'),
  debug: emptyModule, // mediasoup-client uses debug — shim it out
  zlib: emptyModule,
  util: emptyModule,
  http: emptyModule,
  https: emptyModule,
  net: emptyModule,
  tls: emptyModule,
  fs: emptyModule,
  os: emptyModule,
  path: emptyModule,
  ...config.resolver.extraNodeModules,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force jose to use its browser build (avoids Node crypto/zlib imports)
  if (moduleName === 'jose') {
    const joseBase = path.dirname(require.resolve('jose/package.json'));
    return { type: 'sourceFile', filePath: path.join(joseBase, 'dist/browser/index.js') };
  }

  // Redirect @privy-io/react-auth AND all subpaths (e.g. /solana) to a mobile-safe shim
  // Mobile uses @privy-io/expo instead — react-auth is web-only and crashes on RN
  if (moduleName === '@privy-io/react-auth' || moduleName.startsWith('@privy-io/react-auth/')) {
    return { type: 'sourceFile', filePath: privyShim };
  }

  // Deduplicate React — force ALL react imports to mobile app's single copy (React 19)
  // This prevents the monorepo root's React 18 from being loaded
  if (realPaths[moduleName]) {
    return { type: 'sourceFile', filePath: realPaths[moduleName] };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
