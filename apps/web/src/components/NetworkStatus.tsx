/**
 * Network Status Component
 * Shows current network information and environment details
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  environment, 
  getNetworkName, 
  isDevnet,
  shouldShowDebugInfo 
} from '@/lib/environment';
import { 
  Globe, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface NetworkStatusProps {
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

export default function NetworkStatus({ 
  showDetails = false, 
  compact = false,
  className = '' 
}: NetworkStatusProps) {
  // Only show in development mode
  if (!shouldShowDebugInfo()) {
    return null;
  }

  const envConfig = environment.getConfig();
  const networkName = getNetworkName();
  const isDev = isDevnet();

  // Get validation status
  const validation = environment.validateConfig();
  const isConfigValid = validation.isValid;

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${isDev ? 'bg-yellow-500' : 'bg-green-500'}`} />
        <span className="text-xs text-white/70">
          {networkName}
        </span>
        {!isConfigValid && (
          <AlertCircle className="w-3 h-3 text-red-400" />
        )}
      </div>
    );
  }

  return (
    <Card className={`bg-white/5 border-white/10 text-white ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-sm">
          <Globe className="w-4 h-4" />
          <span>Network Status</span>
          <Badge 
            className={`text-xs ${
              isDev 
                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30' 
                : 'bg-green-500/20 text-green-300 border-green-400/30'
            }`}
          >
            {networkName}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      {showDetails && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Network Information */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-white/60">Network:</span>
                <span className="ml-1 text-white">{networkName}</span>
              </div>
              <div>
                <span className="text-white/60">Environment:</span>
                <span className="ml-1 text-white">
                  {envConfig.dynamic.isSandbox ? 'Sandbox' : 'Live'}
                </span>
              </div>
              <div>
                <span className="text-white/60">RPC:</span>
                <span className="ml-1 text-white text-xs font-mono">
                  {envConfig.rpcUrl.includes('devnet') ? 'Devnet' : 'Mainnet'}
                </span>
              </div>
              <div>
                <span className="text-white/60">IPFS:</span>
                <span className="ml-1 text-white">
                  {envConfig.ipfs.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Configuration Status */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {isConfigValid ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-xs text-white/70">
                  Configuration {isConfigValid ? 'Valid' : 'Invalid'}
                </span>
              </div>
              
              {!isConfigValid && (
                <div className="text-xs text-red-400 space-y-1">
                  {validation.errors.slice(0, 3).map((error, index) => (
                    <div key={index} className="flex items-start space-x-1">
                      <span className="text-red-400">•</span>
                      <span>{error}</span>
                    </div>
                  ))}
                  {validation.errors.length > 3 && (
                    <div className="text-white/60">
                      +{validation.errors.length - 3} more errors
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Feature Flags */}
            <div className="space-y-1">
              <span className="text-xs text-white/60">Features:</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(envConfig.features).map(([feature, enabled]) => (
                  <Badge 
                    key={feature}
                    className={`text-xs ${
                      enabled 
                        ? 'bg-green-500/20 text-green-300 border-green-400/30' 
                        : 'bg-gray-500/20 text-gray-400 border-gray-400/30'
                    }`}
                  >
                    {feature.replace('enable', '').replace(/([A-Z])/g, ' $1').trim()}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Export hook for programmatic access
export function useNetworkStatus() {
  const envConfig = environment.getConfig();
  const networkName = getNetworkName();
  const isDev = isDevnet();
  const validation = environment.validateConfig();

  return {
    networkName,
    isDevnet: isDev,
    isMainnet: !isDev,
    isConfigValid: validation.isValid,
    configErrors: validation.errors,
    envConfig,
    shouldShowDebug: shouldShowDebugInfo(),
  };
}
