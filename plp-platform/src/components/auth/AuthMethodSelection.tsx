'use client';

import { motion } from 'framer-motion';
import { Mail, Wallet, ArrowLeft, X } from 'lucide-react';
import type { OAuthProvider } from '@/hooks/useHeadlessAuth';

// Custom icons for OAuth providers
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface AuthMethod {
  id: string;
  label: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
}

const authMethods: AuthMethod[] = [
  {
    id: 'email',
    label: 'Email',
    icon: <Mail className="w-5 h-5 text-white" />,
    gradient: 'from-blue-500 to-cyan-500',
    iconBg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
  },
  {
    id: 'google',
    label: 'Google',
    icon: <GoogleIcon />,
    gradient: 'from-red-500 to-orange-500',
    iconBg: 'bg-white',
  },
  {
    id: 'twitter',
    label: 'Twitter',
    icon: <TwitterIcon />,
    gradient: 'from-sky-400 to-blue-500',
    iconBg: 'bg-gradient-to-r from-gray-800 to-gray-900',
  },
  {
    id: 'wallet',
    label: 'Wallet',
    icon: <Wallet className="w-5 h-5 text-white" />,
    gradient: 'from-purple-600 to-pink-500',
    iconBg: 'bg-gradient-to-r from-purple-600 to-pink-500',
  },
];

interface AuthMethodSelectionProps {
  onSelectEmail: () => void;
  onSelectOAuth: (provider: OAuthProvider) => void;
  onSelectWallet: () => void;
  onBack: () => void;
  showCloseButton?: boolean; // Show X instead of Back arrow when true
}

export function AuthMethodSelection({
  onSelectEmail,
  onSelectOAuth,
  onSelectWallet,
  onBack,
  showCloseButton = false,
}: AuthMethodSelectionProps) {
  const handleSelect = (method: AuthMethod) => {
    if (method.id === 'email') {
      onSelectEmail();
    } else if (method.id === 'wallet') {
      onSelectWallet();
    } else {
      onSelectOAuth(method.id as OAuthProvider);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md px-4 relative"
    >
      {/* Back/Close button */}
      {showCloseButton ? (
        <motion.button
          onClick={onBack}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5" />
        </motion.button>
      ) : (
        <motion.button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          whileHover={{ x: -4 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </motion.button>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`text-center mb-8 ${showCloseButton ? 'mt-4' : ''}`}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Connect to P&L
        </h2>
        <p className="text-gray-400 text-sm sm:text-base">
          Sign in to access your wallet and start trading
        </p>
      </motion.div>

      {/* Auth method buttons */}
      <motion.div
        className="space-y-3"
        initial="initial"
        animate="animate"
        variants={{
          animate: {
            transition: { staggerChildren: 0.06 },
          },
        }}
      >
        {authMethods.map((method) => (
          <motion.button
            key={method.id}
            variants={{
              initial: { opacity: 0, x: -20 },
              animate: { opacity: 1, x: 0 },
            }}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(method)}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
          >
            <div className={`w-10 h-10 rounded-lg ${method.iconBg} flex items-center justify-center`}>
              {method.icon}
            </div>
            <span className="text-white font-medium text-base sm:text-lg">
              Continue with {method.label}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Footer text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-gray-500 text-xs mt-6"
      >
        By continuing, you agree to our Terms of Service
      </motion.p>
    </motion.div>
  );
}
