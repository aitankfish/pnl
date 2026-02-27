'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Shield } from 'lucide-react';

interface OTPInputProps {
  email: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  isLoading: boolean;
  isResending?: boolean;
  error?: string | null;
}

export function OTPInput({
  email,
  onSubmit,
  onResend,
  onBack,
  isLoading,
  isResending = false,
  error,
}: OTPInputProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Clear digits on error
  useEffect(() => {
    if (error) {
      setDigits(['', '', '', '', '', '']);
      setActiveIndex(0);
      inputRefs.current[0]?.focus();
    }
  }, [error]);

  const handleDigitChange = (index: number, value: string) => {
    // Only allow single digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setActiveIndex(index + 1);
    }

    // Auto-submit when all digits entered
    if (newDigits.every((d) => d) && digit) {
      onSubmit(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
        setActiveIndex(index - 1);
      } else {
        // Clear current digit
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setActiveIndex(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setActiveIndex(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newDigits[i] = pastedData[i];
      }
      setDigits(newDigits);

      // Focus appropriate input or submit
      if (pastedData.length === 6) {
        onSubmit(pastedData);
      } else {
        inputRefs.current[pastedData.length]?.focus();
        setActiveIndex(pastedData.length);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
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
          className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center"
        >
          <Shield className="w-8 h-8 text-white" />
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
          Check your email
        </h2>
        <p className="text-gray-400 text-sm sm:text-base">
          Enter the 6-digit code sent to
          <br />
          <span className="text-cyan-400 font-medium">{email}</span>
        </p>
      </motion.div>

      {/* OTP Input Boxes */}
      <motion.div
        className="flex gap-2 sm:gap-3 justify-center mb-6"
        onPaste={handlePaste}
        initial="initial"
        animate="animate"
        variants={{
          animate: {
            transition: { staggerChildren: 0.05 },
          },
        }}
      >
        {digits.map((digit, index) => (
          <motion.input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={() => setActiveIndex(index)}
            disabled={isLoading}
            variants={{
              initial: { opacity: 0, y: 20, scale: 0.8 },
              animate: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`
              w-11 h-13 sm:w-14 sm:h-16
              text-center text-xl sm:text-2xl font-bold text-white
              bg-white/5 border-2 rounded-xl
              focus:outline-none
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${activeIndex === index ? 'border-cyan-400 bg-white/10 scale-105' : ''}
              ${digit ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/20'}
              ${error ? 'border-red-400 bg-red-400/10' : ''}
            `}
            style={{
              boxShadow: activeIndex === index ? '0 0 20px rgba(6, 182, 212, 0.3)' : 'none',
            }}
          />
        ))}
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-400 text-sm text-center mb-4"
        >
          {error}
        </motion.p>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center mb-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          />
        </motion.div>
      )}

      {/* Resend code */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <button
          onClick={onResend}
          disabled={isResending || isLoading}
          className="text-gray-400 hover:text-cyan-400 text-sm flex items-center gap-2 mx-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
          {isResending ? 'Sending...' : "Didn't receive code? Resend"}
        </button>
      </motion.div>
    </motion.div>
  );
}
