/**
 * Whitepaper Page
 *
 * Hidden page accessible only via direct URL: pnl.market/whitepaper
 * Not linked anywhere in the navigation
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Whitepaper | PNL Platform',
  description: 'PNL (Prediction & Launch) - A new paradigm for fair token launches and web3 funding',
  robots: 'noindex, nofollow', // Don't index this page
};

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            PNL Whitepaper
          </h1>
          <p className="text-xl text-gray-300">
            A New Paradigm for Fair Token Launches and Web3 Funding
          </p>
          <div className="mt-6 text-sm text-gray-400">
            <p>Version 1.0 • December 2025</p>
            <p>Solana Mainnet</p>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-lg max-w-none">

          {/* Abstract */}
          <section className="mb-12 bg-gray-800/50 rounded-lg p-8 border border-gray-700">
            <h2 className="text-3xl font-bold text-white mb-4">Abstract</h2>
            <p className="text-gray-300 leading-relaxed">
              The cryptocurrency industry faces a critical trust crisis. Token launches are plagued by scams,
              rugpulls, and abandoned projects, while legitimate founders—especially those outside traditional
              tech hubs—struggle to access capital and build credibility.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong className="text-white">PNL (Prediction & Launch Platform)</strong> introduces a revolutionary
              solution: <strong className="text-blue-400">prediction markets as a vetting mechanism for token launches</strong>.
              By combining market-based validation with transparent token distribution and accountability mechanisms,
              PNL creates the world&apos;s first community-validated token launch platform.
            </p>

            <div className="mt-6 space-y-2">
              <p className="text-green-400">✅ Market-Based Validation: Community predicts and votes on project success</p>
              <p className="text-green-400">✅ Aligned Incentives: Founders and voters both benefit from success</p>
              <p className="text-green-400">✅ Fair Distribution: Transparent, on-chain token allocation (79% to supporters)</p>
              <p className="text-green-400">✅ Global Access: Permissionless, no KYC barriers, 0.01 SOL minimum</p>
              <p className="text-green-400">✅ Built-In Accountability: Future governance controls trading fee release</p>
            </div>
          </section>

          {/* The Problem */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">The Problem: Broken Token Launches</h2>

            <div className="bg-gray-800/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-red-400 mb-4">1. Rampant Scams</h3>
              <ul className="text-gray-300 space-y-2">
                <li>• Anonymous teams launch tokens, generate hype, then disappear with funds</li>
                <li>• No accountability mechanisms exist to hold founders responsible</li>
                <li>• Investors have no recourse when projects fail or turn out to be scams</li>
                <li>• The market is flooded with low-quality projects</li>
              </ul>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-red-400 mb-4">2. Access Inequality</h3>
              <ul className="text-gray-300 space-y-2">
                <li>• <strong>VC Dominance:</strong> Best allocations locked to well-connected insiders</li>
                <li>• <strong>Retail Disadvantage:</strong> Public investors buy at massive markups</li>
                <li>• <strong>Geographic Barriers:</strong> Talented founders in emerging markets can&apos;t access capital</li>
                <li>• <strong>Network Effects:</strong> Success depends on connections, not merit</li>
              </ul>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-6">
              <h3 className="text-2xl font-semibold text-red-400 mb-4">3. Misaligned Incentives</h3>
              <div className="bg-gray-900/50 rounded p-4 font-mono text-sm text-gray-300">
                <p>Traditional Launch:</p>
                <p className="ml-4">├── Founders want: Raise maximum, deliver minimum</p>
                <p className="ml-4">├── VCs want: Quick exits, high multiples</p>
                <p className="ml-4">├── Retail wants: Fair prices, real projects</p>
                <p className="ml-4">└── Result: Market for lemons (scams dominate)</p>
              </div>
            </div>
          </section>

          {/* The Solution */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">The Solution: Let the Market Decide</h2>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-blue-400 mb-4">Core Insight</h3>
              <p className="text-gray-300">
                Prediction markets have proven to be exceptionally accurate forecasting tools—consistently
                outperforming polls in elections, analysts in sports, and economists in market trends.
                <strong className="text-white"> PNL applies this to validate token launches.</strong>
              </p>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-6">
              <h3 className="text-2xl font-semibold text-white mb-4">The Mechanism</h3>
              <ol className="text-gray-300 space-y-3 list-decimal list-inside">
                <li><strong>Founder creates prediction market:</strong> &quot;Will this project succeed?&quot;</li>
                <li><strong>Community votes with real money:</strong> YES (will succeed) or NO (will fail)</li>
                <li><strong>Market aggregates information:</strong> Price reflects true probability</li>
                <li><strong>Token launches only if YES wins:</strong> Community validation required</li>
                <li><strong>Fair distribution:</strong> YES voters receive 79% of tokens proportionally</li>
              </ol>
              <p className="text-green-400 mt-4 font-semibold">
                Result: Only projects the community believes in get launched.
              </p>
            </div>
          </section>

          {/* How PNL Works */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">How PNL Works</h2>

            <div className="space-y-6">
              <div className="bg-gray-800/30 rounded-lg p-6 border-l-4 border-blue-500">
                <h3 className="text-xl font-semibold text-blue-400 mb-3">Phase 1: Market Creation</h3>
                <p className="text-gray-300 mb-2">Founder creates a prediction market with:</p>
                <ul className="text-gray-300 space-y-1 ml-4">
                  <li>• Project details, vision, and roadmap</li>
                  <li>• Token economics</li>
                  <li>• Target pool size and expiry date</li>
                  <li>• Creation fee: <strong className="text-white">0.015 SOL</strong></li>
                </ul>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-6 border-l-4 border-purple-500">
                <h3 className="text-xl font-semibold text-purple-400 mb-3">Phase 2: Community Voting</h3>
                <p className="text-gray-300 mb-2">Voters analyze and bet:</p>
                <ul className="text-gray-300 space-y-1 ml-4">
                  <li>• Minimum vote: <strong className="text-white">0.01 SOL</strong> (accessible to everyone)</li>
                  <li>• Trade fee: <strong className="text-white">1.5%</strong> per vote</li>
                  <li>• Vote YES or NO based on due diligence</li>
                  <li>• One position rule: Can&apos;t bet on both sides</li>
                </ul>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-6 border-l-4 border-green-500">
                <h3 className="text-xl font-semibold text-green-400 mb-3">Phase 3: Market Resolution</h3>
                <div className="bg-gray-900/50 rounded p-4 font-mono text-sm text-gray-300">
                  <p>After expiry:</p>
                  <p className="ml-4">├── IF YES shares &gt; NO shares → Token launches</p>
                  <p className="ml-4">├── IF NO shares &gt; YES shares → Everyone refunded</p>
                  <p className="ml-4">├── IF tied OR pool &lt; target → Full refund</p>
                  <p className="ml-4">└── Completion fee: <strong className="text-yellow-400">5% of pool</strong> (if YES/NO wins)</p>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-6 border-l-4 border-yellow-500">
                <h3 className="text-xl font-semibold text-yellow-400 mb-3">Phase 4: Token Launch (If YES Wins)</h3>
                <p className="text-gray-300 mb-3">Automated, atomic token creation via Jito bundling:</p>
                <div className="bg-blue-900/20 rounded p-4 mb-3">
                  <p className="text-white font-semibold mb-2">Token Distribution:</p>
                  <ul className="text-gray-300 space-y-1">
                    <li>• <strong className="text-green-400">YES Voters: 79%</strong> (proportional to shares)</li>
                    <li>• <strong className="text-blue-400">Team: 20%</strong> (5% immediate + 15% vested over 12 months)</li>
                    <li>• <strong className="text-purple-400">PNL Platform: 1%</strong></li>
                  </ul>
                </div>
                <p className="text-gray-300">Token trades on Pump.fun bonding curve, may graduate to Raydium DEX.</p>
              </div>
            </div>
          </section>

          {/* Fair Distribution */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Fair Token Distribution</h2>

            <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-green-400 mb-4">Why PNL Is Fair</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-900/50 rounded p-4">
                  <p className="text-red-400 font-semibold mb-2">❌ Traditional IDO:</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• VCs: 50-70% at $0.001/token</li>
                    <li>• Team: 15-25% at $0.001/token</li>
                    <li>• Public: 5-10% at $0.10/token</li>
                    <li className="text-red-400 font-semibold">→ 100x price gap, retail dumped on</li>
                  </ul>
                </div>

                <div className="bg-gray-900/50 rounded p-4">
                  <p className="text-green-400 font-semibold mb-2">✅ PNL:</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• YES Voters: 79% at market price</li>
                    <li>• Team: 20% at same price (vested)</li>
                    <li>• Platform: 1% at same price</li>
                    <li className="text-green-400 font-semibold">→ Fair, transparent, same price for all</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Platform Economics */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Platform Economics</h2>

            <div className="bg-gray-800/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-blue-400 mb-2">Fee Structure</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>• <strong className="text-white">Market Creation Fee:</strong> 0.015 SOL (spam prevention)</li>
                  <li>• <strong className="text-white">Trade Fee:</strong> 1.5% of each vote (platform revenue)</li>
                  <li>• <strong className="text-white">Completion Fee:</strong> 5% of pool when market resolves</li>
                </ul>
              </div>

              <div className="bg-gray-900/50 rounded p-4">
                <p className="text-white font-semibold mb-2">All fees go to platform treasury for:</p>
                <ul className="text-gray-300 text-sm space-y-1 ml-4">
                  <li>• Development and maintenance</li>
                  <li>• RPC infrastructure costs</li>
                  <li>• Security audits</li>
                  <li>• Future: DAO governance and distribution</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Benefits */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Benefits</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-blue-400 mb-4">For Founders</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>✅ Access global capital (no geographic barriers)</li>
                  <li>✅ Community-driven marketing (organic growth)</li>
                  <li>✅ Market validation before building</li>
                  <li>✅ Fair token distribution to believers</li>
                  <li>✅ Reputation building over time</li>
                </ul>
              </div>

              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-green-400 mb-4">For Voters</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>✅ Early access (VC-level opportunities)</li>
                  <li>✅ Collective intelligence advantage</li>
                  <li>✅ Downside protection (refunds if NO wins)</li>
                  <li>✅ Portfolio diversification ($2 minimum)</li>
                  <li>✅ Future governance rights</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Future: Accountability */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Future: Accountability Layer</h2>

            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6">
              <h3 className="text-2xl font-semibold text-purple-400 mb-4">Fee Governance Mechanism</h3>
              <p className="text-gray-300 mb-4">
                Next evolution: Market PDA owns the token, trading fees held in escrow and controlled by governance.
              </p>

              <div className="bg-gray-900/50 rounded p-4 space-y-3">
                <div>
                  <p className="text-white font-semibold">30-day grace period:</p>
                  <p className="text-gray-300 text-sm">Founder builds product, fees accumulate in escrow</p>
                </div>

                <div>
                  <p className="text-white font-semibold">30-day governance vote (evidence-based):</p>
                  <p className="text-gray-300 text-sm">Token holders vote: &quot;Release to Founder&quot; OR &quot;Flag as Scam&quot;</p>
                  <p className="text-blue-400 text-xs mt-1">✅ Based on delivery, NOT token price performance</p>
                </div>

                <div>
                  <p className="text-white font-semibold text-sm">Valid criteria:</p>
                  <ul className="text-gray-300 text-xs space-y-1 ml-4">
                    <li>✅ Did founder ship product?</li>
                    <li>✅ Were features delivered?</li>
                    <li>✅ GitHub activity / development?</li>
                    <li>🚫 &quot;Token price down&quot; - NOT valid</li>
                  </ul>
                </div>

                <div>
                  <p className="text-green-400 font-semibold">If Release wins (&gt;50% + product delivered):</p>
                  <p className="text-gray-300 text-sm">Founder claims fees (earned through delivery, regardless of token price)</p>
                </div>

                <div>
                  <p className="text-red-400 font-semibold">If Scam wins (&gt;66% supermajority + evidence):</p>
                  <p className="text-gray-300 text-sm">Evidence required: No product, founder vanished, rugpull, etc.</p>
                  <p className="text-gray-300 text-sm">Fees distributed to YES voters proportionally (~70% recovery)</p>
                </div>
              </div>

              <p className="text-yellow-400 font-semibold mt-4">
                Impact: Scams economically unviable + Honest founders protected from market volatility.
              </p>

              <p className="text-gray-400 text-sm mt-4">
                Full technical specification: <code className="text-blue-400">docs/architecture/TOKEN_GOVERNANCE_FEE_ESCROW.md</code>
              </p>
            </div>
          </section>

          {/* Vision */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Vision: Democratizing Web3 Funding</h2>

            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-blue-400 mb-4">The Bigger Picture</h3>
              <p className="text-gray-300 leading-relaxed">
                PNL is more than a token launch platform. It&apos;s a <strong className="text-white">fundamental reimagining
                of how innovation gets funded globally</strong>.
              </p>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-3">The Problem with Traditional VC</h3>
              <ul className="text-gray-300 space-y-2">
                <li>• &lt;1% of startups get funded (99% rejected)</li>
                <li>• Geographic concentration (80% in SF/NYC/London)</li>
                <li>• Network effects (Stanford/Harvard/YC alumni favored)</li>
                <li>• Slow (6-12 months from pitch to funding)</li>
                <li>• Dilutive (founders give up 20-40% equity per round)</li>
              </ul>
              <p className="text-red-400 font-semibold mt-4">
                Result: The vast majority of global talent is locked out.
              </p>
            </div>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-green-400 mb-3">PNL&apos;s Solution: Permissionless Capital</h3>
              <ul className="text-gray-300 space-y-2">
                <li>✅ <strong>100% access:</strong> Anyone can create market (no rejection)</li>
                <li>✅ <strong>Global reach:</strong> Work from Lagos, Mumbai, São Paulo, Manila</li>
                <li>✅ <strong>Meritocratic:</strong> Market decides, not gatekeepers</li>
                <li>✅ <strong>Fast:</strong> 30-90 day timeline (vs 6-12 months)</li>
                <li>✅ <strong>Non-dilutive:</strong> Founders keep equity, earn from fees</li>
              </ul>
              <p className="text-green-400 font-semibold mt-4">
                Impact: Unlock $1T+ in untapped global talent
              </p>
            </div>
          </section>

          {/* Technical */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Technical Architecture</h2>

            <div className="bg-gray-800/30 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-blue-400 font-semibold mb-2">Blockchain</p>
                  <ul className="text-gray-300 space-y-1 ml-4">
                    <li>• Solana (high throughput, low fees)</li>
                    <li>• Anchor framework (Rust)</li>
                    <li>• Program ID: <code className="text-xs">C5mVE2Bw...9bi4MzVj86</code></li>
                  </ul>
                </div>

                <div>
                  <p className="text-purple-400 font-semibold mb-2">Frontend</p>
                  <ul className="text-gray-300 space-y-1 ml-4">
                    <li>• Next.js 14 (React, TypeScript)</li>
                    <li>• Privy (embedded + external wallets)</li>
                    <li>• Responsive, mobile-first design</li>
                  </ul>
                </div>

                <div>
                  <p className="text-green-400 font-semibold mb-2">Infrastructure</p>
                  <ul className="text-gray-300 space-y-1 ml-4">
                    <li>• Helius RPC (primary)</li>
                    <li>• QuickNode (fallback)</li>
                    <li>• Jito bundling (atomic execution)</li>
                  </ul>
                </div>

                <div>
                  <p className="text-yellow-400 font-semibold mb-2">Token Launch</p>
                  <ul className="text-gray-300 space-y-1 ml-4">
                    <li>• Pump.fun integration</li>
                    <li>• Bonding curve mechanism</li>
                    <li>• Automatic Raydium graduation</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Conclusion */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Conclusion</h2>

            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-2 border-blue-500/50 rounded-lg p-8">
              <h3 className="text-2xl font-semibold text-blue-400 mb-4">Why PNL Will Succeed</h3>

              <div className="space-y-4 text-gray-300">
                <div>
                  <p className="font-semibold text-white">1. Perfect Timing</p>
                  <p className="text-sm">Crypto scams at peak → Prediction markets proven → Solana thriving → Global talent seeking access</p>
                </div>

                <div>
                  <p className="font-semibold text-white">2. Unique Moat</p>
                  <p className="text-sm">First mover, network effects, data moat, engaged community</p>
                </div>

                <div>
                  <p className="font-semibold text-white">3. Aligned Incentives</p>
                  <p className="text-sm">Founders, voters, and platform all benefit from quality projects succeeding</p>
                </div>

                <div>
                  <p className="font-semibold text-white">4. Real-World Utility</p>
                  <p className="text-sm">Solves actual pain points with proven primitives, fully transparent and on-chain</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-blue-500/30">
                <p className="text-xl text-center text-blue-400 font-semibold italic">
                  &quot;Let the market decide. Launch with confidence. Build with accountability.&quot;
                </p>
                <p className="text-center text-gray-400 mt-2">— PNL Team</p>
              </div>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="mb-12">
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 leading-relaxed">
                <strong className="text-yellow-400">Disclaimer:</strong> This whitepaper is for informational purposes only
                and does not constitute financial, investment, or legal advice. Token launches involve substantial risk,
                including potential total loss of investment. Prediction markets are not guarantees of project success.
                Always conduct your own research and consult with qualified professionals before participating. PNL makes
                no representations or warranties regarding the accuracy of information presented, the success of any project,
                or the value of any tokens. Cryptocurrency markets are highly volatile and speculative. Past performance
                does not indicate future results.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
