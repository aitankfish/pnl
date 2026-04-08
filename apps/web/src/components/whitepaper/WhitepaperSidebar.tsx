'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Menu, X, FileText } from 'lucide-react';

interface Section {
  id: string;
  title: string;
}

const sections: Section[] = [
  { id: 'abstract', title: 'Abstract' },
  { id: 'problem', title: 'The Problem' },
  { id: 'solution', title: 'The Solution' },
  { id: 'how-it-works', title: 'How PNL Works' },
  { id: 'benefits', title: 'Why Build & Invest' },
  { id: 'economics', title: 'Economics' },
  { id: 'vision', title: 'Vision & Roadmap' },
  { id: 'technical', title: 'Technical Architecture' },
  { id: 'community', title: 'Join the Revolution' },
  { id: 'disclaimer', title: 'Disclaimer' },
];

// Cosmic whoosh sound using Web Audio API
const playCosmicSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;

    // Create multiple oscillators for rich, cosmic harmonics
    const frequencies = [220, 330, 440, 660]; // A3, E4, A4, E5 - perfect fifths for space feel
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    // Master gain for overall volume
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.06, now);
    masterGain.connect(audioContext.destination);

    frequencies.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(masterGain);

      // Use sine for base, triangle for shimmer
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';

      // Slight frequency sweep upward for "lift off" feel
      osc.frequency.setValueAtTime(freq * 0.95, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 0.15);

      // Staggered fade in/out for ethereal effect
      const delay = i * 0.02;
      const volume = 0.3 / (i + 1); // Higher harmonics are quieter
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + delay + 0.03);
      gain.gain.setValueAtTime(volume, now + delay + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + delay);

      osc.start(now);
      osc.stop(now + 0.3);

      oscillators.push(osc);
      gains.push(gain);
    });

    // Add a subtle noise burst for cosmic "sparkle"
    const bufferSize = audioContext.sampleRate * 0.1;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 3000;

    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.015, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);

    // Clean up
    setTimeout(() => audioContext.close(), 400);
  } catch (e) {
    // Silently fail if audio isn't supported
  }
};

export default function WhitepaperSidebar() {
  const [activeSection, setActiveSection] = useState<string>('abstract');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Scroll spy: detect which section is in view
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Play cosmic whoosh sound
      playCosmicSound();

      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      setActiveSection(id);
      setIsMobileOpen(false);
    }
  };

  const progressPercent = Math.round(((sections.findIndex(s => s.id === activeSection) + 1) / sections.length) * 100);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all"
        aria-label="Toggle navigation"
      >
        {isMobileOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Floating Sidebar - positioned below navbar */}
      <nav
        className={`
          fixed z-40 transition-all duration-300 ease-in-out
          ${isMobileOpen
            ? 'bottom-0 left-0 right-0 h-[70vh] rounded-t-3xl bg-black/95 backdrop-blur-xl border-t border-white/20'
            : 'bottom-0 left-0 right-0 h-0 lg:h-auto overflow-hidden lg:overflow-visible'
          }
          lg:top-24 lg:left-4 lg:bottom-auto lg:right-auto lg:w-56
          lg:bg-white/[0.03] lg:backdrop-blur-md lg:rounded-2xl lg:border lg:border-white/10
          lg:shadow-xl lg:shadow-black/20
        `}
      >
        <div className="h-full overflow-y-auto p-4 lg:p-3">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Whitepaper</span>
          </div>

          {/* Section Links */}
          <ul className="space-y-0.5">
            {sections.map((section, index) => {
              const isActive = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className={`
                      w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs
                      transition-all duration-200 group
                      ${isActive
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-medium
                      ${isActive ? 'bg-blue-500/30 text-blue-300' : 'bg-white/5 text-gray-500'}
                    `}>
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate">{section.title}</span>
                    {isActive && (
                      <ChevronRight className="w-3 h-3 text-blue-400" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Progress Bar */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1.5">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
