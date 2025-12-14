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
    <div className="space-y-8 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
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
          <section className="mb-12 bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl rounded-lg p-8 border border-blue-400/30">
            <h2 className="text-3xl font-bold text-white mb-4">Abstract</h2>
            <p className="text-gray-300 leading-relaxed">
              The cryptocurrency industry faces a critical trust crisis. Token launches are plagued by scams,
              rugpulls, and abandoned projects, while legitimate founders—especially those outside traditional
              tech hubs—struggle to access capital and build credibility.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong className="text-white">PNL (Prediction & Launch Platform)</strong> introduces a revolutionary
              solution: <strong className="text-blue-400">prediction markets as a vetting mechanism for token launches</strong>.
              By combining market-based validation with transparent token distribution,
              PNL creates the world&apos;s first community-validated token launch platform.
            </p>

            <div className="mt-6 space-y-2">
              <p className="text-green-400">✅ Market-Based Validation: Community predicts and votes on project success</p>
              <p className="text-green-400">✅ Aligned Incentives: Founders and voters both benefit from success</p>
              <p className="text-green-400">✅ Fair Distribution: Transparent, on-chain token allocation (65% to supporters)</p>
              <p className="text-green-400">✅ Global Access: Permissionless, no KYC barriers, 0.01 SOL minimum</p>
              <p className="text-green-400">✅ Transparent Economics: Clear fee structure and token distribution</p>
            </div>
          </section>

          {/* The Problem */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">The Problem: Broken Token Launches</h2>

            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-xl rounded-lg p-6 mb-6 border border-red-400/30">
              <h3 className="text-2xl font-semibold text-red-400 mb-4">1. Rampant Scams</h3>
              <ul className="text-gray-300 space-y-2">
                <li>• Anonymous teams launch tokens, generate hype, then disappear with funds</li>
                <li>• No accountability mechanisms exist to hold founders responsible</li>
                <li>• Investors have no recourse when projects fail or turn out to be scams</li>
                <li>• The market is flooded with low-quality projects</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-xl rounded-lg p-6 mb-6 border border-red-400/30">
              <h3 className="text-2xl font-semibold text-red-400 mb-4">2. Access Inequality</h3>
              <ul className="text-gray-300 space-y-2">
                <li>• <strong>VC Dominance:</strong> Best allocations locked to well-connected insiders</li>
                <li>• <strong>Retail Disadvantage:</strong> Public investors buy at massive markups</li>
                <li>• <strong>Geographic Barriers:</strong> Talented founders in emerging markets can&apos;t access capital</li>
                <li>• <strong>Network Effects:</strong> Success depends on connections, not merit</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-xl rounded-lg p-6 border border-red-400/30">
              <h3 className="text-2xl font-semibold text-red-400 mb-4">3. Misaligned Incentives</h3>
              <div className="bg-black/30 rounded p-4 font-mono text-sm text-gray-300 border border-red-400/20">
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

            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl border border-cyan-400/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-cyan-400 mb-4">Core Insight</h3>
              <p className="text-gray-300">
                Prediction markets have proven to be exceptionally accurate forecasting tools—consistently
                outperforming polls in elections, analysts in sports, and economists in market trends.
                <strong className="text-white"> PNL applies this to validate token launches.</strong>
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl rounded-lg p-6 border border-blue-400/30">
              <h3 className="text-2xl font-semibold text-white mb-4">The Mechanism</h3>
              <ol className="text-gray-300 space-y-3 list-decimal list-inside">
                <li><strong>Founder creates prediction market:</strong> &quot;Will this project succeed?&quot;</li>
                <li><strong>Community votes with real money:</strong> YES (will succeed) or NO (will fail)</li>
                <li><strong>Market aggregates information:</strong> Price reflects true probability</li>
                <li><strong>Token launches only if YES wins:</strong> Community validation required</li>
                <li><strong>Fair distribution:</strong> YES voters receive 65% of tokens proportionally</li>
              </ol>
              <p className="text-green-400 mt-4 font-semibold">
                Result: Only projects the community believes in get launched.
              </p>
            </div>
          </section>

          {/* How PNL Works */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">How PNL Works</h2>

            {/* Complete Lifecycle Diagram */}
            <div className="bg-gradient-to-br from-gray-900 via-blue-900/10 to-gray-900 border-2 border-blue-500/40 rounded-xl p-3 mb-8 shadow-2xl">
              <h3 className="text-lg font-bold text-blue-400 mb-3 text-center">Complete Platform Lifecycle</h3>

              {/* Horizontal Sequence Diagram */}
              <div>
                {/* Timeline bar */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-purple-500 to-green-500"></div>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-green-500 to-yellow-500"></div>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-yellow-500 to-orange-500"></div>
                </div>

                {/* Phases Row 1 - First 3 phases */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {/* Phase 1: Market Creation */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/20 border border-blue-500 rounded p-2 h-full">
                      <div className="flex items-center justify-center mb-1">
                        <div className="bg-blue-500 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center mr-1 text-xs">1</div>
                        <h4 className="text-xs font-bold text-blue-400">CREATE</h4>
                      </div>
                      <p className="text-center text-blue-300 text-[10px] mb-1">Day 0</p>
                      <div className="space-y-1">
                        <div className="bg-gray-800/60 rounded px-2 py-1 border border-blue-500/30">
                          <p className="font-semibold text-white text-[10px]">Founder</p>
                          <p className="text-gray-300 text-[10px]">• Details</p>
                          <p className="text-gray-300 text-[10px]">• <span className="text-blue-400">0.015 SOL</span></p>
                        </div>
                        <div className="flex justify-center text-blue-400 text-sm">↓</div>
                        <div className="bg-gray-800/60 rounded px-2 py-1 border border-blue-500/30">
                          <p className="font-semibold text-white text-[10px]">Live</p>
                          <p className="text-gray-300 text-[10px]">• YES/NO</p>
                        </div>
                      </div>
                    </div>
                    <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 text-purple-400 text-xl z-10">→</div>
                  </div>

                  {/* Phase 2: Community Voting */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-purple-600/20 to-purple-500/20 border border-purple-500 rounded p-2 h-full">
                      <div className="flex items-center justify-center mb-1">
                        <div className="bg-purple-500 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center mr-1 text-xs">2</div>
                        <h4 className="text-xs font-bold text-purple-400">VOTE</h4>
                      </div>
                      <p className="text-center text-purple-300 text-[10px] mb-1">Day 1-30</p>
                      <div className="bg-gray-800/60 rounded px-2 py-1 border border-purple-500/30">
                        <p className="font-semibold text-white text-[10px]">Community</p>
                        <p className="text-gray-300 text-[10px]">• Review</p>
                        <p className="text-gray-300 text-[10px]">• YES/NO</p>
                        <p className="text-gray-300 text-[10px]">• <span className="text-purple-400">0.01 SOL</span></p>
                        <p className="text-gray-300 text-[10px]">• <span className="text-purple-400">1.5% fee</span></p>
                      </div>
                    </div>
                    <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 text-green-400 text-xl z-10">→</div>
                  </div>

                  {/* Phase 3: Market Resolution */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-green-600/20 to-green-500/20 border border-green-500 rounded p-2 h-full">
                      <div className="flex items-center justify-center mb-1">
                        <div className="bg-green-500 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center mr-1 text-xs">3</div>
                        <h4 className="text-xs font-bold text-green-400">RESOLVE</h4>
                      </div>
                      <p className="text-center text-green-300 text-[10px] mb-1">Expiry</p>
                      <div className="bg-gray-800/60 rounded px-2 py-1 border border-green-500/30">
                        <p className="font-semibold text-white text-[10px]">Outcome</p>
                        <p className="text-gray-300 text-[10px]">• <span className="text-green-400">YES</span> → Launch</p>
                        <p className="text-gray-300 text-[10px]">• <span className="text-red-400">NO</span> → Refund</p>
                        <p className="text-gray-300 text-[10px]">• Fee: <span className="text-green-400">5%</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connector Arrow Down */}
                <div className="flex justify-center mb-2">
                  <div className="text-yellow-400 text-xl">↓</div>
                </div>

                {/* Phase 4: Token Launch */}
                <div className="mb-3">
                  <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-500/20 border border-yellow-500 rounded p-2">
                    <div className="flex items-center justify-center mb-1">
                      <div className="bg-yellow-500 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center mr-1 text-xs">4</div>
                      <h4 className="text-xs font-bold text-yellow-400">LAUNCH</h4>
                    </div>
                    <p className="text-center text-yellow-300 text-[10px] mb-1">If YES (Atomic)</p>
                    <div className="bg-yellow-900/20 rounded px-2 py-1 border border-yellow-500/40 mb-1">
                      <p className="font-semibold text-yellow-400 text-center text-[10px]">Native TX + ALT</p>
                    </div>
                    <div className="bg-gray-800/60 rounded px-2 py-1 border border-yellow-500/30">
                      <p className="font-semibold text-white text-[10px] mb-1">Single Atomic TX</p>
                      <p className="text-gray-300 text-[10px]">• Pump.fun create</p>
                      <p className="text-gray-300 text-[10px]">• Create ATA</p>
                      <p className="text-gray-300 text-[10px]">• Resolve market</p>
                      <p className="text-gray-300 text-[10px] mt-1"><span className="text-green-400">65% YES</span> <span className="text-blue-400">33% Team</span> <span className="text-purple-400">2% Plat</span></p>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Section */}
                <div className="bg-gradient-to-r from-pink-600/20 to-pink-500/20 border border-pink-500 rounded p-2">
                  <div className="flex items-center justify-center mb-2">
                    <div className="bg-pink-500 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center mr-1 text-xs">📊</div>
                    <h4 className="text-xs font-bold text-pink-400">METRICS</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    <div className="bg-gray-800/60 rounded px-2 py-1 border border-pink-500/30">
                      <p className="text-gray-300 text-[10px]">• Markets</p>
                    </div>
                    <div className="bg-gray-800/60 rounded px-2 py-1 border border-pink-500/30">
                      <p className="text-gray-300 text-[10px]">• Success</p>
                    </div>
                    <div className="bg-gray-800/60 rounded px-2 py-1 border border-pink-500/30">
                      <p className="text-gray-300 text-[10px]">• Confidence</p>
                    </div>
                    <div className="bg-gray-800/60 rounded px-2 py-1 border border-pink-500/30">
                      <p className="text-gray-300 text-[10px]">• Token Performance</p>
                    </div>
                    <div className="bg-gray-800/60 rounded px-2 py-1 border border-pink-500/30 sm:col-span-2">
                      <p className="text-gray-300 text-[10px]">• Community Sentiment</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl rounded-lg p-6 border border-blue-400/30">
                <h3 className="text-xl font-semibold text-blue-400 mb-3">Phase 1: Market Creation</h3>
                <p className="text-gray-300 mb-2">Founder creates a prediction market with:</p>
                <ul className="text-gray-300 space-y-1 ml-4">
                  <li>• Project details, vision, and roadmap</li>
                  <li>• Token economics</li>
                  <li>• Target pool size and expiry date</li>
                  <li>• Creation fee: <strong className="text-white">0.015 SOL</strong></li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-lg p-6 border border-purple-400/30">
                <h3 className="text-xl font-semibold text-purple-400 mb-3">Phase 2: Community Voting</h3>
                <p className="text-gray-300 mb-2">Voters analyze and bet:</p>
                <ul className="text-gray-300 space-y-1 ml-4">
                  <li>• Minimum vote: <strong className="text-white">0.01 SOL</strong> (accessible to everyone)</li>
                  <li>• Trade fee: <strong className="text-white">1.5%</strong> per vote</li>
                  <li>• Vote YES or NO based on due diligence</li>
                  <li>• One position rule: Can&apos;t bet on both sides</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-lg p-6 border border-green-400/30">
                <h3 className="text-xl font-semibold text-green-400 mb-3">Phase 3: Market Resolution</h3>
                <div className="bg-black/30 rounded p-4 font-mono text-sm text-gray-300 border border-green-400/20">
                  <p>After expiry:</p>
                  <p className="ml-4">├── IF YES shares &gt; NO shares → Token launches</p>
                  <p className="ml-4">├── IF NO shares &gt; YES shares → Everyone refunded</p>
                  <p className="ml-4">├── IF tied OR pool &lt; target → Full refund</p>
                  <p className="ml-4">└── Completion fee: <strong className="text-yellow-400">5% of pool</strong> (if YES/NO wins)</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 backdrop-blur-xl rounded-lg p-6 border border-yellow-400/30">
                <h3 className="text-xl font-semibold text-yellow-400 mb-3">Phase 4: Token Launch (If YES Wins)</h3>
                <p className="text-gray-300 mb-3">Automated, atomic token creation via native Solana transaction with Address Lookup Tables:</p>
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl rounded p-4 mb-3 border border-cyan-400/30">
                  <p className="text-white font-semibold mb-2">Token Distribution:</p>
                  <ul className="text-gray-300 space-y-1">
                    <li>• <strong className="text-green-400">YES Voters: 65%</strong> (proportional to shares)</li>
                    <li>• <strong className="text-blue-400">Team: 33%</strong> (8% immediate + 25% vested over 12 months)</li>
                    <li>• <strong className="text-purple-400">PNL Platform: 2%</strong></li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl rounded p-4 mb-3 border border-emerald-400/30">
                  <p className="text-white font-semibold mb-2">Pool Cap & Excess SOL:</p>
                  <ul className="text-gray-300 space-y-1">
                    <li>• <strong className="text-emerald-400">Maximum for launch: 50 SOL</strong> (goes to Pump.fun)</li>
                    <li>• <strong className="text-teal-400">Excess SOL</strong> (if pool &gt; 50 SOL) goes to founder:</li>
                    <li className="ml-4">└── 8% immediate + 92% vested over 12 months</li>
                  </ul>
                </div>
                <p className="text-gray-300">Token trades on Pump.fun bonding curve, may graduate to Raydium DEX.</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 backdrop-blur-xl rounded-lg p-6 border border-indigo-400/30">
                <h3 className="text-xl font-semibold text-indigo-400 mb-3">Optional: Funding Phase Extension</h3>
                <p className="text-gray-300 mb-3">After YES wins, founders can extend the market to collect additional funds:</p>
                <div className="bg-black/30 rounded p-4 font-mono text-sm text-gray-300 border border-indigo-400/20">
                  <p>Funding Phase:</p>
                  <p className="ml-4">├── YES voting: <span className="text-green-400">Enabled</span> (supporters can add more)</p>
                  <p className="ml-4">├── NO voting: <span className="text-red-400">Locked</span> (outcome already decided)</p>
                  <p className="ml-4">├── Pool grows beyond original target</p>
                  <p className="ml-4">└── Founder launches token when ready</p>
                </div>
                <p className="text-gray-400 text-sm mt-3 italic">
                  This allows successful projects to raise more capital while maintaining community validation.
                </p>
              </div>
            </div>
          </section>

          {/* Fair Distribution */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Fair Token Distribution</h2>

            <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 backdrop-blur-xl border border-green-400/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-green-400 mb-4">Why PNL Is Fair</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/30 rounded p-4 border border-red-400/20">
                  <p className="text-red-400 font-semibold mb-2">❌ Traditional IDO:</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• VCs: 50-70% at $0.001/token</li>
                    <li>• Team: 15-25% at $0.001/token</li>
                    <li>• Public: 5-10% at $0.10/token</li>
                    <li className="text-red-400 font-semibold">→ 100x price gap, retail dumped on</li>
                  </ul>
                </div>

                <div className="bg-black/30 rounded p-4 border border-green-400/20">
                  <p className="text-green-400 font-semibold mb-2">✅ PNL:</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• YES Voters: 65% at market price</li>
                    <li>• Team: 33% at same price (vested)</li>
                    <li>• Platform: 2% at same price</li>
                    <li className="text-green-400 font-semibold">→ Fair, transparent, same price for all</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Platform Economics */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Platform Economics</h2>

            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-lg p-6 space-y-4 border border-purple-400/30">
              <div>
                <h3 className="text-xl font-semibold text-blue-400 mb-2">Fee Structure</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>• <strong className="text-white">Market Creation Fee:</strong> 0.015 SOL (spam prevention)</li>
                  <li>• <strong className="text-white">Trade Fee:</strong> 1.5% of each vote (platform revenue)</li>
                  <li>• <strong className="text-white">Completion Fee:</strong> 5% of pool when market resolves</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-emerald-400 mb-2">SOL Distribution</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>• <strong className="text-white">Token Launch:</strong> Up to 50 SOL goes to Pump.fun</li>
                  <li>• <strong className="text-white">Excess SOL:</strong> If pool &gt; 50 SOL, excess goes to founder</li>
                  <li className="ml-4 text-sm">└── 8% immediate + 92% vested over 12 months</li>
                </ul>
              </div>

              <div className="bg-black/30 rounded p-4 border border-purple-400/20">
                <p className="text-white font-semibold mb-2">All fees go to platform treasury for:</p>
                <ul className="text-gray-300 text-sm space-y-1 ml-4">
                  <li>• Development and maintenance</li>
                  <li>• RPC infrastructure costs</li>
                  <li>• Security audits</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Benefits */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Benefits</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl border border-cyan-400/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-blue-400 mb-4">For Founders</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>✅ Access global capital (no geographic barriers)</li>
                  <li>✅ Community-driven marketing (organic growth)</li>
                  <li>✅ Market validation before building</li>
                  <li>✅ Fair token distribution to believers</li>
                  <li>✅ Reputation building over time</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl border border-green-400/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-green-400 mb-4">For Voters</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>✅ Early access (VC-level opportunities)</li>
                  <li>✅ Collective intelligence advantage</li>
                  <li>✅ Downside protection (refunds if NO wins)</li>
                  <li>✅ Portfolio diversification (0.01 SOL minimum)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Vision */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Vision: Democratizing Web3 Funding</h2>

            <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 backdrop-blur-xl border border-cyan-400/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-blue-400 mb-4">The Bigger Picture</h3>
              <p className="text-gray-300 leading-relaxed">
                PNL is more than a token launch platform. It&apos;s a <strong className="text-white">fundamental reimagining
                of how innovation gets funded globally</strong>.
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-xl rounded-lg p-6 mb-6 border border-red-400/30">
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

            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl border border-green-400/30 rounded-lg p-6">
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

            <div className="bg-gradient-to-br from-slate-500/10 to-gray-500/10 backdrop-blur-xl rounded-lg p-6 border border-slate-400/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-blue-400 font-semibold mb-2">Blockchain</p>
                  <ul className="text-gray-300 space-y-1 ml-4">
                    <li>• Solana (high throughput, low fees)</li>
                    <li>• Anchor framework (Rust)</li>
                    <li>• Program ID: <code className="text-xs break-all">C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86</code></li>
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
                    <li>• Address Lookup Tables (transaction compression)</li>
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

          {/* Community & Links */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Community & Links</h2>

            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl rounded-lg p-6 border border-blue-400/30">
              <p className="text-gray-300 mb-6">
                Join our community and follow our development progress:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a
                  href="https://x.com/prelaunchmarket"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-black/30 hover:bg-black/50 transition-colors rounded-lg p-4 border border-gray-600/30 hover:border-blue-400/50"
                >
                  <div className="p-2 bg-blue-500/20 rounded-full">
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">X (Twitter)</p>
                    <p className="text-gray-400 text-sm">@prelaunchmarket</p>
                  </div>
                </a>

                <a
                  href="https://discord.gg/Ygknrrtn4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-black/30 hover:bg-black/50 transition-colors rounded-lg p-4 border border-gray-600/30 hover:border-indigo-400/50"
                >
                  <div className="p-2 bg-indigo-500/20 rounded-full">
                    <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">Discord</p>
                    <p className="text-gray-400 text-sm">Join our community</p>
                  </div>
                </a>

                <a
                  href="https://github.com/aitankfish/PnL"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-black/30 hover:bg-black/50 transition-colors rounded-lg p-4 border border-gray-600/30 hover:border-gray-400/50"
                >
                  <div className="p-2 bg-gray-500/20 rounded-full">
                    <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">GitHub</p>
                    <p className="text-gray-400 text-sm">View source code</p>
                  </div>
                </a>
              </div>
            </div>
          </section>

          {/* Conclusion */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Conclusion</h2>

            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl border-2 border-blue-400/40 rounded-lg p-8">
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

              <div className="mt-8 pt-6 border-t border-blue-400/30">
                <p className="text-xl text-center text-blue-400 font-semibold italic">
                  &quot;Let the market decide. Launch with confidence. Build with accountability.&quot;
                </p>
                <p className="text-center text-gray-400 mt-2">— PNL Team</p>
              </div>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="mb-12">
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 backdrop-blur-xl border border-yellow-400/30 rounded-lg p-6">
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
