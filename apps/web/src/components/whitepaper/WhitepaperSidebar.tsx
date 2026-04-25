'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Menu, X } from 'lucide-react';

// ── Cosmic-plant palette ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

interface Section {
  id: string;
  title: string;
}

const sections: Section[] = [
  { id: 'thesis', title: 'The thesis' },
  { id: 'abstract', title: 'Abstract' },
  { id: 'problem', title: 'The problem' },
  { id: 'solution', title: 'The solution' },
  { id: 'how-it-works', title: 'How it works' },
  { id: 'benefits', title: 'Why build & invest' },
  { id: 'economics', title: 'Economics' },
  { id: 'vision', title: 'Vision & roadmap' },
  { id: 'technical', title: 'Technical' },
  { id: 'community', title: 'Join the grove' },
  { id: 'disclaimer', title: 'Disclaimer' },
];

// Cosmic whoosh on nav click — kept (it's a delightful Easter egg).
// Web Audio API: layered sine + triangle oscillators with a noise burst
// for "sparkle". Volume kept low (0.06 master gain) so it never startles.
const playCosmicSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    const frequencies = [220, 330, 440, 660];
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.06, now);
    masterGain.connect(audioContext.destination);

    frequencies.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(masterGain);
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.95, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 0.15);
      const delay = i * 0.02;
      const volume = 0.3 / (i + 1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + delay + 0.03);
      gain.gain.setValueAtTime(volume, now + delay + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + delay);
      osc.start(now);
      osc.stop(now + 0.3);
    });

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
    setTimeout(() => audioContext.close(), 400);
  } catch {
    // Silently fail if audio isn't supported
  }
};

export default function WhitepaperSidebar() {
  const [activeSection, setActiveSection] = useState<string>('abstract');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
      playCosmicSound();
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      setActiveSection(id);
      setIsMobileOpen(false);
    }
  };

  const progressPercent = Math.round(
    ((sections.findIndex((s) => s.id === activeSection) + 1) / sections.length) * 100,
  );

  return (
    <>
      {/* Mobile floating toggle — square amber button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-3.5 transition-all hover:scale-105"
        style={{
          background: AMBER,
          color: BG,
          boxShadow: '0 12px 32px rgba(232,150,96,0.35)',
        }}
        aria-label="Toggle navigation"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{
            background: 'rgba(10,8,20,0.72)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop floating, mobile bottom sheet */}
      <nav
        className={`fixed z-40 transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? 'bottom-0 left-0 right-0 h-[72vh]'
            : 'bottom-0 left-0 right-0 h-0 lg:h-auto overflow-hidden lg:overflow-visible'
        } lg:top-24 lg:left-4 lg:bottom-auto lg:right-auto lg:w-60`}
        style={{
          background: isMobileOpen ? BG : 'rgba(10,8,20,0.92)',
          border: `1px solid ${HAIR_STRONG}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div className="h-full overflow-y-auto p-4 lg:p-4">
          {/* Header */}
          <div
            className="mb-4 pb-3"
            style={{ borderBottom: `1px solid ${HAIR}` }}
          >
            <p
              className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-1.5"
              style={{ color: AMBER }}
            >
              Contents
            </p>
            <p
              className="italic"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '0.92rem',
                fontWeight: 400,
              }}
            >
              The whitepaper
            </p>
          </div>

          {/* Section links */}
          <ul className="space-y-px">
            {sections.map((section, index) => {
              const isActive = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors group"
                    style={{
                      background: isActive ? `${AMBER}14` : 'transparent',
                      borderLeft: `2px solid ${isActive ? AMBER : 'transparent'}`,
                      color: isActive ? CREAM : CREAM_DIM,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(244,238,228,0.04)';
                        e.currentTarget.style.color = CREAM;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = CREAM_DIM;
                      }
                    }}
                  >
                    <span
                      className="mono text-[0.55rem] flex-shrink-0 w-6"
                      style={{
                        color: isActive ? AMBER : CREAM_FAINT,
                        letterSpacing: '0.04em',
                        fontFeatureSettings: '"tnum" on',
                      }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="flex-1 truncate"
                      style={{
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontSize: '0.82rem',
                      }}
                    >
                      {section.title}
                    </span>
                    {isActive && (
                      <ChevronRight
                        className="w-3 h-3 flex-shrink-0"
                        style={{ color: AMBER }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Progress */}
          <div
            className="mt-4 pt-3"
            style={{ borderTop: `1px solid ${HAIR}` }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="mono uppercase tracking-[0.24em] text-[0.5rem]"
                style={{ color: CREAM_FAINT }}
              >
                Progress
              </span>
              <span
                className="mono text-[0.55rem]"
                style={{
                  color: AMBER,
                  letterSpacing: '0.04em',
                  fontFeatureSettings: '"tnum" on',
                }}
              >
                {progressPercent}%
              </span>
            </div>
            <div className="h-px" style={{ background: HAIR_STRONG }}>
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${progressPercent}%`, background: AMBER }}
              />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
