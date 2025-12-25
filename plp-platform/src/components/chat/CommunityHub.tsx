'use client';

import React, { useState } from 'react';
import { MessageSquare, Mic, Users, Send } from 'lucide-react';
import ChatRoom from './ChatRoom';

// Custom Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Custom Twitter/X icon component
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// Custom LinkedIn icon component
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface SocialLinks {
  twitter?: string;
  discord?: string;
  telegram?: string;
  linkedin?: string;
}

interface CommunityHubProps {
  marketAddress: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
  socialLinks?: SocialLinks;
  className?: string;
}

type TabType = 'chat' | 'voice';

export default function CommunityHub({
  marketAddress,
  walletAddress,
  founderWallet,
  hasPosition,
  socialLinks,
  className,
}: CommunityHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  const tabs = [
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
    { id: 'voice' as TabType, label: 'Voice', icon: Mic, disabled: true, soon: true },
  ];

  const hasSocialLinks = socialLinks && (socialLinks.twitter || socialLinks.discord || socialLinks.telegram || socialLinks.linkedin);

  return (
    <div className={`flex flex-col bg-gray-900/20 backdrop-blur-[2px] rounded-lg border border-gray-700/30 overflow-hidden ${className || 'h-[500px] sm:h-[600px]'}`}>
      {/* Social Links Bar */}
      {hasSocialLinks && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-b border-gray-700/30 bg-gray-800/20">
          <span className="text-[10px] text-gray-500 mr-1">Join:</span>
          {socialLinks.twitter && (
            <a
              href={socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-gray-700/30 hover:bg-gray-600/40 border border-gray-600/30 hover:border-gray-500/50 transition-all hover:scale-110"
              title="Twitter / X"
            >
              <TwitterIcon className="w-3.5 h-3.5 text-gray-300" />
            </a>
          )}
          {socialLinks.discord && (
            <a
              href={socialLinks.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 hover:border-indigo-400/50 transition-all hover:scale-110"
              title="Discord"
            >
              <DiscordIcon className="w-3.5 h-3.5 text-indigo-400" />
            </a>
          )}
          {socialLinks.telegram && (
            <a
              href={socialLinks.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 hover:border-blue-400/50 transition-all hover:scale-110"
              title="Telegram"
            >
              <Send className="w-3.5 h-3.5 text-blue-400" />
            </a>
          )}
          {socialLinks.linkedin && (
            <a
              href={socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 hover:border-blue-500/50 transition-all hover:scale-110"
              title="LinkedIn"
            >
              <LinkedInIcon className="w-3.5 h-3.5 text-blue-500" />
            </a>
          )}
        </div>
      )}

      {/* Tab Header */}
      <div className="flex border-b border-gray-700/30 bg-gray-900/30">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-cyan-400 bg-cyan-500/10'
                  : tab.disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.soon && (
                <span className="text-[10px] text-gray-500 hidden sm:inline">(Soon)</span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatRoom
            marketAddress={marketAddress}
            walletAddress={walletAddress}
            founderWallet={founderWallet}
            hasPosition={hasPosition}
            className="h-full rounded-none border-0"
          />
        )}

        {activeTab === 'voice' && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Mic className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Voice Rooms</h3>
              <p className="text-sm text-gray-400 max-w-xs">
                Coming soon! Host live discussions, AMAs, and debates with the community.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 rounded-full">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-purple-300">Beta access coming Q1 2025</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
