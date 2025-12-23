'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { WalletType } from '@/hooks/useHeadlessAuth';

interface Wallet {
  id: WalletType;
  name: string;
  description: string;
  color: string;
}

const wallets: Wallet[] = [
  {
    id: 'phantom',
    name: 'Phantom',
    description: 'Most popular Solana wallet',
    color: 'from-purple-500 to-purple-700',
  },
  {
    id: 'backpack',
    name: 'Backpack',
    description: 'Multi-chain wallet by Coral',
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'solflare',
    name: 'Solflare',
    description: 'Built for Solana',
    color: 'from-orange-400 to-yellow-500',
  },
];

// Simple wallet icons as SVG
const PhantomIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 128 128" fill="none">
    <rect width="128" height="128" rx="26" fill="url(#phantom-gradient)" />
    <path
      d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4118 64.0583C13.936 87.5709 33.5473 107.559 57.1325 107.559H60.4907C81.5466 107.559 99.8814 93.0694 104.835 72.5837C105.533 69.6797 108.072 67.5781 111.063 67.5781H110.584V64.9142Z"
      fill="white"
    />
    <circle cx="77" cy="57" r="8" fill="#AB9FF2" />
    <circle cx="43" cy="57" r="8" fill="#AB9FF2" />
    <defs>
      <linearGradient id="phantom-gradient" x1="0" y1="0" x2="128" y2="128">
        <stop stopColor="#534BB1" />
        <stop offset="1" stopColor="#551BF9" />
      </linearGradient>
    </defs>
  </svg>
);

const BackpackIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 128 128" fill="none">
    <rect width="128" height="128" rx="26" fill="url(#backpack-gradient)" />
    <path
      d="M64 28C47.432 28 34 41.432 34 58V78C34 86.837 41.163 94 50 94H78C86.837 94 94 86.837 94 78V58C94 41.432 80.568 28 64 28Z"
      fill="white"
    />
    <rect x="48" y="52" width="32" height="24" rx="4" fill="#E84125" />
    <defs>
      <linearGradient id="backpack-gradient" x1="0" y1="0" x2="128" y2="128">
        <stop stopColor="#E84125" />
        <stop offset="1" stopColor="#FF6B47" />
      </linearGradient>
    </defs>
  </svg>
);

const SolflareIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 128 128" fill="none">
    <rect width="128" height="128" rx="26" fill="url(#solflare-gradient)" />
    <path
      d="M64 24L96 48V80L64 104L32 80V48L64 24Z"
      fill="white"
    />
    <path
      d="M64 40L80 52V76L64 88L48 76V52L64 40Z"
      fill="#FC7227"
    />
    <defs>
      <linearGradient id="solflare-gradient" x1="0" y1="0" x2="128" y2="128">
        <stop stopColor="#FC7227" />
        <stop offset="1" stopColor="#FFB347" />
      </linearGradient>
    </defs>
  </svg>
);

const walletIcons: Record<WalletType, React.ReactNode> = {
  phantom: <PhantomIcon />,
  backpack: <BackpackIcon />,
  solflare: <SolflareIcon />,
};

interface WalletSelectionProps {
  onSelectWallet: (walletType: WalletType) => void;
  onBack: () => void;
  isConnecting: boolean;
  connectingWallet?: WalletType;
  error?: string | null;
}

export function WalletSelection({
  onSelectWallet,
  onBack,
  isConnecting,
  connectingWallet,
  error,
}: WalletSelectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md px-4"
    >
      {/* Back button */}
      <motion.button
        onClick={onBack}
        disabled={isConnecting}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors disabled:opacity-50"
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </motion.button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Connect Wallet
        </h2>
        <p className="text-gray-400 text-sm sm:text-base">
          Select your Solana wallet
        </p>
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
        >
          <p className="text-red-400 text-sm text-center">{error}</p>
        </motion.div>
      )}

      {/* Wallet options */}
      <motion.div
        className="space-y-3"
        initial="initial"
        animate="animate"
        variants={{
          animate: {
            transition: { staggerChildren: 0.08 },
          },
        }}
      >
        {wallets.map((wallet) => {
          const isThisConnecting = isConnecting && connectingWallet === wallet.id;

          return (
            <motion.button
              key={wallet.id}
              variants={{
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0 },
              }}
              whileHover={{ scale: isConnecting ? 1 : 1.02 }}
              whileTap={{ scale: isConnecting ? 1 : 0.98 }}
              onClick={() => onSelectWallet(wallet.id)}
              disabled={isConnecting}
              className={`
                w-full flex items-center gap-4 p-4 rounded-xl
                bg-white/5 border-2 border-white/10
                hover:bg-white/10 hover:border-cyan-400/50
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isThisConnecting ? 'border-cyan-400 bg-cyan-400/10' : ''}
              `}
            >
              <div className="flex-shrink-0">{walletIcons[wallet.id]}</div>
              <div className="flex-1 text-left">
                <p className="text-white font-semibold">{wallet.name}</p>
                <p className="text-gray-400 text-sm">{wallet.description}</p>
              </div>
              {isThisConnecting && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Get wallet link */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-gray-500 text-sm mt-6"
      >
        Don't have a wallet?{' '}
        <a
          href="https://phantom.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:underline inline-flex items-center gap-1"
        >
          Get Phantom
          <ExternalLink className="w-3 h-3" />
        </a>
      </motion.p>
    </motion.div>
  );
}
