'use client';

import { motion } from 'framer-motion';
import type { WalletType } from '@/hooks/useHeadlessAuth';

const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface Wallet {
  id: WalletType;
  name: string;
  description: string;
  downloadUrl: string;
}

const wallets: Wallet[] = [
  { id: 'phantom', name: 'Phantom', description: 'The most popular Solana wallet', downloadUrl: 'https://phantom.app' },
  { id: 'backpack', name: 'Backpack', description: 'Multi-chain wallet by Coral', downloadUrl: 'https://backpack.app' },
  { id: 'solflare', name: 'Solflare', description: 'Built for Solana', downloadUrl: 'https://solflare.com' },
];

const PhantomIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 128 128" fill="none">
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
  <svg className="w-7 h-7" viewBox="0 0 128 128" fill="none">
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
  <svg className="w-7 h-7" viewBox="0 0 128 128" fill="none">
    <rect width="128" height="128" rx="26" fill="url(#solflare-gradient)" />
    <path d="M64 24L96 48V80L64 104L32 80V48L64 24Z" fill="white" />
    <path d="M64 40L80 52V76L64 88L48 76V52L64 40Z" fill="#FC7227" />
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
  detectedWallets?: string[];
}

export function WalletSelection({
  onSelectWallet,
  onBack,
  isConnecting,
  connectingWallet,
  error,
  detectedWallets = [],
}: WalletSelectionProps) {
  const isWalletInstalled = (walletName: string) =>
    detectedWallets.some((detected) => detected.toLowerCase() === walletName.toLowerCase());

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="w-full max-w-md px-4"
    >
      <button
        onClick={onBack}
        disabled={isConnecting}
        className="group inline-flex items-center gap-2 mb-8 mono text-[0.6rem] uppercase tracking-[0.26em] transition-colors disabled:opacity-40"
        style={{ color: '#8a7f72' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f4eee4')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
      >
        <span className="transition-transform group-hover:-translate-x-1">←</span>
        <span>Back</span>
      </button>

      <div className="mb-8">
        <div className="mono text-[0.62rem] uppercase tracking-[0.3em] mb-4 flex items-center gap-3" style={{ color: '#e89660' }}>
          <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
          <span>Wallet</span>
        </div>
        <h2
          className="serif leading-[1.05] tracking-[-0.02em] mb-3"
          style={{
            color: '#f4eee4',
            fontSize: 'clamp(1.6rem, 4vw, 2.25rem)',
            fontWeight: 400,
            fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 72",
          }}
        >
          Choose your wallet.
        </h2>
        <p className="serif text-[0.95rem] leading-[1.55]" style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
          Any Solana wallet works. Pick one you already use.
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-3 border"
          style={{ background: 'rgba(214,115,71,0.08)', borderColor: 'rgba(214,115,71,0.35)' }}
        >
          <p className="mono text-[0.58rem] uppercase tracking-[0.24em] text-center" style={{ color: '#d67347' }}>
            {error}
          </p>
        </motion.div>
      )}

      <motion.div
        className="flex flex-col gap-3"
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
      >
        {wallets.map((wallet) => {
          const isThisConnecting = isConnecting && connectingWallet === wallet.id;
          const installed = isWalletInstalled(wallet.name);
          return (
            <motion.button
              key={wallet.id}
              variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
              onClick={() => {
                if (installed) onSelectWallet(wallet.id);
                else window.open(wallet.downloadUrl, '_blank');
              }}
              disabled={isConnecting}
              className="group w-full flex items-center gap-4 p-4 transition-colors duration-300 disabled:opacity-40 border"
              style={{
                background: isThisConnecting ? 'rgba(232,150,96,0.08)' : 'rgba(244,238,228,0.03)',
                borderColor: isThisConnecting ? 'rgba(232,150,96,0.5)' : 'rgba(244,238,228,0.12)',
                opacity: !installed ? 0.55 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isConnecting) {
                  e.currentTarget.style.background = 'rgba(232,150,96,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(232,150,96,0.35)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isThisConnecting) {
                  e.currentTarget.style.background = 'rgba(244,238,228,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(244,238,228,0.12)';
                }
              }}
            >
              <div className="flex-shrink-0">{walletIcons[wallet.id]}</div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="mono text-[0.72rem] uppercase tracking-[0.24em]" style={{ color: '#f4eee4' }}>
                    {wallet.name}
                  </span>
                  {!installed && (
                    <span className="mono text-[0.52rem] uppercase tracking-[0.24em] px-1.5 py-0.5" style={{ color: '#8a7f72', background: 'rgba(244,238,228,0.05)' }}>
                      Not installed
                    </span>
                  )}
                </div>
                <p className="mono text-[0.58rem] uppercase tracking-[0.2em]" style={{ color: '#8a7f72' }}>
                  {installed ? wallet.description : `Click to install`}
                </p>
              </div>
              {isThisConnecting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 rounded-full"
                  style={{ border: '1.5px solid rgba(232,150,96,0.25)', borderTopColor: '#e89660' }}
                />
              ) : (
                <span style={{ color: installed ? '#8a7f72' : '#6a6058' }} className="group-hover:text-[#e89660] transition-colors">
                  {installed ? '→' : '↗'}
                </span>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85 }}
        transition={{ delay: 0.4 }}
        className="mono text-[0.55rem] uppercase tracking-[0.26em] text-center mt-8"
        style={{ color: '#6a6058' }}
      >
        No wallet yet?{' '}
        <a
          href="https://phantom.app"
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-colors hover:text-[#f4eee4]"
          style={{ color: '#8a7f72' }}
        >
          Get Phantom ↗
        </a>
      </motion.p>
    </motion.div>
  );
}
