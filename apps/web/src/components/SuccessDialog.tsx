'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink, Copy, Check } from 'lucide-react';
import { SOLANA_NETWORK } from '@/config/solana';

interface SuccessDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  signature?: string;
  details?: string;
}

export default function SuccessDialog({
  open,
  onClose,
  title,
  message,
  signature,
  details,
}: SuccessDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (signature) {
      await navigator.clipboard.writeText(signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }} modal>
      <DialogContent
        className="sm:max-w-md bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl border-green-500/30 text-white"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <DialogTitle className="text-xl text-white">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-gray-300 text-base">
            {message}
          </DialogDescription>
        </DialogHeader>

        {signature && (
          <div className="space-y-3">
            <div className="p-4 bg-white/5 rounded-lg border border-green-500/20 space-y-2">
              <div className="text-sm text-gray-400">Transaction Signature</div>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-xs font-mono text-green-400 bg-black/30 px-3 py-2 rounded break-all">
                  {signature}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-shrink-0 hover:bg-white/10"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            <a
              href={`https://orb.helius.dev/tx/${signature}${SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 w-full px-4 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-400/30 rounded-lg transition-all hover:scale-[1.02] text-white font-medium"
            >
              <span>View on Helius Orb</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {details && (
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <p className="text-sm text-cyan-300">{details}</p>
          </div>
        )}

        <DialogFooter className="sm:justify-start">
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white font-semibold"
          >
            Got it!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
