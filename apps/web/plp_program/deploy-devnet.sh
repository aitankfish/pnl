#!/bin/bash

# Deploy PLP Program to Devnet
# Uses devnet-deploy-wallet.json as the deployer and treasury admin

set -e

echo "🚀 PLP Program - Devnet Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Wallet info - uses default Solana CLI wallet
# To use a specific wallet, set: export DEPLOY_WALLET_PATH=/path/to/wallet.json
WALLET_PATH="${DEPLOY_WALLET_PATH:-~/.config/solana/id.json}"
WALLET_ADDRESS=$(solana-keygen pubkey "$WALLET_PATH" 2>/dev/null || echo "unknown")

echo -e "${YELLOW}📋 Using Devnet Deploy Wallet${NC}"
echo "   Address: $WALLET_ADDRESS"
echo ""

# Check balance
echo -e "${YELLOW}💰 Checking balance...${NC}"
BALANCE=$(solana balance $WALLET_ADDRESS --url devnet 2>/dev/null | awk '{print $1}')
echo "   Current balance: $BALANCE SOL"
echo ""

# Request airdrop if balance is low
if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo -e "${YELLOW}🪂 Balance low, requesting airdrop...${NC}"

    # Try multiple times as airdrops can fail
    for i in {1..3}; do
        echo "   Attempt $i/3..."
        if solana airdrop 2 $WALLET_ADDRESS --url devnet 2>/dev/null; then
            echo -e "${GREEN}   ✅ Airdrop successful${NC}"
            sleep 2
            BALANCE=$(solana balance $WALLET_ADDRESS --url devnet 2>/dev/null | awk '{print $1}')
            echo "   New balance: $BALANCE SOL"
            break
        else
            if [ $i -lt 3 ]; then
                echo "   Failed, retrying in 5 seconds..."
                sleep 5
            else
                echo -e "${RED}   ❌ Airdrop failed after 3 attempts${NC}"
                echo "   You may need to wait a few minutes and try again"
                echo "   Or manually request: solana airdrop 2 --url devnet"
            fi
        fi
    done
    echo ""
fi

# Check if we have enough SOL
if (( $(echo "$BALANCE < 1" | bc -l) )); then
    echo -e "${RED}❌ Insufficient balance for deployment (need ~2-3 SOL)${NC}"
    echo "Please request an airdrop manually:"
    echo "  solana airdrop 5 $WALLET_ADDRESS --url devnet"
    exit 1
fi

# Configure Solana to use devnet
echo -e "${YELLOW}⚙️  Configuring Solana CLI...${NC}"
solana config set --url devnet
solana config set --keypair $WALLET_PATH
echo -e "${GREEN}   ✅ Configuration updated${NC}"
echo ""

# Build the program
echo -e "${YELLOW}🔨 Building program...${NC}"
anchor build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✅ Build successful${NC}"
else
    echo -e "${RED}   ❌ Build failed${NC}"
    exit 1
fi
echo ""

# Check program size
PROGRAM_SIZE=$(ls -lh target/deploy/errors.so | awk '{print $5}')
echo -e "${YELLOW}📦 Program Info:${NC}"
echo "   Binary: target/deploy/errors.so"
echo "   Size: $PROGRAM_SIZE"
echo ""

# Deploy to devnet
echo -e "${YELLOW}🚀 Deploying to devnet...${NC}"
echo "   This may take 1-2 minutes..."
echo ""

anchor deploy --provider.cluster devnet --provider.wallet $WALLET_PATH

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Program deployed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi
echo ""

# Get program info from Anchor.toml or use current deployed ID
PROGRAM_ID="${PLP_PROGRAM_ID:-C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86}"

echo -e "${YELLOW}📊 Deployment Details:${NC}"
echo "   Program ID: $PROGRAM_ID"
echo "   Network: Devnet"
echo "   Deployer: $WALLET_ADDRESS"
echo ""

# Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
if solana program show $PROGRAM_ID --url devnet > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Program verified on-chain${NC}"
    echo ""
    solana program show $PROGRAM_ID --url devnet
else
    echo -e "${RED}   ❌ Could not verify program${NC}"
fi
echo ""

# Check final balance
FINAL_BALANCE=$(solana balance $WALLET_ADDRESS --url devnet 2>/dev/null | awk '{print $1}')
COST=$(echo "$BALANCE - $FINAL_BALANCE" | bc)
echo -e "${YELLOW}💸 Deployment Cost:${NC}"
echo "   Initial: $BALANCE SOL"
echo "   Final: $FINAL_BALANCE SOL"
echo "   Cost: $COST SOL"
echo ""

# Next steps
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Initialize Treasury (run once):"
echo "   anchor run initialize-treasury --provider.cluster devnet"
echo ""
echo "2. View on Explorer:"
echo "   https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo ""
echo "3. Run tests on devnet:"
echo "   anchor test --provider.cluster devnet --skip-deploy"
echo ""
echo "4. Update Anchor.toml if needed:"
echo "   [programs.devnet]"
echo "   errors = \"$PROGRAM_ID\""
echo ""

# Save deployment info
cat > deployment-info.json <<EOF
{
  "network": "devnet",
  "programId": "$PROGRAM_ID",
  "deployerAddress": "$WALLET_ADDRESS",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "balance": "$FINAL_BALANCE",
  "cost": "$COST",
  "explorerUrl": "https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
}
EOF

echo "📝 Deployment info saved to deployment-info.json"
echo ""
