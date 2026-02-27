'use client';

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  expiryTime: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function CountdownTimer({ expiryTime, className = '', size = 'sm' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('Calculating...');
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiryTime).getTime();
      const difference = expiry - now;

      if (difference <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        setIsUrgent(false);
        return;
      }

      // Check if less than 1 hour remaining
      if (difference < 60 * 60 * 1000) {
        setIsUrgent(true);
      } else {
        setIsUrgent(false);
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      if (days > 0) {
        if (size === 'sm') {
          setTimeLeft(`${days}d ${hours}h ${minutes}m`);
        } else {
          setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiryTime, size]);

  const getColorClass = () => {
    if (isExpired) return 'text-red-400';
    if (isUrgent) return 'text-red-500 animate-pulse';
    return 'text-orange-400';
  };

  const iconSize = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-4 h-4';
  const textSize = size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'font-bold';

  return (
    <div className={`flex items-center space-x-${size === 'lg' ? '2' : '1'} ${className}`}>
      <Clock className={`${iconSize} ${getColorClass()}`} />
      <span className={`${textSize} ${getColorClass()} tabular-nums`}>
        {timeLeft}
      </span>
    </div>
  );
}
