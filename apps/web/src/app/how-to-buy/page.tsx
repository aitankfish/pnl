// ─────────────────────────────────────────────────────────────────
// HIDDEN ROUTE — content lives at docs.pnl.market/docs/how-to-buy
// Registry: apps/web/HIDDEN_ROUTES.md
// To restore: delete `HowToBuy` stub below, rename `HowToBuyOriginal`
//             → `HowToBuy` + `export default`. Untouch the rest.
// ─────────────────────────────────────────────────────────────────
'use client';

import { redirect, useRouter } from 'next/navigation';
import { ExternalLink, ChevronDown, Copy, Check } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import EditorialDoc from '@/components/EditorialDoc';

// ── Cosmic-plant palette ──
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';

const PNL_CONTRACT = '6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump';

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
      className="mono inline-flex items-center gap-1.5 px-2 py-0.5 transition-colors group"
      style={{
        color: AMBER,
        border: `1px solid ${HAIR_STRONG}`,
        fontSize: '0.75rem',
        letterSpacing: '0.02em',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = AMBER + '88')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
      title="Click to copy"
    >
      <span className="truncate max-w-[180px] sm:max-w-none">{address}</span>
      {copied ? (
        <Check className="w-3 h-3 flex-shrink-0" style={{ color: FOREST }} />
      ) : (
        <Copy className="w-3 h-3 opacity-50 group-hover:opacity-100 flex-shrink-0" />
      )}
    </button>
  );
}

function AnimatedGuide() {
  return (
    <div
      className="overflow-hidden aspect-[9/14] sm:aspect-[4/3] md:aspect-[16/9]"
      style={{ border: `1px solid ${HAIR_STRONG}` }}
    >
      <iframe
        src="/how-to-buy-animation.html"
        className="w-full h-full border-0"
        allow="autoplay"
      />
    </div>
  );
}

interface Platform {
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  steps: Array<{ title: string; description: React.ReactNode }>;
  link: string;
  linkText: string;
}

