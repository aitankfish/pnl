'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, ChevronDown, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/15 border border-white/10 text-cyan-400 font-mono text-xs transition-all cursor-pointer group"
      title="Click to copy"
    >
      <span className="truncate max-w-[180px] sm:max-w-none">{address}</span>
      {copied ? (
        <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
      ) : (
        <Copy className="w-3 h-3 opacity-50 group-hover:opacity-100 flex-shrink-0" />
      )}
    </button>
  );
}

const PNL_CONTRACT = '6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump';

const platforms = [
  {
    name: 'Phantom Wallet',
    subtitle: 'Start here — you\'ll need this for all methods',
    color: 'purple',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 128 128" fill="none">
        <rect width="128" height="128" rx="26" fill="url(#phantom-grad)" />
        <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3042 14.4118 64.0975C13.936 87.7461 34.794 108 58.6536 108H63.3425C84.4675 108 110.584 89.1815 110.584 64.9142Z" fill="url(#phantom-grad2)" />
        <circle cx="46" cy="60" r="7" fill="white" />
        <circle cx="72" cy="60" r="7" fill="white" />
        <defs>
          <linearGradient id="phantom-grad" x1="0" y1="0" x2="128" y2="128">
            <stop stopColor="#534BB1" />
            <stop offset="1" stopColor="#551BF9" />
          </linearGradient>
          <linearGradient id="phantom-grad2" x1="14" y1="23" x2="111" y2="108">
            <stop stopColor="white" stopOpacity="0.1" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
    steps: [
      {
        title: 'Download Phantom',
        description: 'Get Phantom from the App Store (iOS) or Google Play (Android). You can also install the browser extension from phantom.app.',
      },
      {
        title: 'Set Up Your Wallet',
        description: 'Open Phantom and sign up using your email. Your wallet will be created automatically. Save your recovery phrase somewhere safe.',
      },
      {
        title: 'Copy Your Solana Receiving Address',
        description: 'Tap "Receive" and select Solana. Copy this address — you\'ll use it to receive SOL or PNL from exchanges like Robinhood or Coinbase.',
      },
    ],
    link: 'https://phantom.app',
    linkText: 'Get Phantom',
  },
  {
    name: 'Buy Directly in Phantom',
    subtitle: 'Buy SOL with card, swap to PNL — no exchange needed',
    color: 'purple',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 128 128" fill="none">
        <rect width="128" height="128" rx="26" fill="url(#phantom-grad-2)" />
        <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3042 14.4118 64.0975C13.936 87.7461 34.794 108 58.6536 108H63.3425C84.4675 108 110.584 89.1815 110.584 64.9142Z" fill="url(#phantom-grad2-2)" />
        <circle cx="46" cy="60" r="7" fill="white" />
        <circle cx="72" cy="60" r="7" fill="white" />
        <defs>
          <linearGradient id="phantom-grad-2" x1="0" y1="0" x2="128" y2="128">
            <stop stopColor="#534BB1" />
            <stop offset="1" stopColor="#551BF9" />
          </linearGradient>
          <linearGradient id="phantom-grad2-2" x1="14" y1="23" x2="111" y2="108">
            <stop stopColor="white" stopOpacity="0.1" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
    steps: [
      {
        title: 'Tap "Buy" in Phantom',
        description: 'Open Phantom and tap the "Buy" button. Select Solana (SOL) and enter the amount you want to purchase.',
      },
      {
        title: 'Continue with Email',
        description: 'Tap "Continue" and you\'ll be taken to MoonPay. Enter your email address to get started.',
      },
      {
        title: 'Complete KYC Verification',
        description: 'MoonPay will ask you to verify your identity — upload a government-issued ID and take a quick selfie. This is a one-time step, you won\'t need to do it again for future purchases.',
      },
      {
        title: 'Enter Payment & Buy SOL',
        description: 'Once verified, you\'ll be taken back to the purchase screen. Enter your card details, confirm the amount, and complete the purchase. Your SOL will arrive in Phantom shortly.',
      },
      {
        title: 'Tap the Swap Button',
        description: 'Once your SOL arrives in Phantom, tap the Swap button (two arrows icon) at the bottom of the screen.',
      },
      {
        title: 'Swap SOL → PNL',
        description: <>Set SOL as the &quot;from&quot; token. For the &quot;to&quot; token, paste the PNL contract address: <CopyableAddress address={PNL_CONTRACT} /> Enter your amount, confirm the swap, and you&apos;re done! PNL will appear in your wallet within seconds.</>,
      },
    ],
    link: 'https://phantom.app',
    linkText: 'Open Phantom',
  },
  {
    name: 'Robinhood',
    subtitle: 'Buy SOL, send to Phantom, swap for PNL',
    color: 'green',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="32" fill="#00C805" />
        <path d="M44 24C44 24 42 20 36 18C30 16 28 18 28 18L20 42H26L30 30C30 30 32 28 36 30C40 32 40 36 40 36L42 42H48L44 24Z" fill="white" />
      </svg>
    ),
    steps: [
      {
        title: 'Deposit Money on Robinhood',
        description: 'Open Robinhood and deposit funds. Robinhood offers instant settlement, so your money is available to trade right away.',
      },
      {
        title: 'Buy Solana (SOL)',
        description: 'Search for Solana (SOL) on Robinhood and buy however much you want to convert to PNL.',
      },
      {
        title: 'Go to Transfer → Send',
        description: 'Tap on your SOL holding, then tap "Transfer" → "Send". If this is your first time sending crypto from Robinhood, you\'ll need to set up your crypto wallet first.',
      },
      {
        title: '(First Time Only) Verify Your Identity',
        description: 'Robinhood will ask you to enable crypto transfers. You\'ll need to verify your identity — confirm your personal details, enter your two-factor authentication code, and agree to the transfer terms. This is a one-time setup.',
      },
      {
        title: 'Paste Phantom Address & Send SOL',
        description: 'Once verified, paste your Phantom Solana receiving address (from Step 3 above), enter the amount of SOL to send, review the details, and confirm the transfer.',
      },
      {
        title: 'Swap SOL for PNL in Phantom',
        description: <>Once your SOL arrives in Phantom, tap the Swap button. Set SOL as the &quot;from&quot; token. For the &quot;to&quot; token, paste the PNL contract address: <CopyableAddress address={PNL_CONTRACT} /> Enter your amount, confirm the swap, and you&apos;re all set!</>,
      },
    ],
    link: 'https://robinhood.com',
    linkText: 'Open Robinhood',
  },
  {
    name: 'Coinbase',
    subtitle: 'Buy PNL directly with contract address',
    color: 'blue',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 1024 1024" fill="none">
        <circle cx="512" cy="512" r="512" fill="#0052FF" />
        <path d="M512.147 692C413.028 692 332.147 611.12 332.147 512C332.147 412.88 413.028 332 512.147 332C601.028 332 675.707 396.24 690.307 480H870.547C854.707 298.08 700.867 156 512.147 156C314.947 156 156.147 314.8 156.147 512C156.147 709.2 314.947 868 512.147 868C700.867 868 854.707 725.92 870.547 544H690.307C675.707 627.76 601.028 692 512.147 692Z" fill="white" />
      </svg>
    ),
    steps: [
      {
        title: 'Open Coinbase & Search by Contract Address',
        description: <>Open the Coinbase app or go to coinbase.com. In the search bar, paste the PNL contract address: <CopyableAddress address={PNL_CONTRACT} /> This will take you directly to the $PNL token.</>,
      },
      {
        title: 'Buy PNL',
        description: 'Tap "Buy", enter how much you want in USD or token amount, review the details, and confirm. Your PNL will appear in your Coinbase wallet right away.',
      },
      {
        title: '(Optional) Send to Phantom to HODL',
        description: 'If you want to hold your PNL in Phantom, go to your PNL balance on Coinbase, tap "Send", paste your Phantom Solana receiving address, and confirm the transfer.',
      },
    ],
    link: 'https://www.coinbase.com',
    linkText: 'Open Coinbase',
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string; badge: string; step: string }> = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/10',
    badge: 'bg-blue-500/20 text-blue-300',
    step: 'bg-blue-500 text-white',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-400',
    glow: 'shadow-green-500/10',
    badge: 'bg-green-500/20 text-green-300',
    step: 'bg-green-500 text-white',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/10',
    badge: 'bg-purple-500/20 text-purple-300',
    step: 'bg-purple-500 text-white',
  },
};

