'use client';

import React, { useState } from 'react';
import { MessageSquare, Mic, Users } from 'lucide-react';
import ChatRoom from './ChatRoom';

interface CommunityHubProps {
  marketAddress: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
  className?: string;
}

type TabType = 'chat' | 'voice';

export default function CommunityHub({
  marketAddress,
  walletAddress,
  founderWallet,
  hasPosition,
  className,
}: CommunityHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  const tabs = [
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
    { id: 'voice' as TabType, label: 'Voice', icon: Mic, disabled: true, soon: true },
  ];

  return (
    <div className={`flex flex-col bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700/50 overflow-hidden ${className || 'h-[500px] sm:h-[600px]'}`}>
      {/* Tab Header */}
      <div className="flex border-b border-gray-700/50">
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
