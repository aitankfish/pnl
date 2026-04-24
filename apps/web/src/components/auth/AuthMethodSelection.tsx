'use client';

import { motion } from 'framer-motion';
import type { OAuthProvider } from '@/hooks/useHeadlessAuth';

const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const EmailIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="5" width="18" height="14" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

interface AuthMethod {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const authMethods: AuthMethod[] = [
  { id: 'email', label: 'Email', icon: <EmailIcon /> },
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'twitter', label: 'X', icon: <TwitterIcon /> },
];

interface AuthMethodSelectionProps {
  onSelectEmail: () => void;
  onSelectOAuth: (provider: OAuthProvider) => void;
  onSelectWallet?: () => void;
  onBack: () => void;
  showCloseButton?: boolean;
}

export function AuthMethodSelection({
  onSelectEmail,
  onSelectOAuth,
  onBack,
  showCloseButton = false,
}: AuthMethodSelectionProps) {
  const handleSelect = (method: AuthMethod) => {
    if (method.id === 'email') onSelectEmail();
    else onSelectOAuth(method.id as OAuthProvider);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="w-full max-w-md px-4 relative"
    >
      {/* Back / close */}
      {showCloseButton ? (
        <button
          onClick={onBack}
          className="absolute top-0 right-4 mono text-[0.6rem] uppercase tracking-[0.26em] transition-colors"
          style={{ color: '#8a7f72' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f4eee4')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
        >
          ✕ Close
        </button>
      ) : (
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 mb-6 mono text-[0.6rem] uppercase tracking-[0.26em] transition-colors"
          style={{ color: '#8a7f72' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f4eee4')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
        >
          <span className="transition-transform group-hover:-translate-x-1">←</span>
          <span>Back</span>
        </button>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="mono text-[0.62rem] uppercase tracking-[0.3em] mb-4 flex items-center gap-3" style={{ color: '#e89660' }}>
          <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
          <span>Sign in</span>
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
          How would you like to{' '}
          <em
            style={{
              fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 72",
              color: 'transparent',
              backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ecb48a 35%, #d99875 70%, #d67347 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            arrive?
          </em>
        </h2>
        <p className="serif text-[0.95rem] leading-[1.55]" style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
          One choice. You can pitch, back ideas, or just browse from here.
        </p>
      </div>

      {/* Method buttons */}
      <motion.div
        className="flex flex-col gap-3"
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
      >
        {authMethods.map((method) => (
          <motion.button
            key={method.id}
            variants={{
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0 },
            }}
            onClick={() => handleSelect(method)}
            className="group relative inline-flex items-center justify-between gap-3 px-5 py-4 mono text-[0.7rem] uppercase tracking-[0.24em] transition-colors duration-300 w-full border"
            style={{
              background: 'rgba(244,238,228,0.03)',
              color: '#f4eee4',
              borderColor: 'rgba(244,238,228,0.12)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(232,150,96,0.08)';
              e.currentTarget.style.borderColor = 'rgba(232,150,96,0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(244,238,228,0.03)';
              e.currentTarget.style.borderColor = 'rgba(244,238,228,0.12)';
            }}
          >
            <span className="flex items-center gap-3">
              <span style={{ color: '#ecb48a' }}>{method.icon}</span>
              <span>Continue with {method.label}</span>
            </span>
            <span style={{ color: '#8a7f72' }} className="group-hover:text-[#e89660] transition-colors">→</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Terms */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85 }}
        transition={{ delay: 0.5 }}
        className="mono text-[0.55rem] uppercase tracking-[0.26em] text-center mt-8"
        style={{ color: '#6a6058' }}
      >
        By continuing, you agree to the{' '}
        <a href="/terms" target="_blank" className="underline transition-colors hover:text-[#f4eee4]" style={{ color: '#8a7f72' }}>terms</a>
        {' · '}
        <a href="/privacy" target="_blank" className="underline transition-colors hover:text-[#f4eee4]" style={{ color: '#8a7f72' }}>privacy</a>
      </motion.p>
    </motion.div>
  );
}
