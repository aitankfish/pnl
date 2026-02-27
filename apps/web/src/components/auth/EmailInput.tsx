'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';

interface EmailInputProps {
  onSubmit: (email: string) => void;
  onBack: () => void;
  isLoading: boolean;
  error?: string | null;
}

export function EmailInput({ onSubmit, onBack, isLoading, error }: EmailInputProps) {
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setValidationError('Please enter a valid email address');
      return;
    }
    setValidationError('');
    onSubmit(email);
  };

  const displayError = validationError || error;

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
        disabled={isLoading}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors disabled:opacity-50"
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </motion.button>

      {/* Icon */}
      <div className="flex justify-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center"
        >
          <Mail className="w-8 h-8 text-white" />
        </motion.div>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Enter your email
        </h2>
        <p className="text-gray-400 text-sm sm:text-base">
          We'll send you a verification code
        </p>
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (validationError) setValidationError('');
            }}
            placeholder="your@email.com"
            disabled={isLoading}
            className={`
              w-full px-4 py-4 rounded-xl
              bg-white/5 border-2 text-white placeholder-gray-500
              focus:outline-none transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${displayError
                ? 'border-red-400 focus:border-red-400'
                : 'border-white/10 focus:border-cyan-400 focus:bg-white/10'
              }
            `}
            whileFocus={{ scale: 1.01 }}
          />
          {displayError && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-sm mt-2"
            >
              {displayError}
            </motion.p>
          )}
        </motion.div>

        <motion.button
          type="submit"
          disabled={isLoading || !email}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`
            w-full py-4 rounded-xl font-semibold
            flex items-center justify-center gap-2
            bg-gradient-to-r from-purple-600 to-cyan-600
            hover:from-purple-500 hover:to-cyan-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 text-white
          `}
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <>
              Send Code
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}