const platforms: Platform[] = [
  {
    name: 'Phantom Wallet',
    subtitle: "Start here — you'll need this for all methods",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 128 128" fill="none">
        <rect width="128" height="128" rx="26" fill="#534BB1" />
        <path
          d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3042 14.4118 64.0975C13.936 87.7461 34.794 108 58.6536 108H63.3425C84.4675 108 110.584 89.1815 110.584 64.9142Z"
          fill="rgba(255,255,255,0.08)"
        />
        <circle cx="46" cy="60" r="7" fill="white" />
        <circle cx="72" cy="60" r="7" fill="white" />
      </svg>
    ),
    steps: [
      {
        title: 'Download Phantom',
        description:
          'Get Phantom from the App Store (iOS) or Google Play (Android). You can also install the browser extension from phantom.app.',
      },
      {
        title: 'Set up your wallet',
        description:
          'Open Phantom and sign up using your email. Your wallet will be created automatically. Save your recovery phrase somewhere safe.',
      },
      {
        title: 'Copy your Solana receiving address',
        description:
          'Tap "Receive" and select Solana. Copy this address — you\'ll use it to receive SOL or PNL from exchanges like Robinhood or Coinbase.',
      },
    ],
    link: 'https://phantom.app',
    linkText: 'Get Phantom',
  },
  {
    name: 'Buy directly in Phantom',
    subtitle: 'Buy SOL with card, swap to PNL — no exchange needed',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 128 128" fill="none">
        <rect width="128" height="128" rx="26" fill="#534BB1" />
        <path
          d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3042 14.4118 64.0975C13.936 87.7461 34.794 108 58.6536 108H63.3425C84.4675 108 110.584 89.1815 110.584 64.9142Z"
          fill="rgba(255,255,255,0.08)"
        />
        <circle cx="46" cy="60" r="7" fill="white" />
        <circle cx="72" cy="60" r="7" fill="white" />
      </svg>
    ),
    steps: [
      {
        title: 'Tap "Buy" in Phantom',
        description:
          'Open Phantom and tap the "Buy" button. Select Solana (SOL) and enter the amount you want to purchase.',
      },
      {
        title: 'Continue with email',
        description:
          'Tap "Continue" and you\'ll be taken to MoonPay. Enter your email address to get started.',
      },
      {
        title: 'Complete KYC verification',
        description:
          "MoonPay will ask you to verify your identity — upload a government-issued ID and take a quick selfie. This is a one-time step, you won't need to do it again for future purchases.",
      },
      {
        title: 'Enter payment & buy SOL',
        description:
          "Once verified, you'll be taken back to the purchase screen. Enter your card details, confirm the amount, and complete the purchase. Your SOL will arrive in Phantom shortly.",
      },
      {
        title: 'Tap the swap button',
        description:
          'Once your SOL arrives in Phantom, tap the Swap button (two arrows icon) at the bottom of the screen.',
      },
      {
        title: 'Swap SOL → PNL',
        description: (
          <>
            Set SOL as the &quot;from&quot; token. For the &quot;to&quot; token,
            paste the PNL contract address:{' '}
            <CopyableAddress address={PNL_CONTRACT} /> Enter your amount,
            confirm the swap, and you&apos;re done. PNL will appear in your
            wallet within seconds.
          </>
        ),
      },
    ],
    link: 'https://phantom.app',
    linkText: 'Open Phantom',
  },
  {
    name: 'Robinhood',
    subtitle: 'Buy SOL, send to Phantom, swap for PNL',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="32" fill="#00C805" />
        <path
          d="M44 24C44 24 42 20 36 18C30 16 28 18 28 18L20 42H26L30 30C30 30 32 28 36 30C40 32 40 36 40 36L42 42H48L44 24Z"
          fill="white"
        />
      </svg>
    ),
    steps: [
      {
        title: 'Deposit money on Robinhood',
        description:
          'Open Robinhood and deposit funds. Robinhood offers instant settlement, so your money is available to trade right away.',
      },
      {
        title: 'Buy Solana (SOL)',
        description:
          'Search for Solana (SOL) on Robinhood and buy however much you want to convert to PNL.',
      },
      {
        title: 'Go to Transfer → Send',
        description:
          'Tap on your SOL holding, then tap "Transfer" → "Send". If this is your first time sending crypto from Robinhood, you\'ll need to set up your crypto wallet first.',
      },
      {
        title: '(First time only) Verify your identity',
        description:
          "Robinhood will ask you to enable crypto transfers. You'll need to verify your identity — confirm your personal details, enter your two-factor authentication code, and agree to the transfer terms. This is a one-time setup.",
      },
      {
        title: 'Paste Phantom address & send SOL',
        description:
          'Once verified, paste your Phantom Solana receiving address (from Step 3 above), enter the amount of SOL to send, review the details, and confirm the transfer.',
      },
      {
        title: 'Swap SOL for PNL in Phantom',
        description: (
          <>
            Once your SOL arrives in Phantom, tap the Swap button. Set SOL as
            the &quot;from&quot; token. For the &quot;to&quot; token, paste the
            PNL contract address:{' '}
            <CopyableAddress address={PNL_CONTRACT} /> Enter your amount,
            confirm the swap, and you&apos;re all set.
          </>
        ),
      },
    ],
    link: 'https://robinhood.com',
    linkText: 'Open Robinhood',
  },
  {
    name: 'Coinbase',
    subtitle: 'Buy PNL directly with the contract address',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 1024 1024" fill="none">
        <circle cx="512" cy="512" r="512" fill="#0052FF" />
        <path
          d="M512.147 692C413.028 692 332.147 611.12 332.147 512C332.147 412.88 413.028 332 512.147 332C601.028 332 675.707 396.24 690.307 480H870.547C854.707 298.08 700.867 156 512.147 156C314.947 156 156.147 314.8 156.147 512C156.147 709.2 314.947 868 512.147 868C700.867 868 854.707 725.92 870.547 544H690.307C675.707 627.76 601.028 692 512.147 692Z"
          fill="white"
        />
      </svg>
    ),
    steps: [
      {
        title: 'Open Coinbase & search by contract address',
        description: (
          <>
            Open the Coinbase app or go to coinbase.com. In the search bar,
            paste the PNL contract address:{' '}
            <CopyableAddress address={PNL_CONTRACT} /> This will take you
            directly to the $PNL token.
          </>
        ),
      },
      {
        title: 'Buy PNL',
        description:
          'Tap "Buy", enter how much you want in USD or token amount, review the details, and confirm. Your PNL will appear in your Coinbase wallet right away.',
      },
      {
        title: '(Optional) Send to Phantom to hold',
        description:
          'If you want to hold your PNL in Phantom, go to your PNL balance on Coinbase, tap "Send", paste your Phantom Solana receiving address, and confirm the transfer.',
      },
    ],
    link: 'https://www.coinbase.com',
    linkText: 'Open Coinbase',
  },
];

