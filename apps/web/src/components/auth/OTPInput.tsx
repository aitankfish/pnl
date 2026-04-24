'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

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

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      setDigits(['', '', '', '', '', '']);
      setActiveIndex(0);
      inputRefs.current[0]?.focus();
    }
  }, [error]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setActiveIndex(index + 1);
    }
    if (newDigits.every((d) => d) && digit) {
      onSubmit(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        setActiveIndex(index - 1);
      } else {
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="w-full max-w-md px-4"
    >
      <button
        onClick={onBack}
        disabled={isLoading}
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
          <span>Verify</span>
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
          Check your inbox.
        </h2>
        <p className="serif text-[0.95rem] leading-[1.55]" style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
          We sent a six-digit code to <span className="mono text-[0.85rem]" style={{ color: '#ecb48a', letterSpacing: '0.02em' }}>{email}</span>
        </p>
      </div>

      {/* OTP boxes */}
      <motion.div
        className="flex gap-2 sm:gap-3 justify-center mb-6"
        onPaste={handlePaste}
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
      >
        {digits.map((digit, index) => {
          const isActive = activeIndex === index;
          const hasDigit = !!digit;
          const hasError = !!error;
          return (
            <motion.input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => setActiveIndex(index)}
              disabled={isLoading}
              variants={{
                initial: { opacity: 0, y: 12 },
                animate: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="serif w-11 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl transition-all disabled:opacity-50"
              style={{
                color: '#f4eee4',
                fontWeight: 400,
                fontVariationSettings: "'SOFT' 50, 'opsz' 48",
                background: hasError
                  ? 'rgba(214,115,71,0.08)'
                  : hasDigit
                    ? 'rgba(232,150,96,0.08)'
                    : 'rgba(244,238,228,0.04)',
                border: hasError
                  ? '1px solid rgba(214,115,71,0.5)'
                  : isActive
                    ? '1px solid rgba(232,150,96,0.6)'
                    : hasDigit
                      ? '1px solid rgba(232,150,96,0.35)'
                      : '1px solid rgba(244,238,228,0.12)',
                outline: 'none',
                boxShadow: isActive ? '0 0 16px rgba(232,150,96,0.25)' : 'none',
              }}
            />
          );
        })}
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono text-[0.58rem] uppercase tracking-[0.24em] text-center mb-4"
          style={{ color: '#d67347' }}
        >
          {error}
        </motion.p>
      )}

      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center mb-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 rounded-full"
            style={{ border: '1.5px solid rgba(232,150,96,0.25)', borderTopColor: '#e89660' }}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center"
      >
        <button
          onClick={onResend}
          disabled={isResending || isLoading}
          className="mono text-[0.6rem] uppercase tracking-[0.26em] transition-colors disabled:opacity-40"
          style={{ color: '#8a7f72' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#e89660')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
        >
          {isResending ? '· Sending ·' : "Didn't get it? · Resend"}
        </button>
      </motion.div>
    </motion.div>
  );
}
