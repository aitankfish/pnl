import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  // Three.js + react-three-fiber bundles contain unicode codepoints in
  // their minified form (shader strings with emoji-range chars) that
  // SWC's minifier rejects with "invalid unicode code point". Fall back
  // to Terser like the web app does — slightly slower build, correct
  // minification. Without this the cover-page CosmicTree3D scene fails
  // the build.
  swcMinify: false,
};

export default withMDX(config);
