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
import { AlertCircle, XCircle } from 'lucide-react';

interface ErrorDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
}

export default function ErrorDialog({
  open,
  onClose,
  title = 'Transaction Failed',
  message,
  details,
}: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }} modal>
      <DialogContent
        className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border-red-500/30 max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/20 rounded-full">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <DialogTitle className="text-white text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-gray-300 text-base pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>

        {details && (
          <div className="bg-black/30 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-400 font-mono break-all">{details}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-red-500/80 to-pink-500/80 hover:from-red-500 hover:to-pink-500 text-white"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
