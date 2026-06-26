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
      // The shareable researcher-invite link. The static page lives at
      // /research-invite/index.html; without these, the clean URLs 404.
      {
        source: '/research-invite',
        destination: '/research-invite/index.html',
        permanent: false,
      },
      {
        source: '/research-invite/',
        destination: '/research-invite/index.html',
        permanent: false,
      },
      ...docsRedirects,
    ];
  },

  // Headers for better caching
  async headers() {
    // CORS allow-list. Browser cross-origin reads are only permitted from
    // these origins; the matching Origin is echoed back. Native apps (Expo)
    // and server-to-server callers send no Origin header and are unaffected
    // — this only constrains browser JS on other sites.
    const ALLOWED_ORIGIN =
      '(?<origin>https://(www\\.)?pnl\\.market|https://docs\\.pnl\\.market|http://localhost:\\d+)';

    // Content-Security-Policy in REPORT-ONLY mode: it blocks nothing, it only
    // POSTs violation reports to /api/csp-report so we can observe what a real
    // enforcing policy would break before turning it on. script/style keep
    // 'unsafe-inline' (Next bootstrap + inline styles) for now — tightening to
    // nonces is a later pass; this pass is about pinning down the external
    // connect/frame/media origins (Privy, WalletConnect, Helius/Solana RPC,
    // Jupiter, Cloudflare Stream, voice). img-src uses https: because token
    // logos come from arbitrary origins.
    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "media-src 'self' blob: https://cloudflarestream.com https://*.cloudflarestream.com https://videodelivery.net https://*.videodelivery.net",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "manifest-src 'self'",
      "connect-src 'self' https://api.mainnet-beta.solana.com wss://api.mainnet-beta.solana.com https://api.devnet.solana.com wss://api.devnet.solana.com https://mainnet.helius-rpc.com wss://mainnet.helius-rpc.com https://devnet.helius-rpc.com wss://devnet.helius-rpc.com https://orb.helius.dev https://api.jup.ag https://lite-api.jup.ag https://*.pinata.cloud https://gateway.pinata.cloud https://api.coingecko.com https://auth.privy.io https://*.privy.io https://explorer-api.walletconnect.com https://*.walletconnect.com https://*.walletconnect.org wss://relay.walletconnect.com wss://relay.walletconnect.org https://voice.pnl.market wss://voice.pnl.market https://cloudflarestream.com https://*.cloudflarestream.com https://videodelivery.net https://challenges.cloudflare.com",
      "frame-src 'self' https://auth.privy.io https://challenges.cloudflare.com https://verify.walletconnect.com https://verify.walletconnect.org https://cloudflarestream.com https://*.cloudflarestream.com https://iframe.cloudflarestream.com https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com",
      "report-uri /api/csp-report",
    ].join('; ');

    return [
      {
        source: '/api/:path*',
        has: [{ type: 'header', key: 'origin', value: ALLOWED_ORIGIN }],
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: ':origin' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
          { key: 'Vary', value: 'Origin' },
        ],
      },
      // Baseline security headers on every response. HSTS is ignored by
      // browsers over plain HTTP (dev), so it only takes effect on the
      // HTTPS prod deploy. Permissions-Policy keeps camera/mic enabled for
      // same-origin (mediasoup voice needs getUserMedia) and disables geo.
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
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
