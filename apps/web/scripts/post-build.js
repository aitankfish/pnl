#!/usr/bin/env node

/**
 * Post-build script to ensure required manifest files exist
 * This handles cases where static generation fails but app was built successfully
 */

const fs = require('fs');
const path = require('path');

const nextDir = path.join(__dirname, '../.next');
const prerenderManifestPath = path.join(nextDir, 'prerender-manifest.json');

// Check if .next directory exists
if (!fs.existsSync(nextDir)) {
  console.error('Error: .next directory not found');
  process.exit(1);
}

// Create minimal prerender-manifest.json if it doesn't exist
if (!fs.existsSync(prerenderManifestPath)) {
  console.log('Creating missing prerender-manifest.json...');

  const minimalManifest = {
    version: 4,
    routes: {},
    dynamicRoutes: {},
    notFoundRoutes: [],
    preview: {
      previewModeId: 'development-id',
      previewModeSigningKey: 'development-key',
      previewModeEncryptionKey: 'development-encryption-key'
    }
  };

  fs.writeFileSync(
    prerenderManifestPath,
    JSON.stringify(minimalManifest, null, 2)
  );

  console.log('✓ Created prerender-manifest.json');
} else {
  console.log('✓ prerender-manifest.json exists');
}

console.log('Post-build complete!');