function PlatformSection({ platform, defaultOpen }: { platform: typeof platforms[number]; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors = colorMap[platform.color];

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden transition-all duration-300 shadow-lg ${colors.glow}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-6 text-left hover:bg-white/5 transition-colors gap-3"
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex-shrink-0">{platform.icon}</div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-white truncate">{platform.name}</h2>
            <p className={`text-xs sm:text-sm ${colors.text} truncate`}>
              {platform.subtitle || `${platform.steps.length} steps`}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-4 sm:px-6 pb-5 sm:pb-6 space-y-3 sm:space-y-4">
          <div className="w-full h-px bg-white/10 mb-2" />

          {platform.steps.map((step, index) => (
            <div key={index} className="flex gap-3 sm:gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${colors.step} flex items-center justify-center text-xs sm:text-sm font-bold`}>
                  {index + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm sm:text-base mb-1">{step.title}</h3>
                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <a
              href={platform.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${colors.badge} text-sm font-medium hover:opacity-80 transition-opacity`}
            >
              {platform.linkText}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HowToBuy() {
  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse Markets
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
              How to Buy <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">$PNL</span>
            </h1>
            <CopyableAddress address={PNL_CONTRACT} />
          </div>
          <p className="text-gray-400 text-base sm:text-lg">
            Get $PNL tokens in just a few steps. Choose your preferred platform below.
          </p>
        </div>

        {/* Tip banner */}
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-cyan-400">First things first:</span> Download Phantom wallet — you&apos;ll need it no matter which method you choose. You can buy SOL directly in Phantom with a card, or use Robinhood / Coinbase.
          </p>
        </div>

        {/* Platform sections */}
        <div className="space-y-4">
          {platforms.map((platform, index) => (
            <PlatformSection key={platform.name} platform={platform} defaultOpen={index === 0} />
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm text-gray-400 text-center">
            Need help? Join our{' '}
            <a href="https://discord.gg/38pkg4vm" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
              Discord community
            </a>{' '}
            and we&apos;ll walk you through it.
          </p>
        </div>
      </div>
    </div>
  );
}
