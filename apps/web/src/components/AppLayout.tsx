'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from './Sidebar';
import SpaceBackground from './SpaceBackground';
import '../styles/starry-background.css';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

// Constellation definitions for each day of the week - Scaled to cover whole page
const constellations = {
  0: { // Sunday - Orion (The Hunter)
    name: 'Orion',
    stars: [
      { top: 25, left: 40 }, // Betelgeuse (shoulder)
      { top: 40, left: 35 }, // Bellatrix
      { top: 45, left: 40 }, // Alnitak (belt)
      { top: 45, left: 50 }, // Alnilam (belt)
      { top: 45, left: 60 }, // Mintaka (belt)
      { top: 60, left: 35 }, // Saiph
      { top: 70, left: 55 }, // Rigel (foot)
    ],
    lines: [[0,1], [1,2], [2,3], [3,4], [4,6], [5,2], [6,4]]
  },
  1: { // Monday - Ursa Major (Big Dipper)
    name: 'Ursa Major',
    stars: [
      { top: 20, left: 15 },
      { top: 15, left: 30 },
      { top: 12, left: 45 },
      { top: 18, left: 60 },
      { top: 30, left: 70 },
      { top: 45, left: 65 },
      { top: 55, left: 55 },
    ],
    lines: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6]]
  },
  2: { // Tuesday - Cassiopeia (W-shaped)
    name: 'Cassiopeia',
    stars: [
      { top: 15, left: 20 },
      { top: 25, left: 35 },
      { top: 15, left: 50 },
      { top: 25, left: 65 },
      { top: 15, left: 80 },
    ],
    lines: [[0,1], [1,2], [2,3], [3,4]]
  },
  3: { // Wednesday - Leo (The Lion)
    name: 'Leo',
    stars: [
      { top: 40, left: 20 }, // Regulus
      { top: 30, left: 30 },
      { top: 20, left: 45 },
      { top: 25, left: 60 },
      { top: 40, left: 65 },
      { top: 55, left: 50 },
    ],
    lines: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0]]
  },
  4: { // Thursday - Cygnus (Northern Cross)
    name: 'Cygnus',
    stars: [
      { top: 15, left: 50 }, // Deneb (top)
      { top: 40, left: 50 }, // Center
      { top: 70, left: 50 }, // Bottom
      { top: 40, left: 20 }, // Left wing
      { top: 40, left: 80 }, // Right wing
    ],
    lines: [[0,1], [1,2], [3,1], [1,4]]
  },
  5: { // Friday - Scorpius (The Scorpion)
    name: 'Scorpius',
    stars: [
      { top: 40, left: 50 }, // Antares (heart)
      { top: 30, left: 45 },
      { top: 20, left: 35 },
      { top: 50, left: 55 },
      { top: 60, left: 65 },
      { top: 70, left: 75 },
      { top: 80, left: 85 },
    ],
    lines: [[0,1], [1,2], [0,3], [3,4], [4,5], [5,6]]
  },
  6: { // Saturday - Pegasus (The Winged Horse)
    name: 'Pegasus',
    stars: [
      { top: 40, left: 15 },
      { top: 40, left: 45 },
      { top: 70, left: 45 },
      { top: 70, left: 15 },
      { top: 25, left: 30 }, // Wing
    ],
    lines: [[0,1], [1,2], [2,3], [3,0], [1,4]]
  },
};

export default function AppLayout({ children, currentPage }: AppLayoutProps) {
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);

  useEffect(() => {
    // Get current day of week (0 = Sunday, 6 = Saturday)
    setDayOfWeek(new Date().getDay());
  }, []);

  // Memoize constellation to prevent recalculation on every render
  const currentConstellation = useMemo(() => {
    return constellations[dayOfWeek as keyof typeof constellations] || null;
  }, [dayOfWeek]);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Memoized Space Background - only re-renders when constellation changes */}
      <SpaceBackground constellation={currentConstellation} />

      {/* Top Navigation Bar */}
      <Sidebar currentPage={currentPage} />

      {/* Main Content */}
      <div className="flex-1 pt-24 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