function PlatformSection({
  platform,
  defaultOpen,
  index,
}: {
  platform: Platform;
  defaultOpen: boolean;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const numeral = String(index + 1).padStart(2, '0');

  return (
    <div
      className="overflow-hidden transition-colors"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left transition-colors gap-3"
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = 'rgba(232,150,96,0.04)')
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <span
            className="mono text-[0.6rem] flex-shrink-0"
            style={{ color: AMBER, letterSpacing: '0.06em' }}
          >
            {numeral}
          </span>
          <div className="flex-shrink-0">{platform.icon}</div>
          <div className="min-w-0">
            <h2
              className="truncate"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: 'clamp(1.05rem, 2.2vw, 1.4rem)',
                fontWeight: 400,
              }}
            >
              {platform.name}
            </h2>
            <p
              className="truncate italic"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '0.78rem',
              }}
            >
              {platform.subtitle}
            </p>
          </div>
        </div>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0 transition-transform duration-300"
          style={{
            color: CREAM_FAINT,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 space-y-4">
          <div className="w-full h-px mb-2" style={{ background: HAIR }} />

          {platform.steps.map((step, idx) => (
            <div key={idx} className="flex gap-3 sm:gap-4">
              <div className="flex-shrink-0">
                <div
                  className="w-7 h-7 flex items-center justify-center mono text-[0.6rem]"
                  style={{
                    background: `${AMBER}1a`,
                    color: AMBER,
                    border: `1px solid ${AMBER}55`,
                    letterSpacing: '0.04em',
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="mb-1"
                  style={{
                    color: CREAM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.98rem',
                    fontWeight: 400,
                  }}
                >
                  {step.title}
                </h3>
                <div
                  className="leading-relaxed"
                  style={{
                    color: CREAM_DIM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                  }}
                >
                  {step.description}
                </div>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <a
              href={platform.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mono uppercase tracking-[0.24em] text-[0.6rem] inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors"
              style={{ color: AMBER, border: `1px solid ${AMBER}55` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${AMBER}11`;
                e.currentTarget.style.borderColor = AMBER + '88';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = AMBER + '55';
              }}
            >
              {platform.linkText}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HowToBuy() {
  redirect('https://docs.pnl.market/docs/how-to-buy');
  return null;
}

// ─── ORIGINAL COMPONENT — restore by renaming to HowToBuy + export default ──
function HowToBuyOriginal() {
  const router = useRouter();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (deltaX > 100 && deltaY < 80) {
        router.push('/browse');
      }
    },
    [router],
  );

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <EditorialDoc
        eyebrow="Getting started"
        title="How to buy $PNL"
        subtitle="Three paths into the grove. Pick the one that fits your wallet."
      >
        {/* Contract address row */}
        <div
          className="flex items-center gap-2 flex-wrap mb-6 px-3 py-2"
          style={{
            background: 'rgba(232,150,96,0.045)',
            border: `1px solid ${AMBER}33`,
          }}
        >
          <span
            className="mono uppercase tracking-[0.22em] text-[0.5rem]"
            style={{ color: AMBER }}
          >
            $PNL contract
          </span>
          <CopyableAddress address={PNL_CONTRACT} />
        </div>

        {/* Tip banner */}
        <div
          className="mb-6 p-4"
          style={{
            background: 'rgba(244,238,228,0.025)',
            border: `1px solid ${HAIR_STRONG}`,
            borderLeft: `2px solid ${AMBER}`,
          }}
        >
          <p
            className="italic"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.95rem',
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: AMBER, fontStyle: 'normal' }}>
              First things first.
            </strong>{' '}
            Download Phantom — you'll need it no matter which path you choose.
            You can buy SOL directly inside Phantom with a card, or move it in
            from Robinhood or Coinbase.
          </p>
        </div>

        {/* Platform sections */}
        <div className="space-y-4">
          {platforms.map((platform, index) => (
            <PlatformSection
              key={platform.name}
              platform={platform}
              defaultOpen={index === 0}
              index={index}
            />
          ))}
        </div>

        {/* Animated guide */}
        <div className="mt-8">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-3"
            style={{ color: AMBER }}
          >
            Visual walkthrough
          </p>
          <AnimatedGuide />
        </div>

        {/* Help footer */}
        <div
          className="mt-8 p-4 text-center"
          style={{
            background: 'rgba(244,238,228,0.025)',
            border: `1px solid ${HAIR_STRONG}`,
          }}
        >
          <p
            className="italic"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.9rem',
            }}
          >
            Need help?{' '}
            <a
              href="https://discord.gg/38pkg4vm"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: AMBER,
                textDecoration: 'underline',
                textDecorationThickness: '1px',
                textUnderlineOffset: '3px',
                textDecorationColor: 'rgba(232,150,96,0.4)',
              }}
            >
              Join our Discord
            </a>{' '}
            and we&apos;ll walk you through it.
          </p>
        </div>
      </EditorialDoc>
    </div>
  );
}
