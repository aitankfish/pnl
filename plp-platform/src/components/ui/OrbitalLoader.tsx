'use client';

import React from 'react';

interface OrbitalLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function OrbitalLoader({ size = 'md', className = '' }: OrbitalLoaderProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Orbital path (subtle) */}
      <div className="absolute inset-0 rounded-full border border-white/10" />

      {/* Orbiting dots */}
      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s' }}>
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 ${dotSizes[size]} rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]`} />
      </div>

      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s', animationDelay: '-0.5s' }}>
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 ${dotSizes[size]} rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]`} />
      </div>

      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s', animationDelay: '-1s' }}>
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 ${dotSizes[size]} rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]`} />
      </div>
    </div>
  );
}

// Full page loader with centered orbital animation
export function PageLoader({ text }: { text?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <OrbitalLoader size="lg" />
      {text && (
        <p className="text-sm text-gray-400 animate-pulse">{text}</p>
      )}
    </div>
  );
}

// Inline loader for buttons/small areas
export function InlineLoader({ className = '' }: { className?: string }) {
  return <OrbitalLoader size="sm" className={className} />;
}
