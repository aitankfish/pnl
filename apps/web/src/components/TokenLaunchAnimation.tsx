'use client';

import React, { useEffect, useState } from 'react';

interface TokenLaunchAnimationProps {
  isVisible: boolean;
  tokenSymbol?: string;
}

/**
 * Planetary orbit animation for token launch
 * Shows a central sun with orbiting planets during token creation
 */
export function TokenLaunchAnimation({ isVisible, tokenSymbol }: TokenLaunchAnimationProps) {
  const [stage, setStage] = useState<'preparing' | 'uploading' | 'launching' | 'finalizing'>('preparing');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setStage('preparing');
      setProgress(0);
      return;
    }

    // Simulate stages (real progress would come from actual events)
    const timers: NodeJS.Timeout[] = [];

    // Stage 1: Preparing (0-25%)
    timers.push(setTimeout(() => {
      setStage('uploading');
      setProgress(25);
    }, 3000));

    // Stage 2: Uploading (25-50%)
    timers.push(setTimeout(() => {
      setStage('launching');
      setProgress(50);
    }, 8000));

    // Stage 3: Launching (50-75%)
    timers.push(setTimeout(() => {
      setStage('finalizing');
      setProgress(75);
    }, 15000));

    // Stage 4: Finalizing (75-100%)
    timers.push(setTimeout(() => {
      setProgress(100);
    }, 25000));

    return () => timers.forEach(t => clearTimeout(t));
  }, [isVisible]);

  if (!isVisible) return null;

  const stageMessages = {
    preparing: '🔧 Generating vanity token address...',
    uploading: '📤 Uploading metadata to IPFS...',
    launching: '🚀 Creating token on Pump.fun...',
    finalizing: '✨ Finalizing transaction...',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative flex flex-col items-center">
        {/* Planetary System */}
        <div className="relative w-96 h-96">
          {/* Central Sun (Token) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="relative">
              {/* Pulsing glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 animate-ping opacity-75" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 blur-xl animate-pulse" />

              {/* Sun core */}
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 flex items-center justify-center shadow-2xl border-4 border-yellow-200/50">
                <div className="text-3xl font-bold text-white drop-shadow-lg">
                  {tokenSymbol || '🪙'}
                </div>
              </div>
            </div>
          </div>

          {/* Orbit 1 - Inner (Fast) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-cyan-500/30 rounded-full animate-spin-slow">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/50 flex items-center justify-center text-xs">
              💎
            </div>
          </div>

          {/* Orbit 2 - Middle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border border-purple-500/30 rounded-full animate-spin-slower">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 shadow-lg shadow-purple-500/50 flex items-center justify-center">
              🌙
            </div>
          </div>

          {/* Orbit 3 - Outer (Slow) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-green-500/30 rounded-full animate-spin-slowest">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/50 flex items-center justify-center text-lg">
              🌍
            </div>
          </div>

          {/* Floating particles */}
          <div className="absolute inset-0">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full animate-float"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${3 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Status Text */}
        <div className="mt-12 text-center space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <p className="text-2xl font-bold text-white">
              {stageMessages[stage]}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-96 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-sm text-gray-400">
            This may take 30-60 seconds. Please don't close this window.
          </p>

          {/* Substatus messages */}
          <div className="text-xs text-gray-500 space-y-1">
            {stage === 'preparing' && (
              <p>✨ Generating branded address ending with "pnl"...</p>
            )}
            {stage === 'uploading' && (
              <p>📡 Uploading token metadata to decentralized storage...</p>
            )}
            {stage === 'launching' && (
              <p>⚡ Creating bonding curve and minting tokens...</p>
            )}
            {stage === 'finalizing' && (
              <p>🎯 Confirming transaction on Solana blockchain...</p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes spin-slower {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes spin-slowest {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
            opacity: 0;
          }
          50% {
            transform: translateY(-20px);
            opacity: 1;
          }
        }

        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }

        .animate-spin-slower {
          animation: spin-slower 15s linear infinite;
        }

        .animate-spin-slowest {
          animation: spin-slowest 25s linear infinite;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
