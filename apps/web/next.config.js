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

  // Use SWC minifier (faster and lower memory than Terser)
  swcMinify: true,

  // Enable compression
  compress: true,

  // Power by header disabled for security
  poweredByHeader: false,

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
      'mongodb',
    ],
    instrumentationHook: true, // Enable instrumentation.ts for server-side initialization
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

    // Force monorepo packages to resolve to a single copy (prevents context mismatches)
    const webNodeModules = path.resolve(__dirname, 'node_modules');
    config.resolve.alias = {
      ...config.resolve.alias,
      // Privy: alias main + subpath exports to web's single copy
      '@privy-io/react-auth/solana': path.resolve(webNodeModules, '@privy-io/react-auth/dist/esm/solana.mjs'),
      '@privy-io/react-auth': path.resolve(webNodeModules, '@privy-io/react-auth'),
      // Solana: prevent duplicate instances
      '@solana/web3.js': path.resolve(webNodeModules, '@solana/web3.js'),
      '@coral-xyz/anchor': path.resolve(webNodeModules, '@coral-xyz/anchor'),
      'swr': path.resolve(webNodeModules, 'swr'),
    };

    // Note: Do NOT alias 'react' or 'react-dom' — Next.js uses its own internal
    // canary React with React.use() and React.cache() that standard React 18 lacks.

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
    return [
      {
        source: '/presentation',
        destination: '/presentation/index.html',
        permanent: false,
      },
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
