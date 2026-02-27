#!/bin/bash

# Build script for PLP prediction market program
set -e

echo "🔧 Building PLP prediction market program..."

# Clean up any existing artifacts
rm -rf target/
rm -f Cargo.lock

# Set environment variables for older lock file format
export CARGO_NET_GIT_FETCH_WITH_CLI=true

# Try to build with cargo directly first
echo "📦 Building with cargo..."
cd programs/errors
cargo build-sbf --manifest-path Cargo.toml
cd ../..

echo "✅ Build completed successfully!"

# List the built artifacts
echo "📋 Built artifacts:"
ls -la target/deploy/


