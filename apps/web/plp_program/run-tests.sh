#!/bin/bash

# PLP Program Test Runner
# This script helps you run tests easily

set -e

echo "🧪 PLP Prediction Market - Test Runner"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if anchor is installed
if ! command -v anchor &> /dev/null; then
    print_error "Anchor CLI not found!"
    echo "Install it with: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    exit 1
fi

# Check if solana is installed
if ! command -v solana &> /dev/null; then
    print_error "Solana CLI not found!"
    echo "Install it with: sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

# Parse command line arguments
TEST_MODE="${1:-local}"

case $TEST_MODE in
    local)
        print_info "Running tests on LOCAL TEST VALIDATOR"
        echo ""

        # Build the program
        print_info "Building program..."
        anchor build
        print_success "Build complete"
        echo ""

        # Run tests
        print_info "Running tests..."
        anchor test

        if [ $? -eq 0 ]; then
            print_success "All tests passed! 🎉"
        else
            print_error "Some tests failed"
            exit 1
        fi
        ;;

    devnet)
        print_info "Running tests on DEVNET"
        echo ""

        # Check devnet balance
        print_info "Checking devnet balance..."
        BALANCE=$(solana balance --url devnet 2>/dev/null | awk '{print $1}')

        if (( $(echo "$BALANCE < 1" | bc -l) )); then
            print_info "Low balance detected. Requesting airdrop..."
            solana airdrop 2 --url devnet
        fi

        print_success "Balance: $BALANCE SOL"
        echo ""

        # Build
        print_info "Building program..."
        anchor build
        print_success "Build complete"
        echo ""

        # Deploy
        print_info "Deploying to devnet..."
        anchor deploy --provider.cluster devnet
        print_success "Deploy complete"
        echo ""

        # Run tests
        print_info "Running tests on devnet..."
        anchor test --provider.cluster devnet --skip-deploy

        if [ $? -eq 0 ]; then
            print_success "All tests passed on devnet! 🎉"
        else
            print_error "Some tests failed"
            exit 1
        fi
        ;;

    build)
        print_info "Building program only (no tests)..."
        anchor build

        if [ $? -eq 0 ]; then
            print_success "Build successful!"
        else
            print_error "Build failed"
            exit 1
        fi
        ;;

    clean)
        print_info "Cleaning build artifacts..."
        anchor clean
        cargo clean
        rm -rf target/
        print_success "Clean complete"
        ;;

    *)
        echo "Usage: ./run-tests.sh [local|devnet|build|clean]"
        echo ""
        echo "Options:"
        echo "  local   - Run tests on local test validator (default, fastest)"
        echo "  devnet  - Deploy and test on Solana devnet (slower, more realistic)"
        echo "  build   - Build program only without testing"
        echo "  clean   - Clean all build artifacts"
        echo ""
        echo "Examples:"
        echo "  ./run-tests.sh           # Run local tests"
        echo "  ./run-tests.sh devnet    # Test on devnet"
        echo "  ./run-tests.sh build     # Just build"
        exit 1
        ;;
esac
