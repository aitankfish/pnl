const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile shared workspace package
  transpilePackages: ['@pnl/shared'],

  // Enable faster refresh
  
  reactStrictMode: true,

  // Disable ESLint during production builds (fix errors later)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript checks during production builds (fix errors later)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sapphire-fantastic-cephalopod-499.mypinata.cloud',
      },
    ],
    // Optimize image loading
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Standalone output for better deployment
  output: 'standalone',

  // Enable compression
  compress: true,

  // Power by header disabled for security
  poweredByHeader: false,

  // Disable source maps in production to reduce build memory
  productionBrowserSourceMaps: false,

  // Skip webpack bundling for server-only packages (major memory savings).
  // Promoted out of experimental in Next 15.
  serverExternalPackages: [
    'mongoose',
    'mongodb',
    'winston',
    'twitter-api-v2',
    'helius-sdk',
    '@pump-fun/pump-sdk',
    'ioredis',
    'socket.io',
  ],

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: [
      '@solana/web3.js',
      'lucide-react',
      '@privy-io/react-auth',
      '@solana/kit',
      '@coral-xyz/anchor',
      'framer-motion',
      'recharts',
    ],
    // Run webpack in a separate worker to reduce main process memory
    webpackBuildWorker: true,
  },

  // Webpack configuration
  webpack: (config, { isServer, dev }) => {
    // Don't bundle winston and node-only modules on the client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };

      // Ignore winston on the client — resolve to empty module instead of throwing
      config.resolve.alias['winston'] = false;
    }

    // Force monorepo packages to resolve to a single copy (prevents context mismatches).
    // Use require.resolve so this works regardless of pnpm hoist layout (local vs CI).
    const resolvePkg = (name) => {
      try {
        return path.dirname(require.resolve(`${name}/package.json`, { paths: [__dirname] }));
      } catch {
        return null;
      }
    };
    const privyRoot = resolvePkg('@privy-io/react-auth');
    const swrRoot = resolvePkg('swr');
    const web3Root = resolvePkg('@solana/web3.js');
    const anchorRoot = resolvePkg('@coral-xyz/anchor');
    config.resolve.alias = {
      ...config.resolve.alias,
      ...(privyRoot && {
        '@privy-io/react-auth/solana': path.join(privyRoot, 'dist/esm/solana.mjs'),
        '@privy-io/react-auth': privyRoot,
      }),
      ...(swrRoot && { 'swr': swrRoot }),
      ...(web3Root && { '@solana/web3.js': web3Root }),
      ...(anchorRoot && { '@coral-xyz/anchor': anchorRoot }),
    };

    // Note: Do NOT alias 'react' or 'react-dom'. Next 15's client runtime
    // expects to resolve its own React with internal hooks (React.use etc.);
    // forcing an alias triggers "React.use is not a function". The R3F
    // "ReactCurrentBatchConfig is undefined" crash that previously
    // motivated aliasing here was the real fix: upgrade React 18 → 19 and
    // R3F 8 → 9. With both aligned, no alias needed.

    // Production optimizations
    if (!dev) {
      // Enable tree shaking
      config.optimization = config.optimization || {};
      config.optimization.usedExports = true;
      config.optimization.sideEffects = true;
    }

    return config;
  },

  // Redirects
  async redirects() {
    // Mintlify docs migration. Set DOCS_REDIRECTS_ENABLED=true in the deploy
    // environment once docs.pnl.market is live and DNS resolves. Until then
    // the legacy Next.js pages (whitepaper, how-to-buy, privacy, terms) keep
    // serving so users don't hit broken links. After flip, 301s send traffic
    // to the Mintlify-hosted docs and search engines update their indexes.
    const docsRedirectsEnabled = process.env.DOCS_REDIRECTS_ENABLED === 'true';
    const docsRedirects = docsRedirectsEnabled
      ? [
          { source: '/whitepaper',        destination: 'https://docs.pnl.market/whitepaper',        permanent: true },
          { source: '/whitepaper/:path*', destination: 'https://docs.pnl.market/whitepaper/:path*', permanent: true },
          { source: '/how-to-buy',        destination: 'https://docs.pnl.market/how-to-buy',        permanent: true },
          { source: '/privacy',           destination: 'https://docs.pnl.market/legal/privacy',     permanent: true },
          { source: '/terms',             destination: 'https://docs.pnl.market/legal/terms',       permanent: true },
        ]
      : [];

    return [
      {
        source: '/presentation',
        destination: '/presentation/index.html',
        permanent: false,
      },
      ...docsRedirects,
    ];
  },

  // Headers for better caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
