'use client';

import { useState, useMemo, useEffect } from 'react';

/**
 * Interactive AMM Simulator for Whitepaper
 * Demonstrates price discovery and payout mechanics
 */
export default function AMMSimulator() {
  // Initial pool size (configurable)
  const [initialPool, setInitialPool] = useState(15);

  const [yesVotes, setYesVotes] = useState(0);
  const [noVotes, setNoVotes] = useState(0);

  // User's personal position
  const [userSol, setUserSol] = useState(1);
  const [userSide, setUserSide] = useState<'YES' | 'NO'>('YES');

  // Token value estimator for YES wins (in SOL per 1% of tokens)
  const [expectedTokenMultiplier, setExpectedTokenMultiplier] = useState(2); // 2x = token doubles in value

  // Clamp votes when pool size changes
  useEffect(() => {
    const maxVotes = initialPool * 3;
    if (yesVotes > maxVotes) setYesVotes(maxVotes);
    if (noVotes > maxVotes) setNoVotes(maxVotes);
  }, [initialPool, yesVotes, noVotes]);

  const calculations = useMemo(() => {
    // Current pool state after votes
    // When buying YES: SOL goes to NO pool
    // When buying NO: SOL goes to YES pool
    const yesPool = initialPool + noVotes;
    const noPool = initialPool + yesVotes;

    // k = initial constant product
    const k = initialPool * initialPool;

    // Calculate shares received using constant product
    // For YES: shares = initial_yes - (k / new_no_pool)
    // For NO: shares = initial_no - (k / new_yes_pool)
    const yesShares = noVotes > 0
      ? initialPool - (k / (initialPool + noVotes))
      : 0;
    const noShares = yesVotes > 0
      ? initialPool - (k / (initialPool + yesVotes))
      : 0;

    // Actually, let me recalculate this properly
    // When someone buys YES with X SOL:
    // - X SOL goes to NO pool (noPool increases)
    // - YES shares come out of YES pool
    // - New YES pool = k / new NO pool
    // - Shares received = old YES pool - new YES pool

    // Let's track cumulative shares properly
    let cumYesShares = 0;
    let cumNoShares = 0;
    let currentYesPool = initialPool;
    let currentNoPool = initialPool;

    // Simulate YES votes (each 1 SOL at a time for accuracy)
    for (let i = 0; i < yesVotes; i++) {
      const solAmount = 1;
      const newNoPool = currentNoPool + solAmount;
      const newYesPool = k / newNoPool;
      const sharesReceived = currentYesPool - newYesPool;
      cumYesShares += sharesReceived;
      currentYesPool = newYesPool;
      currentNoPool = newNoPool;
    }

    // Reset for NO calculation
    currentYesPool = initialPool;
    currentNoPool = initialPool;

    // Simulate NO votes
    for (let i = 0; i < noVotes; i++) {
      const solAmount = 1;
      const newYesPool = currentYesPool + solAmount;
      const newNoPool = k / newYesPool;
      const sharesReceived = currentNoPool - newNoPool;
      cumNoShares += sharesReceived;
      currentNoPool = newNoPool;
      currentYesPool = newYesPool;
    }

    // Final pool state (approximate - for display)
    const finalYesPool = initialPool + noVotes;
    const finalNoPool = initialPool + yesVotes;

    // Prices
    const totalPool = finalYesPool + finalNoPool;
    const yesPrice = totalPool > 0 ? (finalNoPool / totalPool) * 100 : 50;
    const noPrice = totalPool > 0 ? (finalYesPool / totalPool) * 100 : 50;

    // Total SOL in market (for payouts)
    const totalSol = yesVotes + noVotes;
    const poolAfterFee = totalSol * 0.95; // 5% completion fee

    // Determine winner
    const totalYesShares = cumYesShares;
    const totalNoShares = cumNoShares;
    const yesWins = totalYesShares > totalNoShares;
    const noWins = totalNoShares > totalYesShares;
    const tie = totalYesShares === totalNoShares;

    // Share percentages
    const totalShares = totalYesShares + totalNoShares;
    const yesSharePercent = totalShares > 0 ? (totalYesShares / totalShares) * 100 : 50;
    const noSharePercent = totalShares > 0 ? (totalNoShares / totalShares) * 100 : 50;

    return {
      yesPool: finalYesPool,
      noPool: finalNoPool,
      yesPrice,
      noPrice,
      totalSol,
      poolAfterFee,
      totalYesShares,
      totalNoShares,
      yesSharePercent,
      noSharePercent,
      yesWins,
      noWins,
      tie,
      k,
    };
  }, [yesVotes, noVotes, initialPool]);

  // Calculate user's position
  const userPosition = useMemo(() => {
    if (userSol <= 0) return null;

    // Calculate shares user would receive at current market state
    const currentYesPool = initialPool + noVotes;
    const currentNoPool = initialPool + yesVotes;
    const k = initialPool * initialPool;

    let userShares = 0;
    if (userSide === 'YES') {
      // User buys YES: SOL goes to NO pool
      const newNoPool = currentNoPool + userSol;
      const newYesPool = k / newNoPool;
      userShares = currentYesPool - newYesPool;
    } else {
      // User buys NO: SOL goes to YES pool
      const newYesPool = currentYesPool + userSol;
      const newNoPool = k / newYesPool;
      userShares = currentNoPool - newNoPool;
    }

    // Calculate new totals including user
    const newTotalYes = calculations.totalYesShares + (userSide === 'YES' ? userShares : 0);
    const newTotalNo = calculations.totalNoShares + (userSide === 'NO' ? userShares : 0);
    const newTotalSol = calculations.totalSol + userSol;
    const newPoolAfterFee = newTotalSol * 0.95;

    // User's share percentage of their side
    const userSideTotal = userSide === 'YES' ? newTotalYes : newTotalNo;
    const userSharePercent = userSideTotal > 0 ? (userShares / userSideTotal) * 100 : 0;

    // Determine winner with user's vote
    const yesWinsWithUser = newTotalYes > newTotalNo;
    const noWinsWithUser = newTotalNo > newTotalYes;

    // Calculate payout
    let payout = 0;
    let payoutType = '';
    let tokenPercent = 0;
    let estimatedTokenValue = 0;

    if (userSide === 'YES' && yesWinsWithUser) {
      // YES wins: user gets proportional tokens (65% of total)
      payoutType = 'tokens';
      tokenPercent = (userSharePercent / 100) * 65; // actual % of total token supply
      payout = tokenPercent;
      // Estimate token value: pool SOL * multiplier * user's token share
      // Total tokens bought with pool SOL, user gets tokenPercent of that
      estimatedTokenValue = (newPoolAfterFee * expectedTokenMultiplier) * (tokenPercent / 100);
    } else if (userSide === 'NO' && noWinsWithUser) {
      // NO wins: user gets proportional SOL
      payoutType = 'SOL';
      payout = (userShares / newTotalNo) * newPoolAfterFee;
    } else if ((userSide === 'YES' && noWinsWithUser) || (userSide === 'NO' && yesWinsWithUser)) {
      payoutType = 'loss';
      payout = 0;
    }

    // Calculate ROI
    let roi = 0;
    if (payoutType === 'SOL' && userSol > 0) {
      roi = ((payout - userSol) / userSol) * 100;
    } else if (payoutType === 'tokens' && userSol > 0) {
      roi = ((estimatedTokenValue - userSol) / userSol) * 100;
    }

    return {
      shares: userShares,
      sharePercent: userSharePercent,
      payout,
      payoutType,
      roi,
      tokenPercent,
      estimatedTokenValue,
      yesWinsWithUser,
      noWinsWithUser,
      newTotalYes,
      newTotalNo,
      newPoolAfterFee,
    };
  }, [userSol, userSide, calculations, yesVotes, noVotes, initialPool, expectedTokenMultiplier]);

  const resetSimulation = () => {
    setYesVotes(0);
    setNoVotes(0);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-lg p-6 border border-indigo-400/30">
      <h3 className="text-xl font-semibold text-indigo-400 mb-2">Interactive AMM Simulator</h3>
      <p className="text-gray-400 text-sm mb-6">
        Experiment with votes to see how prices and payouts change in real-time.
      </p>

      {/* Initial Pool Size */}
      <div className="mb-6 bg-black/30 rounded-lg p-4 border border-indigo-500/30">
        <label className="block text-indigo-400 font-semibold mb-2">Initial Pool Size (SOL)</label>
        <p className="text-gray-500 text-xs mb-3">Starting liquidity in each pool (YES and NO start equal)</p>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {[5, 10, 15, 25, 50].map((size) => (
              <button
                key={size}
                onClick={() => setInitialPool(size)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  initialPool === size
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <span className="text-gray-400 text-sm">or</span>
          <input
            type="number"
            min="1"
            max="100"
            value={initialPool}
            onChange={(e) => setInitialPool(Math.max(1, Number(e.target.value)))}
            className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <p className="text-gray-500 text-xs mt-2">k = {initialPool} × {initialPool} = {initialPool * initialPool}</p>
      </div>

      {/* Vote Controls */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/30 rounded-lg p-4 border border-green-500/30">
          <label className="block text-green-400 font-semibold mb-2">YES Votes (SOL)</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max={initialPool * 3}
              value={yesVotes}
              onChange={(e) => setYesVotes(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <span className="text-white font-mono w-12 text-right">{yesVotes}</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Max: {initialPool * 3} SOL</p>
        </div>

        <div className="bg-black/30 rounded-lg p-4 border border-red-500/30">
          <label className="block text-red-400 font-semibold mb-2">NO Votes (SOL)</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max={initialPool * 3}
              value={noVotes}
              onChange={(e) => setNoVotes(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <span className="text-white font-mono w-12 text-right">{noVotes}</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Max: {initialPool * 3} SOL</p>
        </div>
      </div>

      {/* Price Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-green-400">YES: {calculations.yesPrice.toFixed(1)}%</span>
          <span className="text-red-400">NO: {calculations.noPrice.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
          <div
            className="bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
            style={{ width: `${calculations.yesPrice}%` }}
          />
          <div
            className="bg-gradient-to-r from-red-400 to-red-500 transition-all duration-300"
            style={{ width: `${calculations.noPrice}%` }}
          />
        </div>
        <p className="text-center text-gray-500 text-xs mt-1">Price (Probability)</p>
      </div>

      {/* Share Distribution */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm mb-2">Share Distribution (determines winner):</p>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-green-400">YES: {calculations.yesSharePercent.toFixed(1)}%</span>
          <span className="text-red-400">NO: {calculations.noSharePercent.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
          <div
            className="bg-gradient-to-r from-green-600 to-green-500 transition-all duration-300"
            style={{ width: `${calculations.yesSharePercent}%` }}
          />
          <div
            className="bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300"
            style={{ width: `${calculations.noSharePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{calculations.totalYesShares.toFixed(2)} shares</span>
          <span>{calculations.totalNoShares.toFixed(2)} shares</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
        <div className="bg-black/30 rounded p-3 text-center border border-gray-600/30">
          <p className="text-gray-400">Total Pool</p>
          <p className="text-white font-semibold">{calculations.totalSol} SOL</p>
        </div>
        <div className="bg-black/30 rounded p-3 text-center border border-gray-600/30">
          <p className="text-gray-400">After 5% Completion</p>
          <p className="text-white font-semibold">{calculations.poolAfterFee.toFixed(2)} SOL</p>
        </div>
        <div className="bg-black/30 rounded p-3 text-center border border-gray-600/30">
          <p className="text-gray-400">k (constant)</p>
          <p className="text-white font-semibold">{calculations.k}</p>
        </div>
      </div>

      {/* Fee Breakdown */}
      <div className="bg-black/20 rounded-lg p-3 mb-6 border border-gray-700/50">
        <p className="text-gray-400 text-xs font-semibold mb-2">Fee Structure:</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Trade fee (per vote):</span>
            <span className="text-gray-300">1.5%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Completion fee (at resolution):</span>
            <span className="text-gray-300">5%</span>
          </div>
        </div>
      </div>

      {/* Outcome Prediction */}
      {calculations.totalSol > 0 && (
        <div className={`rounded-lg p-4 border ${
          calculations.yesWins
            ? 'bg-green-500/10 border-green-500/30'
            : calculations.noWins
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <p className={`font-semibold mb-2 ${
            calculations.yesWins ? 'text-green-400' : calculations.noWins ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {calculations.yesWins ? '🚀 YES Wins!' : calculations.noWins ? '📉 NO Wins!' : '⚖️ Tie - Refund'}
          </p>

          {calculations.yesWins && (
            <div className="text-sm text-gray-300">
              <p>• Token launches on Pump.fun</p>
              <p>• YES voters share <span className="text-green-400">65% of tokens</span> proportionally</p>
              <p>• Your share = (your YES shares / {calculations.totalYesShares.toFixed(2)}) × 65%</p>
            </div>
          )}

          {calculations.noWins && (
            <div className="text-sm text-gray-300">
              <p>• NO voters share <span className="text-red-400">{calculations.poolAfterFee.toFixed(2)} SOL</span> (95% of pool)</p>
              <p>• Your payout = (your NO shares / {calculations.totalNoShares.toFixed(2)}) × {calculations.poolAfterFee.toFixed(2)} SOL</p>
              <p className="text-gray-500 mt-1">• YES voters receive nothing</p>
            </div>
          )}

          {calculations.tie && (
            <div className="text-sm text-gray-300">
              <p>• All participants receive <span className="text-yellow-400">98.5% refund</span></p>
              <p>• 1.5% trade fee was already paid during voting</p>
            </div>
          )}
        </div>
      )}

      {/* Your Position Calculator */}
      <div className="mt-6 pt-6 border-t border-indigo-400/20">
        <h4 className="text-lg font-semibold text-indigo-400 mb-4">Calculate Your Position</h4>
        <p className="text-gray-400 text-sm mb-4">
          Enter your vote amount and side to see your potential shares and payout.
        </p>

        {/* Payout Explanation */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="bg-green-500/10 rounded p-2 border border-green-500/20">
            <p className="text-green-400 font-semibold">If YES wins:</p>
            <p className="text-gray-400">YES voters get <span className="text-white">TOKENS</span> (65% of supply)</p>
          </div>
          <div className="bg-red-500/10 rounded p-2 border border-red-500/20">
            <p className="text-red-400 font-semibold">If NO wins:</p>
            <p className="text-gray-400">NO voters get <span className="text-white">SOL</span> (95% of pool)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Vote Amount */}
          <div className="bg-black/30 rounded-lg p-4 border border-indigo-500/30">
            <label className="block text-indigo-400 font-semibold mb-2">Your Vote (SOL)</label>
            <input
              type="number"
              min="0.01"
              max="1000"
              step="0.1"
              value={userSol}
              onChange={(e) => setUserSol(Math.max(0, Number(e.target.value)))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Side Selection */}
          <div className="bg-black/30 rounded-lg p-4 border border-indigo-500/30">
            <label className="block text-indigo-400 font-semibold mb-2">Your Side</label>
            <div className="flex gap-2">
              <button
                onClick={() => setUserSide('YES')}
                className={`flex-1 py-2 rounded font-semibold transition-colors ${
                  userSide === 'YES'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                YES
              </button>
              <button
                onClick={() => setUserSide('NO')}
                className={`flex-1 py-2 rounded font-semibold transition-colors ${
                  userSide === 'NO'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                NO
              </button>
            </div>
          </div>
        </div>

        {/* User Position Results */}
        {userPosition && (
          <div className={`rounded-lg p-4 border ${
            userSide === 'YES' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Shares You&apos;d Receive</p>
                <p className={`text-2xl font-bold ${userSide === 'YES' ? 'text-green-400' : 'text-red-400'}`}>
                  {userPosition.shares.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Your % of {userSide} Side</p>
                <p className={`text-2xl font-bold ${userSide === 'YES' ? 'text-green-400' : 'text-red-400'}`}>
                  {userPosition.sharePercent.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Outcome with user's vote */}
            <div className="bg-black/30 rounded p-3 border border-gray-600/30">
              <p className="text-gray-400 text-sm mb-2">With your {userSol} SOL {userSide} vote:</p>

              {userPosition.yesWinsWithUser && userSide === 'YES' && (
                <div className="text-green-400">
                  <p className="font-semibold">🚀 YES would win! → You receive TOKENS</p>
                  <p className="text-sm mt-1">
                    Token allocation: <span className="font-bold">{userPosition.tokenPercent.toFixed(2)}%</span> of total supply
                  </p>
                  <div className="mt-3 p-2 bg-black/30 rounded border border-green-500/20">
                    <p className="text-xs text-gray-400 mb-2">Estimate token value (if token {expectedTokenMultiplier}x):</p>
                    <div className="flex items-center gap-2 mb-2">
                      {[1, 2, 5, 10].map((mult) => (
                        <button
                          key={mult}
                          onClick={() => setExpectedTokenMultiplier(mult)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            expectedTokenMultiplier === mult
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {mult}x
                        </button>
                      ))}
                    </div>
                    <p className="text-sm">
                      Est. value: <span className="font-bold text-white">{userPosition.estimatedTokenValue.toFixed(4)} SOL</span>
                    </p>
                    <p className={`text-sm ${userPosition.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Est. ROI: {userPosition.roi >= 0 ? '+' : ''}{userPosition.roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              {userPosition.noWinsWithUser && userSide === 'NO' && (
                <div className="text-red-400">
                  <p className="font-semibold">📉 NO would win! → You receive SOL</p>
                  <div className="mt-2 p-2 bg-black/30 rounded border border-red-500/20">
                    <p className="text-sm">
                      SOL payout: <span className="font-bold text-white">{userPosition.payout.toFixed(4)} SOL</span>
                    </p>
                    <p className={`text-sm ${userPosition.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ROI: {userPosition.roi >= 0 ? '+' : ''}{userPosition.roi.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      (Your share of 95% pool: {userPosition.newPoolAfterFee.toFixed(2)} SOL)
                    </p>
                  </div>
                </div>
              )}

              {userPosition.payoutType === 'loss' && (
                <div className="text-gray-400">
                  <p className="font-semibold">❌ {userSide === 'YES' ? 'NO' : 'YES'} would win</p>
                  <p className="text-sm mt-1">You would receive nothing (your side loses)</p>
                </div>
              )}

              {!userPosition.yesWinsWithUser && !userPosition.noWinsWithUser && (
                <div className="text-yellow-400">
                  <p className="font-semibold">⚖️ Tie - 98.5% Refund</p>
                  <p className="text-sm mt-1">You&apos;d get {(userSol * 0.985).toFixed(4)} SOL back</p>
                  <p className="text-xs text-gray-500 mt-1">(1.5% trade fee already paid during voting)</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reset Button */}
      <button
        onClick={resetSimulation}
        className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
      >
        Reset Simulation
      </button>

      {/* Note */}
      <p className="text-gray-500 text-xs mt-4 text-center">
        * Simplified simulation. Trade fees (1.5%) are not deducted from displayed amounts.
        Actual on-chain calculations include all fee deductions.
      </p>
    </div>
  );
}
