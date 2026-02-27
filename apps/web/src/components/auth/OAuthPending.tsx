'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, XCircle } from 'lucide-react';
import { CosmicLoader } from './CosmicLoader';
import type { OAuthProvider } from '@/hooks/useHeadlessAuth';

interface OAuthPendingProps {
  provider: OAuthProvider;
  onCancel: () => void;
  error?: string | null;
  onRetry: () => void;
}

const providerNames: Record<OAuthProvider, string> = {
  google: 'Google',
  twitter: 'Twitter',
};

const providerColors: Record<OAuthProvider, string> = {
  google: 'from-red-500 to-orange-500',
  twitter: 'from-sky-400 to-blue-500',
};

export function OAuthPending({ provider, onCancel, error, onRetry }: OAuthPendingProps) {
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md px-4 text-center"
      >
        {/* Error icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="mb-6"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <XCircle className="w-16 h-16 mx-auto text-red-400" />
          </motion.div>
        </motion.div>

        {/* Error message */}
        <h3 className="text-xl font-bold text-white mb-2">Connection Failed</h3>
        <p className="text-gray-400 mb-6">{error}</p>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          <motion.button
            onClick={onCancel}
            className="px-6 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-medium hover:bg-white/20 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Go Back
          </motion.button>
          <motion.button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-medium hover:from-purple-500 hover:to-cyan-500 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Try Again
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md px-4 text-center"
    >
      {/* Cancel button */}
      <motion.button
        onClick={onCancel}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors mx-auto"
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="w-4 h-4" />
        Cancel
      </motion.button>

      {/* Provider icon with gradient background */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-r ${providerColors[provider]} flex items-center justify-center`}
      >
        {provider === 'google' && (
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="white">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        )}
        {provider === 'twitter' && (
          <svg className="w-10 h-10" fill="white" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        )}
      </motion.div>

      {/* Loading state */}
      <CosmicLoader message={`Connecting to ${providerNames[provider]}...`} />

      {/* Helper text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-gray-500 text-sm mt-6"
      >
        A popup window should have opened.
        <br />
        Complete the login there to continue.
      </motion.p>
    </motion.div>
  );
}
