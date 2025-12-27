/**
 * Whitepaper Page
 *
 * Hidden page accessible only via direct URL: pnl.market/whitepaper
 * Not linked anywhere in the navigation
 */

import { Metadata } from 'next';
import AMMSimulator from '@/components/whitepaper/AMMSimulator';
import WhitepaperSidebar from '@/components/whitepaper/WhitepaperSidebar';

export const metadata: Metadata = {
  title: 'Whitepaper | PNL Platform',
  description: 'PNL (Prediction & Launch) - Tokenizing ideas to fund builders and dreamers worldwide',
  robots: 'noindex, nofollow', // Don't index this page
};

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen">
      {/* Floating Sidebar Navigation */}
      <WhitepaperSidebar />

      {/* Main Content - centered with space for floating sidebar */}
      <div className="space-y-8 p-6 md:p-8 lg:pl-64">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            PNL Whitepaper
          </h1>
          <p className="text-xl text-gray-300">
            Idea Tokenization: Where Dreamers Meet Believers
          </p>
          <div className="mt-6 text-sm text-gray-500">
            <p>Version 1.0 • December 2025</p>
            <p>Solana Mainnet</p>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-xl max-w-none">

          {/* Mission Statement */}
          <section className="mb-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 backdrop-blur-xl rounded-lg p-4 border border-yellow-400/30 max-w-2xl mx-auto">
            <p className="text-lg md:text-xl font-semibold text-center text-white leading-relaxed">
              &quot;Fueling the world&apos;s brilliant ideas — from anywhere, for everyone.&quot;
            </p>
            <p className="text-center text-yellow-400 mt-2 text-sm">
              Yours could be next.
            </p>
          </section>

          {/* Abstract */}
          <section id="abstract" className="mb-12 bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl rounded-lg p-8 border border-blue-400/30 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-4">Abstract</h2>
            <p className="text-gray-300 text-lg leading-relaxed">
              <strong className="text-white">VC funding isn&apos;t accessible to everyone.</strong> The traditional
              path to capital requires connections, geography, and credentials that most brilliant minds simply
              don&apos;t have. Every day, world-changing ideas die—not because they lack merit, but because their
              creators lack access.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed mt-4">
              <strong className="text-white">PNL changes that.</strong> Through <strong className="text-blue-400">Idea Tokenization</strong>,
              builders can transform their vision into something the world can fund. Supporters back ideas they
              believe in and receive tokens in return—becoming early stakeholders in projects they helped make real.
              Builders get the capital they need to keep building. <strong className="text-white">Everyone wins.</strong>
            </p>
            <p className="text-gray-300 text-lg leading-relaxed mt-4">
              The community validates through prediction markets—ensuring only ideas with real believers get funded.
              No gatekeepers. No VC rejections. No knowing the right people. <strong className="text-white">Just
              merit, vision, and a global crowd ready to believe in the next big thing.</strong>
            </p>

            <div className="mt-6 space-y-3">
              <p className="text-green-400 text-base">✅ <strong>For Builders:</strong> Raise capital from believers worldwide—no VCs required</p>
              <p className="text-green-400 text-base">✅ <strong>For Supporters:</strong> Fund ideas you believe in, receive tokens in return</p>
              <p className="text-green-400 text-base">✅ <strong>Community Validated:</strong> Prediction markets filter quality, believers back winners</p>
              <p className="text-green-400 text-base">✅ <strong>Global & Permissionless:</strong> From anywhere, for everyone—0.01 SOL minimum</p>
              <p className="text-green-400 text-base">✅ <strong>Discover Treasures:</strong> Find the next breakthrough before the world does</p>
            </div>
          </section>

          {/* The Problem */}
          <section id="problem" className="mb-12 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-6">The Problem: Capital is Gatekept</h2>

            <p className="text-gray-300 text-lg leading-relaxed mb-4">
              You have a brilliant idea. You&apos;ve done the research, built the prototype, and you know it can change
              the world. But you need capital to make it real. What are your options?
            </p>

            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              <strong className="text-red-400">VCs won&apos;t return your emails.</strong> They fund Stanford dropouts
              and YC alumni—not dreamers in Lagos, Manila, or São Paulo. Less than 1% of startups get funded, and
              it&apos;s rarely about merit. It&apos;s about who you know, where you went to school, and which zip code
              you live in. <strong className="text-white">The system is broken.</strong>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-red-500/10 rounded-lg p-4 border border-red-400/30">
                <p className="text-red-400 font-bold text-lg mb-2">VC Gatekeeping</p>
                <p className="text-gray-400 text-sm">Connections over merit. Geography over vision. Credentials over capability.</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4 border border-red-400/30">
                <p className="text-red-400 font-bold text-lg mb-2">No Global Access</p>
                <p className="text-gray-400 text-sm">Brilliant builders worldwide locked out of capital that flows freely in Silicon Valley.</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4 border border-red-400/30">
                <p className="text-red-400 font-bold text-lg mb-2">Ideas Die Daily</p>
                <p className="text-gray-400 text-sm">World-changing visions fade—not for lack of merit, but lack of access.</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg p-5 border border-blue-400/30">
              <p className="text-gray-300 text-base leading-relaxed">
                <strong className="text-blue-400">Web3 offered hope.</strong> Peer-to-peer funding without intermediaries.
                But there was a missing piece—what do supporters get in return? Donations alone don&apos;t scale.
                People need skin in the game, a reason to believe <em>and</em> benefit.
              </p>
              <p className="text-white text-base leading-relaxed mt-3 font-semibold">
                The answer? Tokenize the idea. Give supporters ownership. Let the crowd become co-founders.
              </p>
            </div>
          </section>

          {/* The Solution */}
          <section id="solution" className="mb-12 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-6">The Solution: Idea Tokenization</h2>

            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl border border-cyan-400/30 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold text-cyan-400 mb-4">Core Insight</h3>
              <p className="text-gray-300 text-base">
                Prediction markets are the most accurate forecasting tools ever created—outperforming polls,
                analysts, and experts across every domain. <strong className="text-white">PNL harnesses this
                collective intelligence to separate brilliant ideas from noise.</strong>
              </p>
              <p className="text-gray-300 text-base mt-3">
                When real money is on the line, people do their homework. <strong className="text-cyan-400">Critics</strong> are
                incentivized to find flaws, while <strong className="text-green-400">Early Supporters</strong> are
                rewarded for spotting winners before anyone else.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl rounded-lg p-6 border border-blue-400/30">
              <h3 className="text-2xl font-semibold text-white mb-4">How Idea Tokenization Works</h3>
              <ol className="text-gray-300 space-y-3 list-decimal list-inside">
                <li><strong>Founder tokenizes their idea:</strong> Create a market for your vision</li>
                <li><strong>Community evaluates:</strong> Early Supporters back it, Critics challenge it</li>
                <li><strong>Price discovery:</strong> The market reveals true sentiment</li>
                <li><strong>Validation gate:</strong> Only ideas with majority support get tokenized</li>
                <li><strong>Presale rewards:</strong> Early Supporters receive 65% of tokens at launch</li>
              </ol>
              <p className="text-green-400 mt-4 font-semibold">
                Result: The world&apos;s best ideas rise to the top. Real treasures get discovered.
              </p>
            </div>
          </section>

          {/* How PNL Works */}
          <section id="how-it-works" className="mb-12 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-6">How PNL Works</h2>

            {/* Complete Lifecycle Diagram - Simplified */}
            <div className="bg-gradient-to-br from-gray-900/50 to-blue-900/20 border border-blue-500/30 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-bold text-white mb-2 text-center">The Journey: From Idea to Token</h3>
              <p className="text-gray-400 text-sm text-center mb-6">
                Every great project starts with a vision. Here&apos;s how PNL turns yours into reality.
              </p>

              {/* Simple 4-step flow */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Step 1 */}
                <div className="text-center">
                  <div className="bg-blue-500 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-3 text-lg">1</div>
                  <h4 className="text-blue-400 font-semibold mb-2">Create</h4>
                  <p className="text-gray-400 text-sm">Founder tokenizes their idea</p>
                  <p className="text-blue-400 text-xs mt-1">0.015 SOL</p>
                </div>

                {/* Step 2 */}
                <div className="text-center">
                  <div className="bg-purple-500 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-3 text-lg">2</div>
                  <h4 className="text-purple-400 font-semibold mb-2">Validate</h4>
                  <p className="text-gray-400 text-sm">Community backs or challenges</p>
                  <p className="text-purple-400 text-xs mt-1">Min 0.01 SOL</p>
                </div>

                {/* Step 3 */}
                <div className="text-center">
                  <div className="bg-green-500 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-3 text-lg">3</div>
                  <h4 className="text-green-400 font-semibold mb-2">Resolve</h4>
                  <p className="text-gray-400 text-sm">Market decides outcome</p>
                  <p className="text-green-400 text-xs mt-1">At expiry</p>
                </div>

                {/* Step 4 */}
                <div className="text-center">
                  <div className="bg-yellow-500 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-3 text-lg">4</div>
                  <h4 className="text-yellow-400 font-semibold mb-2">Launch</h4>
                  <p className="text-gray-400 text-sm">Token goes live on Pump.fun</p>
                  <p className="text-yellow-400 text-xs mt-1">If YES wins</p>
                </div>
              </div>

              {/* Outcomes summary */}
              <div className="mt-6 pt-4 border-t border-gray-700/50">
                <p className="text-gray-400 text-xs text-center mb-3">Three possible outcomes—each one fair.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30 text-center">
                    <p className="text-green-400 font-semibold">YES Wins</p>
                    <p className="text-gray-400 text-xs">Token launches → Early supporters get 65%</p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30 text-center">
                    <p className="text-red-400 font-semibold">NO Wins</p>
                    <p className="text-gray-400 text-xs">No launch → Critics share 95% of pool</p>
                  </div>
                  <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/30 text-center">
                    <p className="text-yellow-400 font-semibold">Tie / Under Target</p>
                    <p className="text-gray-400 text-xs">Everyone gets 98.5% refund</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Phase Details - 2x2 Grid */}
            <p className="text-gray-300 text-base mb-4">
              Let&apos;s break down each phase. The process is simple, transparent, and designed to reward conviction.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-500/10 rounded-lg p-5 border border-blue-400/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center">1</div>
                  <h3 className="text-lg font-semibold text-blue-400">Create</h3>
                </div>
                <p className="text-gray-300 text-sm mb-2">
                  Founder submits their idea with project details, token economics, and target pool size.
                </p>
                <p className="text-blue-400 text-sm">Cost: <strong>0.015 SOL</strong></p>
              </div>

              <div className="bg-purple-500/10 rounded-lg p-5 border border-purple-400/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-purple-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center">2</div>
                  <h3 className="text-lg font-semibold text-purple-400">Validate</h3>
                </div>
                <p className="text-gray-300 text-sm mb-2">
                  Community votes YES or NO. Early supporters back winners, critics filter quality.
                </p>
                <p className="text-purple-400 text-sm">Min: <strong>0.01 SOL</strong> • Fee: <strong>1.5%</strong></p>
              </div>

              <div className="bg-green-500/10 rounded-lg p-5 border border-green-400/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-green-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center">3</div>
                  <h3 className="text-lg font-semibold text-green-400">Resolve</h3>
                </div>
                <p className="text-gray-300 text-sm mb-2">
                  At expiry, shares are counted. More YES shares = launch. More NO shares = critics win.
                </p>
                <p className="text-green-400 text-sm">Completion fee: <strong>5%</strong></p>
              </div>

              <div className="bg-yellow-500/10 rounded-lg p-5 border border-yellow-400/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-yellow-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center">4</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Launch</h3>
                </div>
                <p className="text-gray-300 text-sm mb-2">
                  If YES wins, token launches atomically on Pump.fun. Early supporters get 65% of tokens.
                </p>
                <p className="text-yellow-400 text-sm">Up to <strong>50 SOL</strong> → Pump.fun</p>
              </div>
            </div>

            {/* Token Distribution - Compact */}
            <p className="text-gray-400 text-sm mt-6 mb-3 text-center italic">
              When the community says YES, tokens are distributed fairly—no insiders, no VCs, just believers.
            </p>
            <div className="bg-black/30 rounded-lg p-4 border border-gray-600/30">
              <p className="text-white font-semibold mb-3 text-center">Token Distribution</p>
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-green-400 font-bold text-2xl">65%</p>
                  <p className="text-gray-400">Early Supporters</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-400 font-bold text-2xl">33%</p>
                  <p className="text-gray-400">Founder (vested)</p>
                </div>
                <div className="text-center">
                  <p className="text-purple-400 font-bold text-2xl">2%</p>
                  <p className="text-gray-400">Platform</p>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits - Why should you care? */}
          <section id="benefits" className="mb-12 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-6">Why Build & Invest on PNL?</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl border border-blue-400/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-blue-400 mb-4">For Founders & Dreamers</h3>
                <p className="text-gray-400 text-sm mb-3">Turn your vision into reality</p>
                <ul className="text-gray-300 space-y-2">
                  <li>🌍 <strong>Global capital:</strong> Raise from believers worldwide</li>
                  <li>🚀 <strong>Instant community:</strong> Early supporters become your first fans</li>
                  <li>✅ <strong>Validation:</strong> Know your idea has market demand</li>
                  <li>💰 <strong>Fair deal:</strong> Keep your equity, share tokens</li>
                  <li>⚡ <strong>Fast launch:</strong> Go from idea to token in days</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl border border-green-400/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-green-400 mb-4">For Early Supporters</h3>
                <p className="text-gray-400 text-sm mb-3">Find treasures before the crowd</p>
                <ul className="text-gray-300 space-y-2">
                  <li>💎 <strong>Presale access:</strong> Get tokens at ground floor</li>
                  <li>🎯 <strong>Due diligence pays:</strong> Research → spot winners → profit</li>
                  <li>📈 <strong>65% allocation:</strong> Majority of tokens go to believers</li>
                  <li>🤝 <strong>Direct connection:</strong> Build relationships with founders</li>
                  <li>🔮 <strong>Shape the future:</strong> Back ideas you believe in</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-xl border border-red-400/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-red-400 mb-4">For Critics</h3>
                <p className="text-gray-400 text-sm mb-3">Get paid to filter quality</p>
                <ul className="text-gray-300 space-y-2">
                  <li>🔍 <strong>Quality control:</strong> Your skepticism protects the ecosystem</li>
                  <li>💵 <strong>Earn from flops:</strong> When bad ideas fail, critics profit</li>
                  <li>⚖️ <strong>Balance the market:</strong> Keep hype in check</li>
                  <li>🛡️ <strong>Protect others:</strong> Your NO vote warns the community</li>
                  <li>📊 <strong>95% pool share:</strong> Winners split the pot</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Economics - Token Distribution & Fees */}
          <section id="economics" className="mb-12 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-6">Economics: Fair by Design</h2>

            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Traditional fundraising is unfair. VCs get preferential terms, insider access, and early exits—while
              everyday believers get nothing. <strong className="text-white">PNL flips this model entirely.</strong> Everyone
              plays by the same rules, and the supporters who backed the idea first get the biggest rewards.
            </p>

            {/* Token Distribution Comparison */}
            <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 backdrop-blur-xl border border-green-400/30 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-green-400 mb-4">No VCs. No Insiders. Just Believers.</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div className="bg-black/30 rounded p-4 border border-red-400/20">
                  <p className="text-red-400 font-semibold mb-2">❌ VC-Backed Projects</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• VCs: 50-70% at $0.001</li>
                    <li>• Team: 15-25% at $0.001</li>
                    <li>• Public: 5-10% at $0.10</li>
                    <li className="text-red-400">→ 100x price gap</li>
                  </ul>
                </div>

                <div className="bg-black/30 rounded p-4 border border-green-400/20">
                  <p className="text-green-400 font-semibold mb-2">✅ PNL Distribution</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Early Supporters: <strong>65%</strong></li>
                    <li>• Founder: <strong>33%</strong> (vested)</li>
                    <li>• Platform: <strong>2%</strong></li>
                    <li className="text-green-400">→ Same price for all</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Fee Structure */}
            <p className="text-gray-300 text-base leading-relaxed mb-4">
              Transparency is non-negotiable. Here&apos;s exactly where your SOL goes:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-black/30 rounded-lg p-4 border border-blue-400/20 text-center">
                <p className="text-blue-400 font-bold text-2xl">0.015</p>
                <p className="text-gray-400 text-sm">SOL to create</p>
                <p className="text-gray-500 text-xs">Spam prevention</p>
              </div>
              <div className="bg-black/30 rounded-lg p-4 border border-purple-400/20 text-center">
                <p className="text-purple-400 font-bold text-2xl">1.5%</p>
                <p className="text-gray-400 text-sm">Per vote</p>
                <p className="text-gray-500 text-xs">Platform revenue</p>
              </div>
              <div className="bg-black/30 rounded-lg p-4 border border-emerald-400/20 text-center">
                <p className="text-emerald-400 font-bold text-2xl">5%</p>
                <p className="text-gray-400 text-sm">At resolution</p>
                <p className="text-gray-500 text-xs">Completion fee</p>
              </div>
            </div>

            <p className="text-gray-400 text-base">
              When YES wins, up to 50 SOL goes to Pump.fun for token launch. Any excess above 50 SOL goes to the
              founder (8% immediate, 92% vested over 12 months)—keeping founders committed long-term.
            </p>
          </section>

          {/* Vision & Roadmap */}
          <section id="vision" className="mb-12 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-6">Vision: Where We&apos;re Going</h2>

            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              For too long, tokens and equity have been treated as different things. But what if they&apos;re
              the same—just evolved for the internet age? <strong className="text-white">PNL is pioneering
              Idea Tokenization</strong>—where your vision becomes an asset the world can believe in.
            </p>

            {/* The Big Picture */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-xl rounded-lg p-5 border border-red-400/30">
                <h3 className="text-lg font-semibold text-red-400 mb-3">Traditional VC: Broken</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Less than 1% of startups get funded. The other 99%? Rejected—often not because of merit,
                  but geography, network, or pedigree.
                </p>
                <p className="text-gray-400 text-sm">
                  Brilliant builders in Lagos, Manila, São Paulo—locked out of capital that flows freely
                  in Silicon Valley.
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-lg p-5 border border-green-400/30">
                <h3 className="text-lg font-semibold text-green-400 mb-3">PNL: Borderless</h3>
                <p className="text-gray-300 text-sm mb-3">
                  No rejection—every idea gets a fair shot. Build from anywhere, raise from everywhere.
                  The crowd decides, not gatekeepers.
                </p>
                <p className="text-green-400 text-sm font-semibold">
                  The next unicorn might be building in a bedroom right now. PNL will find them.
                </p>
              </div>
            </div>

            {/* Treasure Hunt */}
            <p className="text-gray-300 text-base leading-relaxed mb-4">
              For early supporters, PNL is a <strong className="text-yellow-400">treasure hunt</strong>—discover
              hidden gems before the world knows about them. Every market is a potential breakthrough waiting
              for believers to back it.
            </p>

            {/* What's Live */}
            <h3 className="text-xl font-semibold text-white mt-8 mb-4">What&apos;s Live Now</h3>
            <p className="text-gray-400 mb-4">
              Community features already shipped and ready to use:
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <div className="bg-black/30 rounded-lg p-3 border border-green-400/30 text-center">
                <p className="text-green-400 font-semibold text-sm">Community Chat</p>
                <p className="text-gray-500 text-xs">Real-time discussions per market</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 border border-green-400/30 text-center">
                <p className="text-green-400 font-semibold text-sm">Voice Rooms</p>
                <p className="text-gray-500 text-xs">Live audio spaces for each project</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 border border-green-400/30 text-center">
                <p className="text-green-400 font-semibold text-sm">AI Analysis</p>
                <p className="text-gray-500 text-xs">Smart project scoring & roasts</p>
              </div>
            </div>

            {/* What's Next */}
            <h3 className="text-xl font-semibold text-white mb-4">What&apos;s Coming Next</h3>
            <p className="text-gray-400 mb-4">
              More features on the roadmap:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 rounded-lg p-3 border border-amber-400/20 text-center">
                <p className="text-amber-400 font-semibold text-sm">Reputation System</p>
                <p className="text-gray-500 text-xs">Track record & credibility scores</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 border border-cyan-400/20 text-center">
                <p className="text-cyan-400 font-semibold text-sm">Teams & Talent</p>
                <p className="text-gray-500 text-xs">Find collaborators for your project</p>
              </div>
            </div>
          </section>

          {/* Technical */}
          <section id="technical" className="mb-12 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-6">Technical Architecture</h2>

            <div className="bg-gradient-to-br from-slate-500/10 to-gray-500/10 backdrop-blur-xl rounded-lg p-6 border border-slate-400/30 mb-6">
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
                    <li>• Automatic PumpSwap graduation</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* On-Chain Program Architecture */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl rounded-lg p-6 border border-blue-400/30 mb-6">
              <h3 className="text-xl font-semibold text-blue-400 mb-4">On-Chain Program Architecture</h3>
              <p className="text-gray-300 text-sm mb-4">
                All funds are held in Program Derived Addresses (PDAs) controlled by the smart contract—not team wallets.
                This ensures trustless, transparent fund management.
              </p>
              <div className="bg-black/30 rounded p-4 font-mono text-sm text-gray-300 border border-blue-400/20">
                <p className="text-blue-400 mb-2">PDA Account Structure:</p>
                <p className="ml-2">├── <span className="text-cyan-400">Market PDA</span> — Stores market state, receives distribution funds</p>
                <p className="ml-2">├── <span className="text-cyan-400">Market Vault PDA</span> — Holds SOL during active voting</p>
                <p className="ml-2">├── <span className="text-cyan-400">Position PDA</span> — Tracks user shares per market (1 per user per market)</p>
                <p className="ml-2">├── <span className="text-cyan-400">Treasury PDA</span> — Collects platform fees (creation, trade, completion)</p>
                <p className="ml-2">├── <span className="text-cyan-400">Team Vesting PDA</span> — 25% token lockup (12-month linear vest)</p>
                <p className="ml-2">└── <span className="text-cyan-400">Founder Vesting PDA</span> — Excess SOL lockup (if pool &gt; 50 SOL)</p>
              </div>
            </div>

            {/* AMM Price Discovery & Simulator - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch">
              {/* AMM Price Discovery */}
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-lg p-6 border border-purple-400/30">
                <h3 className="text-xl font-semibold text-purple-400 mb-4">AMM Price Discovery</h3>

                {/* What is an AMM */}
                <div className="bg-black/20 rounded p-4 border border-purple-400/10 mb-4">
                  <p className="text-white font-semibold mb-2">What is an AMM?</p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    An <strong className="text-purple-300">Automated Market Maker (AMM)</strong> is a smart contract that
                    enables trading without order books. Users trade against liquidity pools using mathematical formulas,
                    ensuring prices reflect real-time supply and demand.
                  </p>
                </div>

                {/* Why Constant Product */}
                <div className="bg-black/20 rounded p-4 border border-purple-400/10 mb-4">
                  <p className="text-white font-semibold mb-2">Why Constant Product?</p>
                  <p className="text-gray-300 text-sm mb-2">
                    PNL uses the <strong className="text-white">x × y = k</strong> formula (same as Uniswap) because:
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• <span className="text-green-400">Self-adjusting</span> — larger trades have more price impact</li>
                    <li>• <span className="text-green-400">Always liquid</span> — you can always buy/sell</li>
                    <li>• <span className="text-green-400">Manipulation-resistant</span> — moving price requires real capital</li>
                    <li>• <span className="text-green-400">Battle-tested</span> — proven across billions in DeFi</li>
                  </ul>
                </div>

                {/* Core Formula */}
                <div className="bg-black/30 rounded p-4 font-mono text-gray-300 border border-purple-400/20 mb-4">
                  <p className="text-purple-400 font-semibold mb-2">Core AMM Formula:</p>
                  <p className="ml-2 text-xl text-white">x × y = k <span className="text-gray-500 text-sm">(constant product)</span></p>
                  <p className="ml-2 mt-2 text-gray-400 text-sm">Where: x = YES pool, y = NO pool, k = constant</p>
                  <p className="ml-2 mt-3 text-purple-400">Derived Price Formulas:</p>
                  <p className="ml-2 text-sm">YES Price = NO_Pool / (YES_Pool + NO_Pool)</p>
                  <p className="ml-2 text-sm">NO Price = YES_Pool / (YES_Pool + NO_Pool)</p>
                  <p className="ml-2 mt-2 text-pink-400 text-sm">→ Prices always sum to 100%</p>
                </div>

                {/* How Trading Works */}
                <div className="grid grid-cols-1 gap-3 mb-4">
                  <div className="bg-black/30 rounded p-4 border border-green-400/20">
                    <p className="text-green-400 font-semibold mb-1">Buying YES</p>
                    <p className="text-gray-300 text-sm">Your SOL → NO pool → YES pool shrinks → You receive YES shares</p>
                    <p className="text-gray-500 text-sm mt-1">Effect: YES price ↑, NO price ↓</p>
                  </div>
                  <div className="bg-black/30 rounded p-4 border border-red-400/20">
                    <p className="text-red-400 font-semibold mb-1">Buying NO</p>
                    <p className="text-gray-300 text-sm">Your SOL → YES pool → NO pool shrinks → You receive NO shares</p>
                    <p className="text-gray-500 text-sm mt-1">Effect: NO price ↑, YES price ↓</p>
                  </div>
                </div>

                {/* Example Trade */}
                <div className="bg-black/30 rounded p-4 font-mono text-sm text-gray-300 border border-cyan-400/20 mb-4">
                  <p className="text-cyan-400 font-semibold mb-2">Example Trade:</p>
                  <p className="text-gray-400">Start: YES=15, NO=15, k=225 → Prices: 50%/50%</p>
                  <p className="text-gray-400 mt-2">User buys YES with 5 SOL:</p>
                  <p className="ml-3 text-gray-300">1. 5 SOL → NO pool (now 20)</p>
                  <p className="ml-3 text-gray-300">2. YES pool = 225/20 = 11.25 (maintain k)</p>
                  <p className="ml-3 text-gray-300">3. Shares = 15 - 11.25 = <span className="text-green-400">3.75 YES</span></p>
                  <p className="text-gray-400 mt-2">After: YES=<span className="text-green-400">64%</span> ↑, NO=<span className="text-red-400">36%</span> ↓</p>
                </div>

                {/* Price Impact */}
                <div className="bg-black/20 rounded p-4 border border-orange-400/20 mb-4">
                  <p className="text-orange-400 font-semibold mb-2">Price Impact & Slippage</p>
                  <p className="text-gray-300 text-sm mb-2">
                    Larger trades move prices more. This is called <strong className="text-white">price impact</strong>:
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Small vote (0.1 SOL) → ~0.3% price move</li>
                    <li>• Medium vote (1 SOL) → ~3% price move</li>
                    <li>• Large vote (10 SOL) → ~25% price move</li>
                  </ul>
                  <p className="text-gray-500 text-sm mt-2 italic">This protects against manipulation—you can&apos;t move prices without real commitment.</p>
                </div>

                {/* Key Insight */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded p-4 border border-yellow-400/30">
                  <p className="text-yellow-400 font-semibold mb-2">Key Insight: Shares Determine Winners</p>
                  <p className="text-gray-300 text-sm mb-3">
                    The winning side is determined by <strong className="text-white">total shares</strong>, not total SOL invested.
                  </p>
                  <div className="bg-black/30 rounded p-3 border border-yellow-400/20 mb-3">
                    <p className="text-sm text-gray-300">
                      <span className="text-green-400">Early voter:</span> 1 SOL @ 50% → <span className="text-white font-semibold">~0.67 shares</span>
                    </p>
                    <p className="text-sm text-gray-300 mt-1">
                      <span className="text-red-400">Late voter:</span> 1 SOL @ 80% → <span className="text-white font-semibold">~0.25 shares</span>
                    </p>
                    <p className="text-sm text-gray-400 mt-2">Same SOL, 2.7x more voting power for early voter!</p>
                  </div>
                  <p className="text-gray-400 text-sm">
                    This rewards <span className="text-green-400">early conviction</span> and discourages
                    <span className="text-red-400"> bandwagon voting</span>—the core of prediction market accuracy.
                  </p>
                </div>
              </div>

              {/* Interactive AMM Simulator */}
              <AMMSimulator />
            </div>

            {/* Atomic Resolution */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-lg p-6 border border-green-400/30 mb-6">
              <h3 className="text-xl font-semibold text-green-400 mb-4">Atomic Token Launch</h3>
              <p className="text-gray-300 text-sm mb-4">
                When YES wins, token creation and distribution happen in a single atomic transaction.
                No intermediary steps where funds could be lost or stuck.
              </p>
              <div className="bg-black/30 rounded p-4 font-mono text-sm text-gray-300 border border-green-400/20">
                <p className="text-green-400 mb-2">Single Transaction Flow:</p>
                <p className="ml-2">1. Create token on Pump.fun (via CPI)</p>
                <p className="ml-2">2. Create market&apos;s Associated Token Account</p>
                <p className="ml-2">3. Buy tokens with pool SOL (up to 50 SOL)</p>
                <p className="ml-2">4. Deduct 5% completion fee to Treasury</p>
                <p className="ml-2">5. Set token allocations (65% YES / 33% Team / 2% Platform)</p>
                <p className="ml-2">6. Mark market as resolved</p>
                <p className="text-green-400 mt-3">✓ All-or-nothing: Either everything succeeds or nothing changes</p>
              </div>
            </div>

            {/* Security Features */}
            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-xl rounded-lg p-6 border border-red-400/30">
              <h3 className="text-xl font-semibold text-red-400 mb-4">Security Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-black/30 rounded p-3 border border-red-400/20">
                  <p className="text-white font-semibold mb-1">One Position Per Wallet</p>
                  <p className="text-gray-400">Users cannot bet on both YES and NO in the same market—prevents manipulation.</p>
                </div>
                <div className="bg-black/30 rounded p-3 border border-red-400/20">
                  <p className="text-white font-semibold mb-1">Permissionless Resolution</p>
                  <p className="text-gray-400">Anyone can resolve a market after expiry—no single point of failure.</p>
                </div>
                <div className="bg-black/30 rounded p-3 border border-red-400/20">
                  <p className="text-white font-semibold mb-1">Vested Token Distribution</p>
                  <p className="text-gray-400">Team tokens vest over 12 months—aligned long-term incentives.</p>
                </div>
                <div className="bg-black/30 rounded p-3 border border-red-400/20">
                  <p className="text-white font-semibold mb-1">Rent Recovery</p>
                  <p className="text-gray-400">Closed accounts return rent to users—no locked SOL.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Join the Revolution - Conclusion + Community */}
          <section id="community" className="mb-12 scroll-mt-28">
            <h2 className="text-3xl font-bold text-white mb-6">Join the Revolution</h2>

            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              The world is full of brilliant ideas waiting to be discovered—and brilliant people waiting
              to discover them. PNL connects the two. Whether you&apos;re a dreamer with a vision, an early
              supporter hunting for the next breakthrough, or a critic keeping the ecosystem honest—
              <strong className="text-white"> this is where you belong.</strong>
            </p>

            {/* Why PNL */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-black/30 rounded-lg p-4 border border-blue-400/20">
                <p className="text-blue-400 font-bold text-lg mb-1">Needed</p>
                <p className="text-gray-400 text-xs">Ideas die for lack of access. PNL fixes that.</p>
              </div>
              <div className="bg-black/30 rounded-lg p-4 border border-green-400/20">
                <p className="text-green-400 font-bold text-lg mb-1">Aligned</p>
                <p className="text-gray-400 text-xs">Everyone wins when quality rises.</p>
              </div>
              <div className="bg-black/30 rounded-lg p-4 border border-purple-400/20">
                <p className="text-purple-400 font-bold text-lg mb-1">Proven</p>
                <p className="text-gray-400 text-xs">Battle-tested AMM + prediction markets.</p>
              </div>
              <div className="bg-black/30 rounded-lg p-4 border border-yellow-400/20">
                <p className="text-yellow-400 font-bold text-lg mb-1">Global</p>
                <p className="text-gray-400 text-xs">The next unicorn could be anywhere.</p>
              </div>
            </div>

            {/* Mission */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl border-2 border-blue-400/40 rounded-lg p-6 mb-8 text-center">
              <p className="text-2xl text-white font-bold mb-2">
                Fueling the world&apos;s brilliant ideas.
              </p>
              <p className="text-gray-400">
                From anywhere, for everyone. Yours could be next.
              </p>
            </div>

            {/* Connect */}
            <h3 className="text-xl font-semibold text-white mb-4">Connect With Us</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="https://x.com/pnldotmarket"
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
                  <p className="text-gray-400 text-sm">@pnldotmarket</p>
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
                  <p className="text-gray-400 text-sm">Join the community</p>
                </div>
              </a>
            </div>
          </section>

          {/* Disclaimer */}
          <section id="disclaimer" className="mb-12 scroll-mt-28">
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
    </div>
  );
}
