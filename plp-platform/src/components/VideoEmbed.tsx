'use client';

import React, { useState, useMemo } from 'react';
import { Play, ExternalLink, Video } from 'lucide-react';

interface VideoEmbedProps {
  url: string;
  className?: string;
}

type VideoType = 'youtube' | 'twitter' | 'unknown';

interface ParsedVideo {
  type: VideoType;
  videoId: string | null;
  embedUrl: string | null;
}

function parseVideoUrl(url: string): ParsedVideo {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        type: 'youtube',
        videoId: match[1],
        embedUrl: `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`,
      };
    }
  }

  // Twitter/X patterns
  const twitterPatterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
  ];

  for (const pattern of twitterPatterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        type: 'twitter',
        videoId: match[1],
        embedUrl: null, // Twitter embeds work differently
      };
    }
  }

  return { type: 'unknown', videoId: null, embedUrl: null };
}

export default function VideoEmbed({ url, className = '' }: VideoEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const parsedVideo = useMemo(() => parseVideoUrl(url), [url]);

  if (!url) return null;

  // YouTube embed
  if (parsedVideo.type === 'youtube' && parsedVideo.embedUrl) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-gray-900/50 border border-gray-700/50 ${className}`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700/50 bg-gray-800/30">
          <Video className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-gray-300">Project Video</span>
        </div>

        {/* Video container with 16:9 aspect ratio */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                  <Play className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-sm text-gray-400">Loading video...</span>
              </div>
            </div>
          )}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <Video className="w-8 h-8 text-gray-500" />
                <span className="text-sm text-gray-400">Video unavailable</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  Watch on YouTube <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
          <iframe
            src={parsedVideo.embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        </div>
      </div>
    );
  }

  // Twitter/X embed - show as a link card since Twitter embeds require their script
  if (parsedVideo.type === 'twitter') {
    return (
      <div className={`overflow-hidden rounded-xl bg-gray-900/50 border border-gray-700/50 ${className}`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700/50 bg-gray-800/30">
          <Video className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Project Video</span>
        </div>

        {/* Twitter link card */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors group"
        >
          <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-700/50 transition-colors">
            <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
              Watch on X (Twitter)
            </div>
            <div className="text-xs text-gray-500 truncate mt-1">
              {url}
            </div>
          </div>
          <ExternalLink className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
        </a>
      </div>
    );
  }

  // Unknown video type - show as generic link
  return (
    <div className={`overflow-hidden rounded-xl bg-gray-900/50 border border-gray-700/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700/50 bg-gray-800/30">
        <Video className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">Project Video</span>
      </div>

      {/* Generic link */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors group"
      >
        <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-700/50 transition-colors">
          <Play className="w-8 h-8 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
            Watch Video
          </div>
          <div className="text-xs text-gray-500 truncate mt-1">
            {url}
          </div>
        </div>
        <ExternalLink className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
      </a>
    </div>
  );
}
