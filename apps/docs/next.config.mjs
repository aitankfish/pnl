import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Keep deps out of the docs bundle that the app uses but docs doesn't.
  // (Docs is read-only; no Solana RPC, Privy, or Mongo here.)
};

export default withMDX(config);
