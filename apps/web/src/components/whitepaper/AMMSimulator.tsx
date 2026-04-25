'use client';

import { useState, useMemo, useEffect } from 'react';

// ── Cosmic-plant palette ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

/**
 * Interactive AMM Simulator for the whitepaper.
 * Demonstrates price discovery, share accumulation, and payout mechanics
 * in PNL's prediction-market AMM. All calculations preserved verbatim from
 * the previous gradient-themed version — only visuals swapped to cosmic-plant.
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
  const [expectedTokenMultiplier, setExpectedTokenMultiplier] = useState(2);

  // Clamp votes when pool size changes
  useEffect(() => {
    const maxVotes = initialPool * 3;
    if (yesVotes > maxVotes) setYesVotes(maxVotes);
    if (noVotes > maxVotes) setNoVotes(maxVotes);
  }, [initialPool, yesVotes, noVotes]);

  const calculations = useMemo(() => {
    const yesPool = initialPool + noVotes;
    const noPool = initialPool + yesVotes;
    const k = initialPool * initialPool;

    let cumYesShares = 0;
    let cumNoShares = 0;
    let currentYesPool = initialPool;
    let currentNoPool = initialPool;

    for (let i = 0; i < yesVotes; i++) {
      const solAmount = 1;
      const newNoPool = currentNoPool + solAmount;
      const newYesPool = k / newNoPool;
      const sharesReceived = currentYesPool - newYesPool;
      cumYesShares += sharesReceived;
      currentYesPool = newYesPool;
      currentNoPool = newNoPool;
    }

    currentYesPool = initialPool;
    currentNoPool = initialPool;

    for (let i = 0; i < noVotes; i++) {
      const solAmount = 1;
      const newYesPool = currentYesPool + solAmount;
      const newNoPool = k / newYesPool;
      const sharesReceived = currentNoPool - newNoPool;
      cumNoShares += sharesReceived;
      currentNoPool = newNoPool;
      currentYesPool = newYesPool;
    }

    const finalYesPool = initialPool + noVotes;
    const finalNoPool = initialPool + yesVotes;

    const totalPool = finalYesPool + finalNoPool;
    const yesPrice = totalPool > 0 ? (finalNoPool / totalPool) * 100 : 50;
    const noPrice = totalPool > 0 ? (finalYesPool / totalPool) * 100 : 50;

    const totalSol = yesVotes + noVotes;
    const poolAfterFee = totalSol * 0.95;

    const totalYesShares = cumYesShares;
    const totalNoShares = cumNoShares;
    const yesWins = totalYesShares > totalNoShares;
    const noWins = totalNoShares > totalYesShares;
    const tie = totalYesShares === totalNoShares;

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

  const userPosition = useMemo(() => {
    if (userSol <= 0) return null;

    const currentYesPool = initialPool + noVotes;
    const currentNoPool = initialPool + yesVotes;
    const k = initialPool * initialPool;

    let userShares = 0;
    if (userSide === 'YES') {
      const newNoPool = currentNoPool + userSol;
      const newYesPool = k / newNoPool;
      userShares = currentYesPool - newYesPool;
    } else {
      const newYesPool = currentYesPool + userSol;
      const newNoPool = k / newYesPool;
      userShares = currentNoPool - newNoPool;
    }

    const newTotalYes = calculations.totalYesShares + (userSide === 'YES' ? userShares : 0);
    const newTotalNo = calculations.totalNoShares + (userSide === 'NO' ? userShares : 0);
    const newTotalSol = calculations.totalSol + userSol;
    const newPoolAfterFee = newTotalSol * 0.95;

    const userSideTotal = userSide === 'YES' ? newTotalYes : newTotalNo;
    const userSharePercent = userSideTotal > 0 ? (userShares / userSideTotal) * 100 : 0;

    const yesWinsWithUser = newTotalYes > newTotalNo;
    const noWinsWithUser = newTotalNo > newTotalYes;

    let payout = 0;
    let payoutType = '';
    let tokenPercent = 0;
    let estimatedTokenValue = 0;

    if (userSide === 'YES' && yesWinsWithUser) {
      payoutType = 'tokens';
      tokenPercent = (userSharePercent / 100) * 65;
      payout = tokenPercent;
      estimatedTokenValue = (newPoolAfterFee * expectedTokenMultiplier) * (tokenPercent / 100);
    } else if (userSide === 'NO' && noWinsWithUser) {
      payoutType = 'SOL';
      payout = (userShares / newTotalNo) * newPoolAfterFee;
    } else if ((userSide === 'YES' && noWinsWithUser) || (userSide === 'NO' && yesWinsWithUser)) {
      payoutType = 'loss';
      payout = 0;
    }

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

  // Reusable preset chip (for pool size + token multiplier)
  const Chip = ({
    active,
    onClick,
    color = AMBER,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    color?: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className="mono uppercase tracking-[0.2em] text-[0.55rem] px-2.5 py-1.5 transition-colors"
      style={{
        background: active ? color : 'transparent',
        color: active ? BG : CREAM_DIM,
        border: `1px solid ${active ? color : HAIR_STRONG}`,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = CREAM;
          e.currentTarget.style.borderColor = color + '88';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = CREAM_DIM;
          e.currentTarget.style.borderColor = HAIR_STRONG;
        }
      }}
    >
      {children}
    </button>
  );

  return (
    <div
      className="p-5 sm:p-6"
      style={{
        background: 'rgba(232,150,96,0.04)',
        border: `1px solid ${AMBER}33`,
      }}
    >
      <p
        className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-2"
        style={{ color: AMBER }}
      >
        Live simulator
      </p>
      <h3
        className="mb-1.5"
        style={{
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontWeight: 350,
          fontSize: '1.45rem',
        }}
      >
        Watch the AMM breathe
      </h3>
      <p
        className="italic mb-6"
        style={{
          color: CREAM_DIM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontStyle: 'italic',
          fontSize: '0.9rem',
        }}
      >
        Move the sliders. See how prices, shares, and payouts shift in real time.
      </p>

      {/* Initial pool size */}
      <div
        className="mb-6 p-4"
        style={{
          background: 'rgba(244,238,228,0.025)',
          border: `1px solid ${HAIR_STRONG}`,
        }}
      >
        <p
          className="mono uppercase tracking-[0.24em] text-[0.55rem] mb-1"
          style={{ color: AMBER }}
        >
          Initial pool size · SOL
        </p>
        <p
          className="italic mb-3"
          style={{
            color: CREAM_DIM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            fontSize: '0.78rem',
          }}
        >
          Starting liquidity in each pool — YES and NO start equal.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {[5, 10, 15, 25, 50].map((size) => (
              <Chip
                key={size}
                active={initialPool === size}
                onClick={() => setInitialPool(size)}
              >
                {size}
              </Chip>
            ))}
          </div>
          <span
            className="mono uppercase tracking-[0.2em] text-[0.55rem]"
            style={{ color: CREAM_FAINT }}
          >
            or
          </span>
          <input
            type="number"
            min="1"
            max="100"
            value={initialPool}
            onChange={(e) => setInitialPool(Math.max(1, Number(e.target.value)))}
            className="w-20 px-2 py-1.5 text-sm focus:outline-none transition-colors"
            style={{
              background: 'transparent',
              color: CREAM,
              border: `1px solid ${HAIR_STRONG}`,
              fontFamily: 'var(--font-mono, monospace)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = AMBER)}
            onBlur={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
          />
        </div>
        <p
          className="mono text-[0.55rem] mt-3"
          style={{ color: CREAM_FAINT, letterSpacing: '0.04em' }}
        >
          k = {initialPool} × {initialPool} = {initialPool * initialPool}
        </p>
      </div>

      {/* Vote sliders */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div
          className="p-4"
          style={{
            background: `${FOREST}0d`,
            border: `1px solid ${FOREST}55`,
          }}
        >
          <p
            className="mono uppercase tracking-[0.24em] text-[0.55rem] mb-2"
            style={{ color: FOREST }}
          >
            YES votes · SOL
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max={initialPool * 3}
              value={yesVotes}
              onChange={(e) => setYesVotes(Number(e.target.value))}
              className="flex-1 h-1 cursor-pointer"
              style={{ accentColor: FOREST }}
            />
            <span
              className="mono w-12 text-right text-[0.85rem]"
              style={{
                color: CREAM,
                letterSpacing: '0.04em',
                fontFeatureSettings: '"tnum" on',
              }}
            >
              {yesVotes}
            </span>
          </div>
          <p
            className="mono uppercase tracking-[0.2em] text-[0.5rem] mt-2"
            style={{ color: CREAM_FAINT }}
          >
            Max: {initialPool * 3} SOL
          </p>
        </div>

        <div
          className="p-4"
          style={{
            background: `${EARTH}0d`,
            border: `1px solid ${EARTH}55`,
          }}
        >
          <p
            className="mono uppercase tracking-[0.24em] text-[0.55rem] mb-2"
            style={{ color: EARTH }}
          >
            NO votes · SOL
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max={initialPool * 3}
              value={noVotes}
              onChange={(e) => setNoVotes(Number(e.target.value))}
              className="flex-1 h-1 cursor-pointer"
              style={{ accentColor: EARTH }}
            />
            <span
              className="mono w-12 text-right text-[0.85rem]"
              style={{
                color: CREAM,
                letterSpacing: '0.04em',
                fontFeatureSettings: '"tnum" on',
              }}
            >
              {noVotes}
            </span>
          </div>
          <p
            className="mono uppercase tracking-[0.2em] text-[0.5rem] mt-2"
            style={{ color: CREAM_FAINT }}
          >
            Max: {initialPool * 3} SOL
          </p>
        </div>
      </div>

      {/* Price bar */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-1.5 mono uppercase tracking-[0.22em] text-[0.55rem]">
          <span style={{ color: FOREST }}>YES · {calculations.yesPrice.toFixed(1)}%</span>
          <span style={{ color: EARTH }}>{calculations.noPrice.toFixed(1)}% · NO</span>
        </div>
        <div className="h-3 overflow-hidden flex" style={{ background: HAIR }}>
          <div
            className="transition-all duration-300"
            style={{
              width: `${calculations.yesPrice}%`,
              background: FOREST,
            }}
          />
          <div
            className="transition-all duration-300"
            style={{
              width: `${calculations.noPrice}%`,
              background: 'rgba(214,115,71,0.7)',
            }}
          />
        </div>
        <p
          className="mono uppercase tracking-[0.22em] text-[0.5rem] text-center mt-1.5"
          style={{ color: CREAM_FAINT }}
        >
          Price · probability
        </p>
      </div>

      {/* Share distribution */}
      <div className="mb-6">
        <p
          className="mono uppercase tracking-[0.24em] text-[0.55rem] mb-1.5"
          style={{ color: CREAM_DIM }}
        >
          Share distribution · determines winner
        </p>
        <div className="flex justify-between items-center mb-1 mono uppercase tracking-[0.22em] text-[0.55rem]">
          <span style={{ color: FOREST }}>YES · {calculations.yesSharePercent.toFixed(1)}%</span>
          <span style={{ color: EARTH }}>{calculations.noSharePercent.toFixed(1)}% · NO</span>
        </div>
        <div className="h-3 overflow-hidden flex" style={{ background: HAIR }}>
          <div
            className="transition-all duration-300"
            style={{
              width: `${calculations.yesSharePercent}%`,
              background: FOREST,
            }}
          />
          <div
            className="transition-all duration-300"
            style={{
              width: `${calculations.noSharePercent}%`,
              background: 'rgba(214,115,71,0.7)',
            }}
          />
        </div>
        <div
          className="flex justify-between mono text-[0.55rem] mt-1.5"
          style={{
            color: CREAM_FAINT,
            letterSpacing: '0.04em',
            fontFeatureSettings: '"tnum" on',
          }}
        >
          <span>{calculations.totalYesShares.toFixed(2)} shares</span>
          <span>{calculations.totalNoShares.toFixed(2)} shares</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Total pool', value: `${calculations.totalSol} SOL`, color: AMBER },
          { label: 'After 5% fee', value: `${calculations.poolAfterFee.toFixed(2)} SOL`, color: PEACH },
          { label: 'k constant', value: String(calculations.k), color: CREAM_DIM },
        ].map((s) => (
          <div
            key={s.label}
            className="p-3 text-center"
            style={{
              background: 'rgba(244,238,228,0.025)',
              border: `1px solid ${HAIR}`,
            }}
          >
            <p
              className="mono uppercase tracking-[0.22em] text-[0.5rem] mb-1"
              style={{ color: CREAM_FAINT }}
            >
              {s.label}
            </p>
            <p
              className="mono"
              style={{
                color: s.color,
                fontSize: '0.85rem',
                letterSpacing: '0.04em',
                fontFeatureSettings: '"tnum" on',
              }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Fee breakdown */}
      <div
        className="p-3 mb-6"
        style={{
          background: 'rgba(244,238,228,0.025)',
          border: `1px solid ${HAIR}`,
        }}
      >
        <p
          className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-2"
          style={{ color: AMBER }}
        >
          Fee structure
        </p>
        <div className="grid grid-cols-2 gap-2 mono text-[0.6rem]">
          <div className="flex justify-between" style={{ color: CREAM_DIM }}>
            <span style={{ color: CREAM_FAINT }}>Trade fee</span>
            <span>1.5%</span>
          </div>
          <div className="flex justify-between" style={{ color: CREAM_DIM }}>
            <span style={{ color: CREAM_FAINT }}>Completion fee</span>
            <span>5%</span>
          </div>
        </div>
      </div>

      {/* Outcome */}
      {calculations.totalSol > 0 && (
        <div
          className="p-4"
          style={{
            background: calculations.yesWins
              ? `${FOREST}11`
              : calculations.noWins
              ? `${EARTH}11`
              : `${PEACH}11`,
            border: `1px solid ${
              calculations.yesWins ? FOREST + '55' : calculations.noWins ? EARTH + '55' : PEACH + '55'
            }`,
          }}
        >
          <p
            className="mono uppercase tracking-[0.26em] text-[0.6rem] mb-2"
            style={{
              color: calculations.yesWins ? FOREST : calculations.noWins ? EARTH : PEACH,
            }}
          >
            {calculations.yesWins
              ? 'YES wins'
              : calculations.noWins
              ? 'NO wins'
              : 'Tie · refund'}
          </p>

          {calculations.yesWins && (
            <div
              className="text-sm space-y-1"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '0.85rem',
                lineHeight: 1.6,
              }}
            >
              <p>Token launches on Pump.fun.</p>
              <p>
                YES voters share <strong style={{ color: FOREST }}>65% of tokens</strong>{' '}
                proportionally.
              </p>
              <p style={{ color: CREAM_FAINT, fontStyle: 'italic' }}>
                Your share = (your YES shares ÷ {calculations.totalYesShares.toFixed(2)}) × 65%
              </p>
            </div>
          )}

          {calculations.noWins && (
            <div
              className="text-sm space-y-1"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '0.85rem',
                lineHeight: 1.6,
              }}
            >
              <p>
                NO voters share{' '}
                <strong style={{ color: EARTH }}>
                  {calculations.poolAfterFee.toFixed(2)} SOL
                </strong>{' '}
                — 95% of pool.
              </p>
              <p style={{ color: CREAM_FAINT, fontStyle: 'italic' }}>
                Your payout = (your NO shares ÷ {calculations.totalNoShares.toFixed(2)}) ×{' '}
                {calculations.poolAfterFee.toFixed(2)} SOL
              </p>
              <p style={{ color: CREAM_FAINT }}>YES voters receive nothing.</p>
            </div>
          )}

          {calculations.tie && (
            <div
              className="text-sm space-y-1"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '0.85rem',
                lineHeight: 1.6,
              }}
            >
              <p>
                All participants receive a{' '}
                <strong style={{ color: PEACH }}>98.5% refund</strong>.
              </p>
              <p style={{ color: CREAM_FAINT, fontStyle: 'italic' }}>
                The 1.5% trade fee was already paid during voting.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Your position */}
      <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${HAIR}` }}>
        <p
          className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-1.5"
          style={{ color: AMBER }}
        >
          Your position
        </p>
        <h4
          className="mb-3"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontWeight: 350,
            fontSize: '1.15rem',
          }}
        >
          Calculate what you'd earn
        </h4>

        {/* Payout legend */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div
            className="p-2.5"
            style={{ background: `${FOREST}0d`, border: `1px solid ${FOREST}33` }}
          >
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: FOREST }}
            >
              If YES wins
            </p>
            <p
              className="text-[0.78rem] mt-0.5"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
              }}
            >
              YES voters get <strong style={{ color: CREAM }}>tokens</strong> (65% of supply)
            </p>
          </div>
          <div
            className="p-2.5"
            style={{ background: `${EARTH}0d`, border: `1px solid ${EARTH}33` }}
          >
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: EARTH }}
            >
              If NO wins
            </p>
            <p
              className="text-[0.78rem] mt-0.5"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
              }}
            >
              NO voters get <strong style={{ color: CREAM }}>SOL</strong> (95% of pool)
            </p>
          </div>
        </div>

        {/* Vote inputs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div
            className="p-3"
            style={{
              background: 'rgba(244,238,228,0.025)',
              border: `1px solid ${HAIR_STRONG}`,
            }}
          >
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-2"
              style={{ color: AMBER }}
            >
              Your vote · SOL
            </p>
            <input
              type="number"
              min="0.01"
              max="1000"
              step="0.1"
              value={userSol}
              onChange={(e) => setUserSol(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1.5 text-sm focus:outline-none transition-colors"
              style={{
                background: 'transparent',
                color: CREAM,
                border: `1px solid ${HAIR_STRONG}`,
                fontFamily: 'var(--font-mono, monospace)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = AMBER)}
              onBlur={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
            />
          </div>

          <div
            className="p-3"
            style={{
              background: 'rgba(244,238,228,0.025)',
              border: `1px solid ${HAIR_STRONG}`,
            }}
          >
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-2"
              style={{ color: AMBER }}
            >
              Your side
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setUserSide('YES')}
                className="mono uppercase tracking-[0.22em] text-[0.6rem] py-1.5 transition-colors"
                style={{
                  background: userSide === 'YES' ? FOREST : 'transparent',
                  color: userSide === 'YES' ? CREAM : CREAM_DIM,
                  border: `1px solid ${userSide === 'YES' ? FOREST : HAIR_STRONG}`,
                }}
              >
                YES
              </button>
              <button
                onClick={() => setUserSide('NO')}
                className="mono uppercase tracking-[0.22em] text-[0.6rem] py-1.5 transition-colors"
                style={{
                  background: userSide === 'NO' ? `${EARTH}33` : 'transparent',
                  color: userSide === 'NO' ? EARTH : CREAM_DIM,
                  border: `1px solid ${userSide === 'NO' ? EARTH : HAIR_STRONG}`,
                }}
              >
                NO
              </button>
            </div>
          </div>
        </div>

        {/* User position output */}
        {userPosition && (
          <div
            className="p-4"
            style={{
              background: userSide === 'YES' ? `${FOREST}0d` : `${EARTH}0d`,
              border: `1px solid ${userSide === 'YES' ? FOREST + '44' : EARTH + '44'}`,
            }}
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-1"
                  style={{ color: CREAM_FAINT }}
                >
                  Shares received
                </p>
                <p
                  style={{
                    color: userSide === 'YES' ? FOREST : EARTH,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '1.55rem',
                    fontWeight: 350,
                    fontFeatureSettings: '"tnum" on',
                  }}
                >
                  {userPosition.shares.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-1"
                  style={{ color: CREAM_FAINT }}
                >
                  Your % of {userSide} side
                </p>
                <p
                  style={{
                    color: userSide === 'YES' ? FOREST : EARTH,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '1.55rem',
                    fontWeight: 350,
                    fontFeatureSettings: '"tnum" on',
                  }}
                >
                  {userPosition.sharePercent.toFixed(2)}%
                </p>
              </div>
            </div>

            <div
              className="p-3"
              style={{
                background: 'rgba(10,8,20,0.4)',
                border: `1px solid ${HAIR}`,
              }}
            >
              <p
                className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-2"
                style={{ color: CREAM_FAINT }}
              >
                With your {userSol} SOL on {userSide}
              </p>

              {userPosition.yesWinsWithUser && userSide === 'YES' && (
                <div
                  style={{
                    color: CREAM_DIM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.85rem',
                  }}
                >
                  <p style={{ color: FOREST, fontWeight: 500 }}>
                    YES wins → you receive tokens.
                  </p>
                  <p className="mt-1">
                    Token allocation:{' '}
                    <strong style={{ color: CREAM }}>
                      {userPosition.tokenPercent.toFixed(2)}%
                    </strong>{' '}
                    of total supply.
                  </p>

                  <div
                    className="mt-3 p-3"
                    style={{
                      background: 'rgba(10,8,20,0.4)',
                      border: `1px solid ${FOREST}33`,
                    }}
                  >
                    <p
                      className="mono uppercase tracking-[0.22em] text-[0.5rem] mb-2"
                      style={{ color: CREAM_FAINT }}
                    >
                      Estimate at {expectedTokenMultiplier}x token value
                    </p>
                    <div className="flex items-center gap-1.5 mb-3">
                      {[1, 2, 5, 10].map((mult) => (
                        <Chip
                          key={mult}
                          active={expectedTokenMultiplier === mult}
                          onClick={() => setExpectedTokenMultiplier(mult)}
                          color={FOREST}
                        >
                          {mult}x
                        </Chip>
                      ))}
                    </div>
                    <p style={{ fontFamily: 'var(--font-fraunces, serif)' }}>
                      Est. value:{' '}
                      <strong style={{ color: CREAM }}>
                        {userPosition.estimatedTokenValue.toFixed(4)} SOL
                      </strong>
                    </p>
                    <p style={{ color: userPosition.roi >= 0 ? FOREST : EARTH }}>
                      Est. ROI: {userPosition.roi >= 0 ? '+' : ''}
                      {userPosition.roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              {userPosition.noWinsWithUser && userSide === 'NO' && (
                <div
                  style={{
                    color: CREAM_DIM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.85rem',
                  }}
                >
                  <p style={{ color: EARTH, fontWeight: 500 }}>
                    NO wins → you receive SOL.
                  </p>
                  <div
                    className="mt-2 p-3"
                    style={{
                      background: 'rgba(10,8,20,0.4)',
                      border: `1px solid ${EARTH}33`,
                    }}
                  >
                    <p>
                      SOL payout:{' '}
                      <strong style={{ color: CREAM }}>
                        {userPosition.payout.toFixed(4)} SOL
                      </strong>
                    </p>
                    <p style={{ color: userPosition.roi >= 0 ? FOREST : EARTH }}>
                      ROI: {userPosition.roi >= 0 ? '+' : ''}
                      {userPosition.roi.toFixed(1)}%
                    </p>
                    <p
                      className="italic mt-1"
                      style={{ color: CREAM_FAINT, fontStyle: 'italic', fontSize: '0.78rem' }}
                    >
                      Your share of 95% pool: {userPosition.newPoolAfterFee.toFixed(2)} SOL
                    </p>
                  </div>
                </div>
              )}

              {userPosition.payoutType === 'loss' && (
                <div
                  style={{
                    color: CREAM_DIM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.85rem',
                  }}
                >
                  <p style={{ color: EARTH, fontWeight: 500 }}>
                    {userSide === 'YES' ? 'NO' : 'YES'} would win.
                  </p>
                  <p className="mt-1">You would receive nothing — your side loses.</p>
                </div>
              )}

              {!userPosition.yesWinsWithUser && !userPosition.noWinsWithUser && (
                <div
                  style={{
                    color: CREAM_DIM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.85rem',
                  }}
                >
                  <p style={{ color: PEACH, fontWeight: 500 }}>Tie · 98.5% refund</p>
                  <p className="mt-1">
                    You'd get back{' '}
                    <strong style={{ color: CREAM }}>
                      {(userSol * 0.985).toFixed(4)} SOL
                    </strong>
                    .
                  </p>
                  <p
                    className="italic mt-1"
                    style={{ color: CREAM_FAINT, fontStyle: 'italic', fontSize: '0.78rem' }}
                  >
                    The 1.5% trade fee was already paid during voting.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reset */}
      <button
        onClick={resetSimulation}
        className="mt-4 w-full py-2.5 mono uppercase tracking-[0.26em] text-[0.6rem] transition-colors"
        style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = AMBER;
          e.currentTarget.style.borderColor = AMBER + '88';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = CREAM_DIM;
          e.currentTarget.style.borderColor = HAIR_STRONG;
        }}
      >
        Reset simulation
      </button>

      <p
        className="italic mt-4 text-center"
        style={{
          color: CREAM_FAINT,
          fontFamily: 'var(--font-fraunces, serif)',
          fontStyle: 'italic',
          fontSize: '0.72rem',
        }}
      >
        Simplified. Trade fees (1.5%) aren't deducted from displayed amounts; actual on-chain math
        includes them.
      </p>
    </div>
  );
}
