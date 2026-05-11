'use client';

import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  type: 'success' | 'error';
  title: string;
  message: string;
  details?: string[];
  onClose: () => void;
  duration?: number; // in milliseconds
}

export function Toast({ type, title, message, details, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-5 duration-300 px-3 sm:px-0 w-[calc(100%-24px)] sm:w-auto">
      <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl shadow-black/50 w-full sm:min-w-[350px] sm:max-w-md">
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              {type === 'success' ? (
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base">{title}</h3>
                <p className="text-gray-300 text-sm mt-1">{message}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Details */}
          {details && details.length > 0 && (
            <div className="space-y-2 pl-9">
              {details.map((detail, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-gray-400 text-sm">{detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full ${type === 'success' ? 'bg-green-400' : 'bg-red-400'} animate-progress`}
              style={{
                animation: `progress ${duration}ms linear`,
              }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-progress {
          animation: progress ${duration}ms linear;
        }
      `}</style>
    </div>
  );
}
