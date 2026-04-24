'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Users, Rocket, Shield, Zap, CheckCircle, ExternalLink, ArrowRight, XCircle, ChevronDown } from 'lucide-react';
import { motion, useScroll, useTransform, useInView, useMotionValueEvent, type MotionValue } from 'framer-motion';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useRouter } from 'next/navigation';
import CosmicOnboardingModal from '@/components/CosmicOnboardingModal';
import TokenAddress from '@/components/TokenAddress';
import dynamic from 'next/dynamic';

const CosmicTree3D = dynamic(() => import('@/components/CosmicTree3D'), { ssr: false });

// Animation variants with smoother easing
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
};

// Counter animation component
function Counter({ end, duration = 2, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);
  const isInView = useInView(countRef, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    const startValue = 0;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(startValue + (end - startValue) * easeOutQuart);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return <span ref={countRef}>{count}{suffix}</span>;
}

// 3D Tilt Card Component
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateXValue = (y - centerY) / 20;
    const rotateYValue = (centerX - x) / 20;

    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: 'transform 0.1s ease-out'
      }}
      className={className}
    >
      {children}
    </div>
  );
}

// ─── Hero: live data hooks ─────────────────────────────────────────────────
function useUTCClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return { date: '—', time: '—' };
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    date: `${days[now.getUTCDay()]} ${pad(now.getUTCDate())} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
    time: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`,
  };
}

function useSolanaSlot() {
  const [slot, setSlot] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const rpc = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
    const fetchSlot = async () => {
      try {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot' }),
        });
        const json = await res.json();
        if (alive && typeof json.result === 'number') setSlot(json.result);
      } catch {}
    };
    fetchSlot();
    const id = setInterval(fetchSlot, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  useEffect(() => {
    if (slot == null) return;
    const id = setInterval(() => setSlot((s) => (s == null ? s : s + 1)), 420);
    return () => clearInterval(id);
  }, [slot != null]);
  return slot;
}

type LiveMarket = {
  id: string;
  name: string;
  volume: number;
  participants: number;
  yesPercent: number | null;
  tokenSymbol?: string;
};

function useLiveMarkets() {
  const [data, setData] = useState<{ count: number; volume: number; markets: LiveMarket[] }>({ count: 0, volume: 0, markets: [] });
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch('/api/markets/list?status=active&page=1&limit=30');
        const json = await res.json();
        if (!alive || !json.success) return;
        const markets = json.data?.markets || json.markets || json.data || [];
        const stats = json.data?.platformStats || json.platformStats || null;
        const live: LiveMarket[] = markets.slice(0, 24).map((m: any) => ({
          id: (m.id || m.marketAddress || String(m._id || '')).toString(),
          name: (m.name || m.title || 'Untitled').toString(),
          volume: ((m.totalYesStake || 0) + (m.totalNoStake || 0)) || (m.poolBalance || 0) || 0,
          participants: m.totalParticipants || 0,
          yesPercent: m.yesPercentage ?? m.sharesYesPercentage ?? null,
          tokenSymbol: m.tokenSymbol,
        }));
        setData({
          count: stats?.activeMarkets ?? markets.length,
          volume: stats?.totalPoolVolume ?? 0,
          markets: live,
        });
      } catch {}
    };
    run();
    const id = setInterval(run, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return data;
}

// ─── Hero: Starfield — monochromatic amber, three depth planes ─────────────
type Star = {
  id: number;
  x: number;      // %
  y: number;      // %
  size: number;   // px
  color: string;
  opacity: number;
  twinkleDur: number;
  twinkleDelay: number;
  layer: 0 | 1 | 2; // 0=far, 1=mid, 2=near
};

function Starfield({
  farY,
  midY,
  nearY,
}: {
  farY: any;
  midY: any;
  nearY: any;
}) {
  const [stars, setStars] = useState<Star[]>([]);
  const [constellation, setConstellation] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  useEffect(() => {
    const COLORS = [
      { c: '#fff5e1', w: 0.5 },  // warm white
      { c: '#ffd7a8', w: 0.3 },  // gold
      { c: '#ffa366', w: 0.15 }, // amber
      { c: '#d99875', w: 0.05 }, // orange
    ];
    const pickColor = () => {
      const r = Math.random();
      let acc = 0;
      for (const { c, w } of COLORS) {
        acc += w;
        if (r <= acc) return c;
      }
      return COLORS[0].c;
    };
    const generated: Star[] = [];
    // Layer 0 (far): 100 stars, 1–1.5px, dim but visible
    for (let i = 0; i < 100; i++) {
      generated.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 70,
        size: 1 + Math.random() * 0.5,
        color: pickColor(),
        opacity: 0.5 + Math.random() * 0.35,
        twinkleDur: 4 + Math.random() * 5,
        twinkleDelay: Math.random() * 5,
        layer: 0,
      });
    }
    // Layer 1 (mid): 40 stars, 1.5–2.5px, clearly present
    for (let i = 0; i < 40; i++) {
      generated.push({
        id: 100 + i,
        x: Math.random() * 100,
        y: Math.random() * 65,
        size: 1.5 + Math.random() * 1,
        color: pickColor(),
        opacity: 0.75 + Math.random() * 0.25,
        twinkleDur: 3 + Math.random() * 4,
        twinkleDelay: Math.random() * 5,
        layer: 1,
      });
    }
    // Layer 2 (near): 16 stars, 2.5–4px, bright points
    for (let i = 0; i < 16; i++) {
      generated.push({
        id: 200 + i,
        x: Math.random() * 100,
        y: Math.random() * 60,
        size: 2.5 + Math.random() * 1.5,
        color: pickColor(),
        opacity: 0.9 + Math.random() * 0.1,
        twinkleDur: 2.5 + Math.random() * 3,
        twinkleDelay: Math.random() * 4,
        layer: 2,
      });
    }
    setStars(generated);
    // Constellation: connect 8 mid/near stars in a sparse network
    const pool = generated.filter((s) => s.layer >= 1);
    const chosen = pool.sort(() => Math.random() - 0.5).slice(0, 9);
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < chosen.length - 1; i++) {
      const a = chosen[i];
      const b = chosen[i + 1];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 35) lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    setConstellation(lines);
  }, []);

  const renderLayer = (layer: 0 | 1 | 2) =>
    stars
      .filter((s) => s.layer === layer)
      .map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: s.color,
            opacity: s.opacity,
            boxShadow: s.layer === 2 ? `0 0 ${s.size * 2.5}px ${s.color}` : s.layer === 1 ? `0 0 ${s.size * 1.5}px ${s.color}` : 'none',
            animation: `starTwinkle ${s.twinkleDur}s ease-in-out ${s.twinkleDelay}s infinite`,
          }}
        />
      ));

  return (
    <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}>
      {/* Atmospheric fade near horizon */}
      <div
        className="absolute inset-0"
        style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 82%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 0%, black 82%, transparent 100%)' }}
      >
        {/* Far layer */}
        <motion.div className="absolute inset-0" style={{ y: farY }}>
          {renderLayer(0)}
        </motion.div>
        {/* Mid layer */}
        <motion.div className="absolute inset-0" style={{ y: midY }}>
          {renderLayer(1)}
        </motion.div>
        {/* Near layer */}
        <motion.div className="absolute inset-0" style={{ y: nearY }}>
          {renderLayer(2)}
        </motion.div>
        {/* Shooting star — dotted particle trail (head + receding dots) */}
        <div className="absolute" style={{ top: '12%', left: '-8%', width: '2px', height: '2px', borderRadius: '9999px', background: '#fff5e1', boxShadow: '0 0 10px 2px #ffd7a8', animation: 'shoot 32s ease-out infinite' }}>
          {Array.from({ length: 14 }).map((_, i) => {
            const fade = i / 14; // 0 (closest to head) → ~1 (tail)
            const size = 1.8 - fade * 1.5;
            return (
              <span key={i} className="absolute" style={{
                top: '50%',
                right: `${(i + 1) * 11}px`,
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                background: '#ffd7a8',
                opacity: 1 - fade * 0.95,
                transform: 'translateY(-50%)',
                boxShadow: `0 0 ${3 - fade * 2.5}px rgba(255,215,168,${0.5 - fade * 0.45})`,
              }} />
            );
          })}
        </div>
        {/* Second shooting star (offset) */}
        <div className="absolute" style={{ top: '30%', left: '-8%', width: '1.5px', height: '1.5px', borderRadius: '9999px', background: '#fff5e1', boxShadow: '0 0 8px 1.5px #ecb48a', animation: 'shoot 46s ease-out infinite', animationDelay: '14s' }}>
          {Array.from({ length: 11 }).map((_, i) => {
            const fade = i / 11;
            const size = 1.5 - fade * 1.2;
            return (
              <span key={i} className="absolute" style={{
                top: '50%',
                right: `${(i + 1) * 10}px`,
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                background: '#ecb48a',
                opacity: 1 - fade * 0.95,
                transform: 'translateY(-50%)',
                boxShadow: `0 0 ${2.5 - fade * 2}px rgba(236,180,138,${0.5 - fade * 0.45})`,
              }} />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Hero: Cosmic Tree — Yggdrasil with live market leaves ────────────────
// Organic branch topology, glow filter, draw-in animation, market-data fruits.
const TREE_BRANCHES: { d: string; delay: number; thick: number }[] = [
  // Trunk (main vertical, slight S-curve)
  { d: 'M 500 880 C 498 780, 502 680, 500 580 C 498 490, 502 420, 500 340', delay: 0, thick: 7 },
  // Lower-left main branch
  { d: 'M 500 760 C 470 740, 410 720, 350 680 C 300 645, 260 610, 220 560', delay: 1.1, thick: 4.5 },
  // Lower-right main branch
  { d: 'M 500 760 C 540 740, 610 720, 680 680 C 730 650, 780 610, 810 560', delay: 1.3, thick: 4.5 },
  // Mid-left branch
  { d: 'M 500 620 C 460 600, 400 580, 340 540 C 300 510, 270 480, 250 440', delay: 1.8, thick: 3.8 },
  // Mid-right branch
  { d: 'M 500 620 C 545 605, 605 588, 665 555 C 710 528, 745 500, 770 465', delay: 2.0, thick: 3.8 },
  // Upper-left arch
  { d: 'M 500 490 C 458 470, 410 450, 365 420 C 325 395, 300 370, 285 340', delay: 2.5, thick: 3.2 },
  // Upper-right arch
  { d: 'M 500 490 C 545 470, 595 450, 640 418 C 680 392, 710 370, 730 338', delay: 2.7, thick: 3.2 },
  // Sub-branch lower-left-outer
  { d: 'M 300 620 C 275 595, 248 570, 220 540 C 198 515, 180 490, 170 462', delay: 3.1, thick: 2.4 },
  // Sub-branch lower-right-outer
  { d: 'M 700 620 C 725 595, 755 570, 785 540 C 808 515, 825 490, 835 462', delay: 3.3, thick: 2.4 },
  // Crown-left
  { d: 'M 440 410 C 420 385, 400 358, 380 325 C 365 295, 355 268, 350 240', delay: 3.7, thick: 2.6 },
  // Crown-center-left
  { d: 'M 485 370 C 478 340, 472 305, 468 270 C 465 242, 466 220, 470 195', delay: 3.9, thick: 2.4 },
  // Crown-center-right
  { d: 'M 515 370 C 522 340, 528 305, 532 270 C 535 242, 534 220, 530 195', delay: 4.0, thick: 2.4 },
  // Crown-right
  { d: 'M 560 410 C 580 385, 600 358, 620 325 C 635 295, 645 268, 650 240', delay: 4.1, thick: 2.6 },
  // Whispy upper-left
  { d: 'M 380 325 C 360 300, 345 275, 330 248', delay: 4.6, thick: 1.6 },
  // Whispy upper-right
  { d: 'M 620 325 C 640 300, 655 275, 670 248', delay: 4.7, thick: 1.6 },
  // Tiny crown tips
  { d: 'M 470 195 C 465 175, 460 155, 455 135', delay: 5.0, thick: 1.3 },
  { d: 'M 530 195 C 535 175, 540 155, 545 135', delay: 5.1, thick: 1.3 },
];

// Leaf anchor points (branch tips) — live markets will occupy these slots
const LEAF_ANCHORS: [number, number][] = [
  [220, 560], [810, 560],     // lower branches
  [250, 440], [770, 465],     // mid branches
  [285, 340], [730, 338],     // upper arches
  [170, 462], [835, 462],     // outer sub-branches
  [350, 240], [650, 240],     // crown outer
  [470, 195], [530, 195],     // crown centers
  [330, 248], [670, 248],     // whispy
  [455, 135], [545, 135],     // crown tips
];

function CosmicTree({ markets }: { markets: LiveMarket[] }) {
  const [drawn, setDrawn] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 150);
    return () => clearTimeout(t);
  }, []);

  // Map markets to leaf anchors
  const leaves = useMemo(() => {
    const count = Math.min(markets.length, LEAF_ANCHORS.length);
    const maxVol = Math.max(1, ...markets.map((m) => m.volume || 0));
    return Array.from({ length: count }, (_, i) => {
      const m = markets[i];
      const [x, y] = LEAF_ANCHORS[i];
      const volNorm = (m.volume || 0) / maxVol;
      return {
        ...m,
        x, y,
        size: 6 + volNorm * 5,
        glow: 0.7 + volNorm * 0.3,
        pulse: 2.6 + (1 - volNorm) * 2.4,
        delay: 5.5 + i * 0.08,
      };
    });
  }, [markets]);

  return (
    <div className="absolute inset-0 z-[3] pointer-events-none" aria-hidden={markets.length === 0}>
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMax meet"
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Ethereal glow filter */}
          <filter id="treeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Leaf bloom filter */}
          <filter id="leafGlow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="4" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Trunk gradient (warmer at base, cooler at top) */}
          <linearGradient id="trunkGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#fff2d8" stopOpacity="0.95" />
            <stop offset="20%" stopColor="#ecb48a" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#d99875" stopOpacity="0.75" />
            <stop offset="85%" stopColor="#b8613a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#7a4428" stopOpacity="0.35" />
          </linearGradient>
          {/* Root glow — replaces sun position */}
          <radialGradient id="rootGlow" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="#fff2d8" stopOpacity="0.9" />
            <stop offset="15%" stopColor="#ecb48a" stopOpacity="0.6" />
            <stop offset="35%" stopColor="#d67347" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#b8613a" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="leafCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7e8" stopOpacity="1" />
            <stop offset="40%" stopColor="#ecb48a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#d67347" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Root glow at base (the sun becomes seed) */}
        <ellipse cx="500" cy="890" rx="280" ry="90" fill="url(#rootGlow)" opacity="0.9">
          <animate attributeName="rx" values="280;310;280" dur="9s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="500" cy="895" rx="140" ry="40" fill="url(#rootGlow)" opacity="1">
          <animate attributeName="opacity" values="1;0.7;1" dur="6s" repeatCount="indefinite" />
        </ellipse>

        {/* Sway group — gentle rotation from the root */}
        <g style={{ transformOrigin: '500px 890px', animation: 'treeSway 14s ease-in-out infinite' }}>
          {/* Branches with staggered draw-in + glow */}
          <g filter="url(#treeGlow)">
            {TREE_BRANCHES.map((b, i) => (
              <path
                key={i}
                d={b.d}
                stroke="url(#trunkGrad)"
                strokeWidth={b.thick}
                strokeLinecap="round"
                fill="none"
                style={{
                  strokeDasharray: 1200,
                  strokeDashoffset: drawn ? 0 : 1200,
                  transition: `stroke-dashoffset 2.5s cubic-bezier(0.22, 1, 0.36, 1) ${b.delay}s`,
                  opacity: drawn ? 1 : 0,
                }}
              />
            ))}
          </g>

          {/* Leaves (live markets as glowing fruits) */}
          <g>
            {leaves.map((leaf) => {
              const isHovered = hoveredId === leaf.id;
              return (
                <Link key={leaf.id} href={`/market/${leaf.id}`} legacyBehavior>
                  <a
                    className="pointer-events-auto"
                    onMouseEnter={() => setHoveredId(leaf.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <g
                      style={{
                        opacity: drawn ? 1 : 0,
                        transform: isHovered ? 'scale(1.35)' : 'scale(1)',
                        transformOrigin: `${leaf.x}px ${leaf.y}px`,
                        transition: `opacity 1.2s ease-out ${leaf.delay}s, transform 0.4s ease-out`,
                      }}
                    >
                      {/* Outer bloom */}
                      <circle
                        cx={leaf.x} cy={leaf.y}
                        r={leaf.size * 2.2}
                        fill="url(#leafCore)"
                        opacity={leaf.glow * 0.5}
                      >
                        <animate attributeName="r" values={`${leaf.size * 2.2};${leaf.size * 2.6};${leaf.size * 2.2}`} dur={`${leaf.pulse}s`} repeatCount="indefinite" />
                        <animate attributeName="opacity" values={`${leaf.glow * 0.35};${leaf.glow * 0.6};${leaf.glow * 0.35}`} dur={`${leaf.pulse}s`} repeatCount="indefinite" />
                      </circle>
                      {/* Core */}
                      <circle
                        cx={leaf.x} cy={leaf.y}
                        r={leaf.size * 0.45}
                        fill="#fff7e8"
                        filter="url(#leafGlow)"
                        opacity={leaf.glow}
                      />
                    </g>
                  </a>
                </Link>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Tooltip layer (HTML overlay so it doesn't fight SVG hover) */}
      {hoveredId && (() => {
        const leaf = leaves.find((l) => l.id === hoveredId);
        if (!leaf) return null;
        // Project SVG coords to percentage for HTML overlay
        const xPct = (leaf.x / 1000) * 100;
        const yPct = (leaf.y / 1000) * 100;
        return (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: 'translate(-50%, calc(-100% - 14px))',
              zIndex: 50,
            }}
          >
            <div
              className="px-3 py-2 mono text-[0.6rem] uppercase tracking-[0.22em] whitespace-nowrap"
              style={{
                background: 'rgba(10,8,20,0.94)',
                border: '1px solid rgba(232,150,96,0.4)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ color: '#ecb48a', letterSpacing: '0.22em' }}>
                {leaf.name.length > 26 ? leaf.name.slice(0, 26) + '…' : leaf.name}
              </div>
              <div className="text-[#8a7f72] mt-1 flex items-center gap-2">
                <span style={{ color: '#f4eee4' }}>◎{leaf.volume.toFixed(2)}</span>
                <span>·</span>
                <span>{leaf.participants} votes</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Hero: Plasma sun (SVG with animated turbulence) ───────────────────────
function PlasmaSun() {
  return (
    <svg aria-hidden viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      <defs>
        <filter id="plasma-dist" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.013 0.011" numOctaves="3" seed="7" result="noise">
            <animate attributeName="baseFrequency" values="0.013 0.011; 0.022 0.018; 0.013 0.011" dur="14s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff2d8" />
          <stop offset="10%" stopColor="#ffd7a8" />
          <stop offset="28%" stopColor="#d99875" />
          <stop offset="46%" stopColor="#d67347" />
          <stop offset="62%" stopColor="#b8613a" stopOpacity="0.45" />
          <stop offset="80%" stopColor="#7a4428" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0a0814" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="core-hot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7e8" />
          <stop offset="40%" stopColor="#ecb48a" stopOpacity="0.6" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <g filter="url(#plasma-dist)" opacity="0.95">
        <circle cx="0" cy="0" r="78" fill="url(#core)" />
      </g>
      <g style={{ mixBlendMode: 'screen' }} opacity="0.55">
        <circle cx="0" cy="0" r="58" fill="url(#core)" filter="url(#plasma-dist)" />
      </g>
      <circle cx="0" cy="0" r="22" fill="url(#core-hot)">
        <animate attributeName="r" values="22;23.5;22" dur="6s" repeatCount="indefinite" />
      </circle>
      <circle cx="0" cy="0" r="6" fill="#fff7e8" opacity="0.9" />
    </svg>
  );
}

// ─── Hero: Registration corner marks ───────────────────────────────────────
function RegMark({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-4 h-4 z-20 pointer-events-none';
  const map = {
    tl: `${base} top-4 left-4 md:top-6 md:left-6 border-t border-l`,
    tr: `${base} top-4 right-4 md:top-6 md:right-6 border-t border-r`,
    bl: `${base} bottom-4 left-4 md:bottom-6 md:left-6 border-b border-l`,
    br: `${base} bottom-4 right-4 md:bottom-6 md:right-6 border-b border-r`,
  } as const;
  return <div className={map[pos]} style={{ borderColor: 'rgba(244,238,228,0.18)' }} />;
}

// ─── Hero: Horizon ticker ──────────────────────────────────────────────────
function HorizonTicker({ markets }: { markets: LiveMarket[] }) {
  const fallback = ['IDEA-001', 'LAUNCH-PROTOCOL', 'STELLAR-INDEX', 'NEBULA-FUND', 'ORBIT-CAPITAL', 'VECTOR-ZERO'];
  const items = markets.length > 0 ? markets.slice(0, 12).map((m) => m.name.toUpperCase()) : fallback;
  const loop = [...items, ...items, ...items];
  return (
    <div className="absolute left-0 right-0 overflow-hidden pointer-events-none z-[5]" style={{ bottom: '50vh', height: '26px', transform: 'translateY(-50%)' }}>
      <div className="flex gap-10 mono text-[0.62rem] uppercase tracking-[0.28em] whitespace-nowrap" style={{ color: 'rgba(244,238,228,0.35)', animation: 'tickerScroll 90s linear infinite', width: 'max-content' }}>
        {loop.map((name, i) => (
          <span key={i} className="inline-flex items-center gap-3">
            <span className="inline-block w-1 h-1 rounded-full" style={{ background: '#e89660' }} />
            <span>{name}</span>
            <span className="text-[#8a7f72]">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Hero: Live markets as interactive stars ───────────────────────────────
function hashId(id: string) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) + id.charCodeAt(i);
  return h >>> 0;
}

function LiveMarketStars({ markets, yOffset }: { markets: LiveMarket[]; yOffset: any }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const positioned = useMemo(() => {
    if (markets.length === 0) return [];
    const maxVol = Math.max(1, ...markets.map((m) => m.volume || 0));
    const maxParts = Math.max(1, ...markets.map((m) => m.participants || 0));
    return markets.map((m) => {
      const h1 = hashId(m.id);
      const h2 = hashId(m.id + '_y');
      const x = 8 + (h1 % 10000) / 10000 * 84;     // 8–92% range (avoid edges)
      const y = 6 + (h2 % 10000) / 10000 * 48;     // 6–54% (upper sky)
      const volNorm = (m.volume || 0) / maxVol;
      const partNorm = (m.participants || 0) / maxParts;
      const size = 2.6 + volNorm * 2.4 + partNorm * 0.8;
      const glow = 0.55 + volNorm * 0.45;
      const pulse = 2.2 + (1 - partNorm) * 3.5;
      return { ...m, x, y, size, glow, pulse };
    });
  }, [markets]);

  if (positioned.length === 0) return null;

  return (
    <motion.div className="absolute inset-0 z-[4]" style={{ y: yOffset }}>
      {positioned.map((s) => {
        const isHovered = hoveredId === s.id;
        return (
          <Link
            key={s.id}
            href={`/market/${s.id}`}
            className="absolute group"
            style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Outer soft halo */}
            <span
              className="absolute inset-0 rounded-full transition-all duration-500 pointer-events-none"
              style={{
                width: `${s.size * 6}px`,
                height: `${s.size * 6}px`,
                left: `-${s.size * 2.5}px`,
                top: `-${s.size * 2.5}px`,
                background: `radial-gradient(circle, rgba(255,106,61,${s.glow * 0.25}) 0%, transparent 65%)`,
                transform: isHovered ? 'scale(1.8)' : 'scale(1)',
              }}
            />
            {/* Core */}
            <span
              className="block rounded-full transition-transform duration-300 group-hover:scale-[2.2]"
              style={{
                width: `${s.size}px`,
                height: `${s.size}px`,
                background: '#fff5e1',
                boxShadow: `0 0 ${s.size * 2}px rgba(255,215,168,${s.glow}), 0 0 ${s.size * 5}px rgba(255,138,76,${s.glow * 0.5})`,
                animation: `liveStarPulse ${s.pulse}s ease-in-out infinite`,
              }}
            />
            {/* Tooltip */}
            {isHovered && (
              <div
                className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-50"
                style={{ bottom: `calc(100% + 14px)` }}
              >
                <div
                  className="px-3 py-2 mono text-[0.6rem] uppercase tracking-[0.22em] whitespace-nowrap"
                  style={{
                    background: 'rgba(7,6,10,0.94)',
                    border: '1px solid rgba(255,106,61,0.4)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                >
                  <div style={{ color: '#ecb48a', letterSpacing: '0.22em' }}>
                    {s.name.length > 28 ? s.name.slice(0, 28) + '…' : s.name}
                  </div>
                  <div className="text-[#8a7f72] mt-1 flex items-center gap-2">
                    <span style={{ color: '#f4eee4' }}>◎{s.volume.toFixed(2)}</span>
                    <span>·</span>
                    <span>{s.participants} votes</span>
                    {s.yesPercent !== null && s.yesPercent !== undefined && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#e89660' }}>{Math.round(s.yesPercent)}% YES</span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className="mx-auto w-2 h-2 rotate-45 -mt-[5px]"
                  style={{
                    background: 'rgba(7,6,10,0.94)',
                    borderRight: '1px solid rgba(255,106,61,0.4)',
                    borderBottom: '1px solid rgba(255,106,61,0.4)',
                  }}
                />
              </div>
            )}
          </Link>
        );
      })}
    </motion.div>
  );
}

// ─── Meteor cursor ─────────────────────────────────────────────────────────
function MeteorCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let cx = -100, cy = -100;
    const trail: { x: number; y: number; t: number }[] = [];
    const onMove = (e: MouseEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      trail.push({ x: cx, y: cy, t: performance.now() });
      if (trail.length > 22) trail.shift();
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const now = performance.now();
      // Draw trail (oldest dimmest)
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const age = (now - p.t) / 600;
        if (age > 1) continue;
        const fade = 1 - age;
        const r = 0.8 + (i / trail.length) * 2.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 168, ${fade * 0.45})`;
        ctx.fill();
      }
      // Head glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      grad.addColorStop(0, 'rgba(255,242,216,0.7)');
      grad.addColorStop(0.4, 'rgba(255,178,107,0.3)');
      grad.addColorStop(1, 'rgba(255,106,61,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 14, cy - 14, 28, 28);
      // Bright core
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 247, 232, 0.95)';
      ctx.fill();
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 100 }} aria-hidden />;
}

// ─── Chapter starfield — simpler twinkle-only starfield that persists behind all chapters ────────
// No parallax, no constellation, no shooting stars — just stars so the cosmic atmosphere extends
// past the hero instead of dropping into solid black.
function ChapterStarfield() {
  const [stars, setStars] = useState<Array<{ x: number; y: number; size: number; color: string; opacity: number; twinkleDur: number; twinkleDelay: number }>>([]);
  useEffect(() => {
    const COLORS = ['#fff5e1', '#ffd7a8', '#ffa366', '#d99875'];
    const generated = [];
    // 180 stars spread across a tall area (covers scroll below hero)
    for (let i = 0; i < 180; i++) {
      generated.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 1.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: 0.3 + Math.random() * 0.35,
        twinkleDur: 3.5 + Math.random() * 5,
        twinkleDelay: Math.random() * 6,
      });
    }
    setStars(generated);
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {stars.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            borderRadius: '50%',
            background: s.color,
            opacity: s.opacity,
            boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            animation: `starTwinkle ${s.twinkleDur}s ease-in-out infinite`,
            animationDelay: `${s.twinkleDelay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Sticky chapter companion — a small cosmic tree silhouette that persists across chapters ─────
// Morphs through 6 states: seed → barrier → shift → grow → bloom → forest
function ChapterCompanion({ opacity, y, stage }: { opacity: MotionValue<number>; y: MotionValue<string>; stage: MotionValue<number> }) {
  const [currentStage, setCurrentStage] = useState(0);
  useMotionValueEvent(stage, 'change', (v) => {
    const rounded = Math.max(0, Math.min(5, Math.round(v)));
    if (rounded !== currentStage) setCurrentStage(rounded);
  });

  return (
    <motion.div
      aria-hidden
      className="hidden lg:block fixed z-[15] pointer-events-none"
      style={{
        opacity,
        y,
        right: '3vw',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '140px',
        height: '340px',
      }}
    >
      <svg viewBox="0 0 140 340" className="w-full h-full" aria-hidden>
        <defs>
          <linearGradient id="companionTrunk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(236,180,138,0.95)" />
            <stop offset="50%" stopColor="rgba(236,180,138,0.8)" />
            <stop offset="100%" stopColor="rgba(138,58,16,0.9)" />
          </linearGradient>
          <radialGradient id="companionSun">
            <stop offset="0%" stopColor="#e89628" stopOpacity="1" />
            <stop offset="70%" stopColor="#8a3a10" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8a3a10" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Horizon — always present */}
        <line x1="10" y1="210" x2="130" y2="210" stroke="rgba(230,180,115,0.35)" strokeWidth="0.6" />

        {/* === Stage 0: Seed — just the sun at the horizon === */}
        <g style={{ opacity: currentStage === 0 ? 1 : 0, transition: 'opacity 0.6s ease-out' }}>
          <circle cx="70" cy="210" r="9" fill="url(#companionSun)" />
          <circle cx="70" cy="210" r="4.5" fill="#e89628" />
        </g>

        {/* === Stage 1: Barrier — seed in cracked earth, dormant === */}
        <g style={{ opacity: currentStage === 1 ? 1 : 0, transition: 'opacity 0.6s ease-out' }}>
          <circle cx="70" cy="216" r="7" fill="#8a3a10" opacity="0.85" />
          <circle cx="70" cy="216" r="3.5" fill="#d67347" opacity="0.95" />
          {/* Dark earth */}
          <path d="M 10 215 L 130 215 L 128 225 L 12 228 Z" fill="rgba(74,37,21,0.4)" />
          {/* Cracks */}
          <line x1="30" y1="220" x2="50" y2="230" stroke="rgba(74,37,21,0.6)" strokeWidth="0.6" />
          <line x1="85" y1="222" x2="110" y2="228" stroke="rgba(74,37,21,0.6)" strokeWidth="0.6" />
        </g>

        {/* === Stage 2: Shift — photon rising from seed === */}
        <g style={{ opacity: currentStage === 2 ? 1 : 0, transition: 'opacity 0.6s ease-out' }}>
          <circle cx="70" cy="210" r="9" fill="url(#companionSun)" />
          <line x1="70" y1="205" x2="70" y2="60" stroke="rgba(255,244,184,0.7)" strokeWidth="1.2" />
          <circle cx="70" cy="110" r="4" fill="#fff4b8" />
          <circle cx="70" cy="85" r="2" fill="#fff4b8" opacity="0.7" />
          <circle cx="70" cy="60" r="1.5" fill="#fff4b8" opacity="0.5" />
        </g>

        {/* === Stage 3: Grow — trunk forming, two energy streams converging === */}
        <g style={{ opacity: currentStage === 3 ? 1 : 0, transition: 'opacity 0.6s ease-out' }}>
          <circle cx="70" cy="210" r="8" fill="url(#companionSun)" />
          {/* Trunk */}
          <path d="M 70 205 Q 72 170 68 135 Q 66 100 70 75" stroke="url(#companionTrunk)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* Believers stream (left) */}
          <path d="M 15 100 Q 40 140 68 180" stroke="rgba(63,122,66,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="30" cy="120" r="1.5" fill="#3f7a42" opacity="0.8" />
          {/* Critics stream (right) */}
          <path d="M 125 100 Q 100 140 72 180" stroke="rgba(214,115,71,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="110" cy="120" r="1.5" fill="#d67347" opacity="0.8" />
        </g>

        {/* === Stage 4: Bloom — full tree with canopy leaves === */}
        <g style={{ opacity: currentStage === 4 ? 1 : 0, transition: 'opacity 0.6s ease-out' }}>
          <circle cx="70" cy="210" r="7" fill="url(#companionSun)" />
          {/* Trunk */}
          <path d="M 70 206 Q 72 180 68 150 Q 66 120 70 95 Q 72 75 70 60" stroke="url(#companionTrunk)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          {/* Branches */}
          <path d="M 70 140 Q 55 125 40 110" stroke="rgba(217,152,117,0.8)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M 70 135 Q 85 120 100 105" stroke="rgba(217,152,117,0.8)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M 70 100 Q 55 85 42 70" stroke="rgba(184,97,58,0.7)" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M 70 100 Q 85 85 98 70" stroke="rgba(184,97,58,0.7)" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M 70 75 Q 68 60 70 48" stroke="rgba(184,97,58,0.7)" strokeWidth="1" fill="none" strokeLinecap="round" />
          {/* Leaves */}
          {[
            [40, 110, 3], [100, 105, 3], [42, 70, 3], [98, 70, 3], [70, 48, 3.5],
            [55, 125, 2.4], [85, 120, 2.4], [55, 85, 2.4], [85, 85, 2.4],
            [50, 95, 1.8], [90, 95, 1.8], [65, 55, 2], [75, 55, 2],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x as number} cy={y as number} r={r as number} fill="#3f7a42" opacity="0.85" />
          ))}
        </g>

        {/* === Stage 5: Forest — multiple tiny trees on the horizon === */}
        <g style={{ opacity: currentStage === 5 ? 1 : 0, transition: 'opacity 0.6s ease-out' }}>
          {/* Scattered tiny trees */}
          {[
            [22, 80], [40, 60], [55, 75], [70, 50], [85, 70], [100, 55], [118, 75],
            [30, 100], [48, 90], [62, 105], [78, 92], [94, 102], [112, 95], [14, 95],
          ].map(([cx, cy], i) => (
            <g key={i} transform={`translate(${cx} 210)`}>
              <line x1="0" y1="0" x2="0" y2={-(210 - cy)} stroke="rgba(217,152,117,0.6)" strokeWidth="0.8" />
              <circle cx="0" cy={-(210 - cy)} r="1.8" fill="rgba(63,122,66,0.7)" />
            </g>
          ))}
          {/* Closest tree — slightly more detailed */}
          <path d="M 70 210 Q 72 195 70 175 Q 68 155 70 140" stroke="url(#companionTrunk)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <circle cx="70" cy="140" r="3" fill="#3f7a42" opacity="0.85" />
          <circle cx="63" cy="150" r="2" fill="#3f7a42" opacity="0.7" />
          <circle cx="78" cy="150" r="2" fill="#3f7a42" opacity="0.7" />
        </g>

        {/* Chapter label */}
        <text x="70" y="320" fill="rgba(232,150,96,0.65)" textAnchor="middle" style={{ font: "500 8px ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.3em", textTransform: "uppercase" }}>
          {['I · Seed', 'II · Barrier', 'III · Shift', 'IV · Grow', 'V · Bloom', 'VI · Forest'][currentStage]}
        </text>
      </svg>
    </motion.div>
  );
}

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

  // Sticky chapter companion — fades in during chapters I-VI and morphs with scroll.
  // 0.00-0.14 = hero (hidden), 0.14-0.90 = chapters (visible, morphing), 0.90-1.0 = footer (hidden)
  const companionOpacity = useTransform(scrollYProgress, [0.10, 0.18, 0.86, 0.94], [0, 0.85, 0.85, 0]);
  const companionY = useTransform(scrollYProgress, [0.10, 0.90], ['20px', '0px']);
  // Chapter state — drives which tree silhouette is active (0=seed, 1=barrier, 2=shift, 3=grow, 4=bloom, 5=forest)
  const companionStage = useTransform(scrollYProgress, [0.14, 0.26, 0.40, 0.55, 0.70, 0.84], [0, 1, 2, 3, 4, 5]);
  const { authenticated, user, login, ready, primaryWallet } = useWallet();
  const router = useRouter();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [isSettingUpProfile, setIsSettingUpProfile] = useState(false);
  const [pitchPending, setPitchPending] = useState(false);
  const hasSetupProfileRef = useRef(false);

  // Hero live data + scroll-linked effects
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const sunY = useTransform(heroScroll, [0, 1], ['0vh', '-40vh']);
  const sunOpacityHero = useTransform(heroScroll, [0, 0.85], [1, 0]);
  const heroContentY = useTransform(heroScroll, [0, 1], ['0%', '-18%']);
  const starsFarY = useTransform(heroScroll, [0, 1], ['0%', '-6%']);
  const starsMidY = useTransform(heroScroll, [0, 1], ['0%', '-14%']);
  const starsNearY = useTransform(heroScroll, [0, 1], ['0%', '-24%']);
  const launchRef = useRef<HTMLSpanElement>(null);
  const plantRef = useRef<HTMLDivElement>(null);
  useMotionValueEvent(heroScroll, 'change', (v) => {
    if (!launchRef.current) return;
    const wonk = Math.min(1, Math.max(0, v * 2));
    const soft = 100 - v * 60;
    launchRef.current.style.fontVariationSettings = `'SOFT' ${soft.toFixed(0)}, 'WONK' ${wonk.toFixed(2)}, 'opsz' 144`;
  });

  // Typography breath — gentle sine-wave on the SOFT axis so the hero headline feels alive
  useEffect(() => {
    let rafId: number;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      // "Plant the idea" — SOFT cycles 35↔50 over 7.5s, WONK stays 0
      if (plantRef.current) {
        const soft = 42 + Math.sin((elapsed * Math.PI * 2) / 7.5) * 7.5;
        plantRef.current.style.fontVariationSettings = `'SOFT' ${soft.toFixed(1)}, 'WONK' 0, 'opsz' 144`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const { count: liveMarkets, volume: openVolume, markets: liveMarketList } = useLiveMarkets();


  // Auto-setup profile after authentication
  useEffect(() => {
    const setupProfile = async () => {
      console.log('🔍 Auth state check:', { authenticated, hasUser: !!user, isSettingUpProfile, hasSaved: hasSetupProfileRef.current });

      if (authenticated && user && !hasSetupProfileRef.current) {
        const walletAddress = user.wallet?.address;
        if (!walletAddress) {
          if (!pitchPending) router.push('/wallet');
          setShowOnboardingModal(false);
          setIsSettingUpProfile(false);
          return;
        }

        hasSetupProfileRef.current = true;

        setShowOnboardingModal(false);
        setIsSettingUpProfile(false);
        // If a pitch is pending, the pitch effect handles routing (to /create or /wallet based on balance);
        // otherwise fall back to the default post-auth destination of /wallet.
        if (!pitchPending) {
          console.log('🚀 User authenticated! Redirecting to /wallet...');
          router.push('/wallet');
        }

        // Background profile setup
        try {
          // Check if profile already exists and has username
          const checkResponse = await authFetch(`/api/profile/${walletAddress}`);
          const checkResult = await checkResponse.json();

          if (checkResult.success && checkResult.data?.username) {
            // User already has a profile - nothing to do
            console.log('✅ Existing user detected - profile already exists');
            return;
          }

          // New user - generate random profile in background
          console.log('🎲 New user detected, generating random profile in background...');

          // Generate random username
          const adjectives = ['Cosmic', 'Stellar', 'Lunar', 'Solar', 'Astral', 'Nebula', 'Galactic', 'Celestial', 'Orbit', 'Quantum'];
          const nouns = ['Explorer', 'Voyager', 'Pioneer', 'Wanderer', 'Navigator', 'Traveler', 'Seeker', 'Dreamer', 'Rider', 'Hunter'];
          const randomNum = Math.floor(Math.random() * 1000);
          const randomUsername = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${randomNum}`;

          // Random cosmic avatar
          const cosmicAvatars = [
            '/cosmic-avatars/nebula.svg',
            '/cosmic-avatars/galaxy.svg',
            '/cosmic-avatars/pulsar.svg',
            '/cosmic-avatars/blackhole.svg',
            '/cosmic-avatars/supernova.svg',
            '/cosmic-avatars/quasar.svg',
            '/cosmic-avatars/moonphase.svg',
            '/cosmic-avatars/starcluster.svg',
            '/cosmic-avatars/comet.svg'
          ];
          const randomAvatar = cosmicAvatars[Math.floor(Math.random() * cosmicAvatars.length)];

          console.log('💾 Saving profile in background:', { username: randomUsername, avatar: randomAvatar });

          // Save profile
          const response = await authFetch('/api/profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress,
              username: randomUsername,
              profilePhotoUrl: randomAvatar,
              email: user?.email,
            }),
          });

          const result = await response.json();

          if (result.success) {
            console.log('✅ Background profile creation completed successfully');
          } else {
            console.error('❌ Background profile creation failed:', result);
          }
        } catch (error) {
          console.error('💥 Error in background profile setup:', error);
        }
      }
    };

    setupProfile();
  }, [authenticated, user, isSettingUpProfile, router]);

  const PITCH_MIN_SOL = 0.015;

  // Route an authenticated pitcher: /wallet if they need to top up, /create if they're launch-ready
  const routeAuthenticatedPitcher = async () => {
    if (!primaryWallet?.address) {
      router.push('/wallet');
      return;
    }
    try {
      const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
      const rpcEndpoint = network === 'mainnet-beta'
        ? process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC
        : process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC;
      const connection = new Connection(rpcEndpoint!, 'confirmed');
      const lamports = await connection.getBalance(new PublicKey(primaryWallet.address));
      const sol = lamports / LAMPORTS_PER_SOL;
      router.push(sol < PITCH_MIN_SOL ? '/wallet' : '/create');
    } catch (err) {
      console.error('[pitch] balance check failed, routing to /wallet', err);
      router.push('/wallet');
    }
  };

  const handleLaunchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!authenticated) {
      // Not signed in — open onboarding and remember the pitch intent so the flow resumes after login
      setPitchPending(true);
      setShowOnboardingModal(true);
      return;
    }
    routeAuthenticatedPitcher();
  };

  // Post-login continuation: if a pitch was pending and the user just authenticated,
  // close the modal and resume the balance-based routing automatically.
  useEffect(() => {
    if (pitchPending && authenticated && primaryWallet?.address) {
      setPitchPending(false);
      setShowOnboardingModal(false);
      routeAuthenticatedPitcher();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, primaryWallet?.address, pitchPending]);

  const handleJoinUniverse = () => {
    // Keep modal open, show it's processing, and trigger Privy login
    setIsSettingUpProfile(true);
    login();
  };

  const handleContinueAsGuest = () => {
    // Close modal and go to browse without auth
    setShowOnboardingModal(false);
    router.push('/browse');
  };

  // Check auth on mount - redirect authenticated users immediately (unless a pitch is in progress)
  useEffect(() => {
    if (ready && authenticated && user && !pitchPending) {
      console.log('🎯 User already authenticated, redirecting to /wallet');
      router.push('/wallet');
    }
  }, [ready, authenticated, user, router, pitchPending]);

  return (
    <>
      {/* Persistent cosmic sky — twinkling stars behind every chapter below the hero */}
      <ChapterStarfield />
      {/* Sticky chapter companion — persistent SVG tree that narrates alongside the scroll */}
      <ChapterCompanion opacity={companionOpacity} y={companionY} stage={companionStage} />

      <div className="space-y-12 md:space-y-20 pt-3 sm:pt-4 px-3 sm:px-6 pb-8 md:pb-12 relative overflow-hidden">

        {/* ═══════════ Hero — Editorial Cosmic ═══════════ */}
        <section
          ref={heroRef}
          className="relative min-h-screen overflow-hidden -mx-3 sm:-mx-6 -mt-3 sm:-mt-4"
          style={{ background: '#0a0814' }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] opacity-[0.11] mix-blend-overlay"
            style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.86  0 0 0 0 0.6  0 0 0 0.4 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")` }} />
          {/* Stars — ideas in the sky */}
          <Starfield farY={starsFarY} midY={starsMidY} nearY={starsNearY} />
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[2]"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(7,6,10,0.55) 100%)' }} />
          {/* Cosmic Tree — full-viewport canvas; tree positioned right inside the 3D scene */}
          <motion.div className="absolute inset-0"
            style={{
              y: sunY,
              opacity: sunOpacityHero,
              zIndex: 3,
            }}>
            <CosmicTree3D markets={liveMarketList} />
          </motion.div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[55vh] z-[3]"
            style={{ background: 'linear-gradient(to top, rgba(7,6,10,0.85) 0%, rgba(7,6,10,0.3) 40%, transparent 82%)' }} />
          {/* Ground — 2D earth horizon: warm soil-tone line, tiny grass tufts above, soft shadow below */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[4]" style={{ bottom: '34.5vh' }}>
            <div className="relative">
              {/* Main horizon line — warm earth gradient that fades to transparent at both edges */}
              <div style={{
                height: '1.5px',
                backgroundImage: 'linear-gradient(to right, transparent 0%, rgba(200,145,90,0.5) 14%, rgba(230,180,115,0.7) 50%, rgba(200,145,90,0.5) 86%, transparent 100%)',
                boxShadow: '0 4px 14px -2px rgba(120,70,30,0.3)',
              }} />
              {/* Grass tufts above the line */}
              <svg className="absolute left-0 w-full"
                style={{ bottom: '1.5px', height: '7px', overflow: 'visible' }}
                viewBox="0 0 1000 7" preserveAspectRatio="none" aria-hidden>
                <g stroke="rgba(220,170,110,0.45)" strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke">
                  <line x1="110" y1="7" x2="110" y2="4" />
                  <line x1="125" y1="7" x2="125" y2="5.5" />
                  <line x1="175" y1="7" x2="175" y2="3" />
                  <line x1="200" y1="7" x2="200" y2="5" />
                  <line x1="240" y1="7" x2="240" y2="4" />
                  <line x1="285" y1="7" x2="285" y2="2.5" />
                  <line x1="315" y1="7" x2="315" y2="5" />
                  <line x1="355" y1="7" x2="355" y2="4" />
                  <line x1="395" y1="7" x2="395" y2="3" />
                  <line x1="430" y1="7" x2="430" y2="5" />
                  <line x1="475" y1="7" x2="475" y2="2.5" />
                  <line x1="515" y1="7" x2="515" y2="4.5" />
                  <line x1="555" y1="7" x2="555" y2="3" />
                  <line x1="590" y1="7" x2="590" y2="5" />
                  <line x1="635" y1="7" x2="635" y2="4" />
                  <line x1="675" y1="7" x2="675" y2="2.5" />
                  <line x1="715" y1="7" x2="715" y2="5" />
                  <line x1="755" y1="7" x2="755" y2="4" />
                  <line x1="800" y1="7" x2="800" y2="3" />
                  <line x1="835" y1="7" x2="835" y2="5" />
                  <line x1="875" y1="7" x2="875" y2="4" />
                </g>
              </svg>
              {/* Soil specks just below the line */}
              <svg className="absolute left-0 w-full"
                style={{ top: '1.5px', height: '5px', overflow: 'visible' }}
                viewBox="0 0 1000 5" preserveAspectRatio="none" aria-hidden>
                <g fill="rgba(160,100,55,0.4)">
                  <circle cx="140" cy="2" r="0.7" />
                  <circle cx="220" cy="3" r="0.5" />
                  <circle cx="300" cy="1.5" r="0.6" />
                  <circle cx="380" cy="3" r="0.6" />
                  <circle cx="455" cy="2" r="0.7" />
                  <circle cx="530" cy="3" r="0.5" />
                  <circle cx="610" cy="1.5" r="0.6" />
                  <circle cx="690" cy="2.5" r="0.6" />
                  <circle cx="770" cy="3" r="0.5" />
                  <circle cx="850" cy="2" r="0.7" />
                </g>
              </svg>
            </div>
          </div>

          {/* "watch it grow." — above the ground (sky side), 4vh above the horizon */}
          <motion.div
            ref={launchRef}
            aria-hidden
            className="absolute z-[5] serif italic"
            style={{
              bottom: '38.5vh',
              right: '6vw',
              fontSize: 'clamp(1.5rem, 4vw, 3.25rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              fontWeight: 400,
              color: 'transparent',
              backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ecb48a 30%, #d99875 65%, #d67347 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              paddingBottom: '0.05em',
              fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 144",
              fontFeatureSettings: '"swsh" 0, "cswh" 0, "salt" 0, "ss01" 0, "ss02" 0, "ss03" 0, "ss04" 0, "calt" 0',
            }}
            initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.55, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            watch it grow
          </motion.div>

          {/* "Plant the idea," — below the ground (soil side), 4vh below the horizon */}
          <motion.div
            ref={plantRef}
            aria-hidden
            className="absolute z-[5] serif"
            style={{
              bottom: '25vh',
              right: '6vw',
              fontSize: 'clamp(1.5rem, 4vw, 3.25rem)',
              lineHeight: 0.95,
              letterSpacing: '-0.025em',
              color: '#f4eee4',
              fontWeight: 400,
              fontVariationSettings: "'SOFT' 40, 'WONK' 0, 'opsz' 144",
            }}
            initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.2, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <span style={{ color: '#3f7a42' }}>Plant</span> the idea
          </motion.div>

          <nav className="relative z-10 flex items-center justify-between px-6 md:px-10 pt-4 md:pt-5">
            <Link href="/" className="flex items-baseline gap-3 group">
              <span className="serif text-[1.55rem] leading-none tracking-[-0.02em]"
                style={{ color: '#f4eee4', fontWeight: 500, fontVariationSettings: "'SOFT' 30, 'WONK' 0, 'opsz' 48" }}>
                P<span className="italic" style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1, 'opsz' 48" }}>n</span>L
              </span>
              <span className="w-px h-4 bg-[#8a7f72]/40" />
              <span className="mono text-[0.62rem] uppercase tracking-[0.24em] text-[#8a7f72]">Predict &amp; Launch</span>
            </Link>
            <div className="hidden md:flex items-center gap-5 mono text-[0.68rem] uppercase tracking-[0.24em] text-[#8a7f72]">
              <Link href="/launchpad" className="hover:text-[#f4eee4] transition-colors">Launchpad</Link>
              <span className="w-px h-3 bg-[#8a7f72]/30" />
              <a href="#thesis" onClick={(e) => { e.preventDefault(); document.getElementById('thesis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="hover:text-[#f4eee4] transition-colors cursor-pointer">Thesis</a>
            </div>
          </nav>

          <motion.div className="relative z-10 px-6 md:px-10 pt-[9vh] md:pt-[11vh] pb-[22vh]"
            style={{ y: heroContentY, minHeight: 'calc(100vh - 180px)' }}>
            <div className="max-w-[1200px]">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden
                className="mono text-[0.68rem] uppercase tracking-[0.3em] mb-8 md:mb-12 flex items-center gap-3 invisible"
                style={{ color: '#e89660' }}>
                <span className="inline-block w-10 h-px" style={{ background: '#e89660' }} />
                <span>Fueling the world&rsquo;s brilliant ideas · from anywhere, for everyone</span>
              </motion.div>

              {/* Invisible h1 preserves vertical space so the quote + CTAs stay at the same Y position.
                  The VISIBLE split headlines are absolutely-positioned below, tied to the ground horizon. */}
              <h1 aria-hidden className="serif leading-[0.95] tracking-[-0.025em] invisible"
                style={{ color: '#f4eee4', fontSize: 'clamp(2.5rem, 7.5vw, 6.5rem)', fontWeight: 400 }}>
                <span className="block">Plant the idea</span>
                <span className="block italic">watch it grow</span>
              </h1>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }}
                className="mt-12 md:mt-16 max-w-[58ch] flex flex-col gap-4">
                <p className="serif text-[1.2rem] md:text-[1.5rem] leading-[1.45] tracking-[-0.005em]"
                  style={{ color: '#e8dfd0', fontWeight: 400, fontStyle: 'italic', fontVariationSettings: "'SOFT' 100, 'WONK' 0.5, 'opsz' 36" }}>
                  &ldquo;When you want something, all the universe conspires in helping you to achieve it.&rdquo;
                </p>
                <p className="mono text-[0.62rem] uppercase tracking-[0.26em]" style={{ color: '#8a7f72' }}>
                  <span style={{ color: '#e89660' }}>—</span> The Alchemist
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 0.7 }}
                className="mt-12 md:mt-16 flex flex-col sm:flex-row gap-4 sm:gap-8 items-start">
                <Link href="/browse" className="group relative inline-flex items-center gap-3 px-7 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] font-semibold transition-colors duration-300"
                  style={{ background: '#e89660', color: '#0a0814' }}>
                  <span>Enter the markets</span>
                  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" className="transition-transform duration-300 group-hover:translate-x-1.5">
                    <path d="M1 5H19M19 5L14 1M19 5L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                  </svg>
                  <span className="absolute -right-0 -top-0 w-2 h-2" style={{ background: '#0a0814' }} />
                </Link>
                <button onClick={handleLaunchClick}
                  className="group inline-flex items-center gap-3 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] transition-colors"
                  style={{ color: '#f4eee4' }}>
                  <span className="relative inline-block after:absolute after:left-0 after:bottom-[-4px] after:h-px after:w-full after:bg-current after:scale-x-0 after:origin-left group-hover:after:scale-x-100 after:transition-transform after:duration-500">
                    Pitch your idea
                  </span>
                  <span className="text-[#8a7f72] group-hover:text-[#e89660] transition-colors">↗</span>
                </button>
              </motion.div>

            </div>

          </motion.div>

          <div className="absolute bottom-[9vh] md:bottom-[11vh] left-0 right-0 z-10 px-6 md:px-10 flex items-end justify-between pointer-events-none">
            <div className="mono text-[0.6rem] uppercase tracking-[0.28em] text-[#8a7f72] leading-[1.7]">
              <div style={{ color: '#f4eee4' }}>A protocol for ideas</div>
              <div className="flex items-center gap-2">
                <span>{liveMarkets.toString().padStart(3, '0')} live markets</span>
                <span className="text-[#8a7f72]">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#e89660' }} />
                  <span style={{ color: '#e89660' }}>Solana Mainnet</span>
                </span>
              </div>
            </div>
            <div className="mono text-[0.6rem] uppercase tracking-[0.28em] text-[#8a7f72] flex items-center gap-3">
              <span>Scroll</span>
              <span className="block w-px h-8" style={{ background: 'rgba(138,127,114,0.4)', animation: 'scrollbar 2.2s ease-in-out infinite' }} />
            </div>
          </div>

          <style jsx>{`
            @keyframes tickerScroll { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
            @keyframes cursorBlink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
            @keyframes scrollbar { 0%,100% { transform: scaleY(0.25); transform-origin: top; opacity: 0.35; } 50% { transform: scaleY(1); transform-origin: top; opacity: 1; } }
            @keyframes starTwinkle { 0%, 100% { opacity: var(--twinkle-min, 0.35); } 50% { opacity: 1; } }
            @keyframes liveStarPulse { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.35); filter: brightness(1.4); } }
            @keyframes treeSway { 0%, 100% { transform: rotate(-0.6deg); } 50% { transform: rotate(0.6deg); } }
            @keyframes shoot {
              0%, 88% { transform: translate(0, 0); opacity: 0; }
              89% { transform: translate(0, 0); opacity: 1; }
              96% { transform: translate(calc(70vw + 60px), 26vh); opacity: 1; }
              99% { transform: translate(calc(100vw + 160px), 38vh); opacity: 0.4; }
              100% { opacity: 0; }
            }
          `}</style>
        </section>

        {/* ═══════════ Live ticker — continuous marquee of real markets right below the hero ═══════════ */}
        {liveMarketList && liveMarketList.length > 0 && (
          <div className="relative -mx-3 sm:-mx-6 overflow-hidden border-t border-b py-4"
            style={{ background: 'rgba(10,8,20,0.75)', borderColor: 'rgba(244,238,228,0.06)' }}>
            <div
              className="flex gap-12 mono text-[0.62rem] uppercase tracking-[0.28em] whitespace-nowrap"
              style={{ color: 'rgba(244,238,228,0.55)', animation: 'liveTickerScroll 80s linear infinite', width: 'max-content' }}
            >
              {[...liveMarketList, ...liveMarketList, ...liveMarketList].map((m, i) => {
                const name = m.name ?? 'Untitled idea';
                const volume = Number(m.volume) || 0;
                const participants = Number(m.participants) || 0;
                const yesPercent = m.yesPercent != null ? Number(m.yesPercent) : null;
                return (
                  <span key={`${m.id}-${i}`} className="flex items-center gap-3">
                    <span style={{ color: '#e89660' }}>◐</span>
                    <span style={{ color: '#f4eee4' }}>
                      {name.length > 40 ? name.slice(0, 40) + '…' : name}
                    </span>
                    <span>◎{volume.toFixed(2)} staked</span>
                    <span style={{ color: '#8a7f72' }}>·</span>
                    <span>{participants} {participants === 1 ? 'voter' : 'voters'}</span>
                    {yesPercent != null && !Number.isNaN(yesPercent) && (
                      <>
                        <span style={{ color: '#8a7f72' }}>·</span>
                        <span style={{ color: yesPercent >= 50 ? '#3f7a42' : '#d67347' }}>
                          {Math.round(yesPercent)}% {yesPercent >= 50 ? 'believers' : 'critics'}
                        </span>
                      </>
                    )}
                    <span className="text-[#8a7f72] opacity-50 ml-4">◆</span>
                  </span>
                );
              })}
            </div>
            <style jsx>{`
              @keyframes liveTickerScroll {
                from { transform: translateX(0); }
                to { transform: translateX(-33.333%); }
              }
            `}</style>
          </div>
        )}

        {/* ═══════════ I / The seed ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-28 md:py-44 overflow-hidden" style={{ background: 'rgba(10,8,20,0.55)' }}>
          {/* Subtle seed orb — matches the sun color from the hero */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[14%] w-6 h-6 rounded-full"
            style={{
              background: 'radial-gradient(circle, #e89628 0%, #8a3a10 55%, transparent 100%)',
              boxShadow: '0 0 40px 10px rgba(232,150,40,0.3), 0 0 90px 25px rgba(232,150,40,0.1)',
            }} />
          <div className="grid grid-cols-12 gap-6 max-w-[1400px] mx-auto relative z-10">
            <div className="col-span-12 md:col-span-2 mono text-[0.64rem] uppercase tracking-[0.26em] mb-6 md:mb-0" style={{ color: '#e89660' }}>
              I / The seed
            </div>
            <div className="col-span-12 md:col-span-9 md:col-start-3">
              <h2 className="serif leading-[1.05] tracking-[-0.025em] mb-10 max-w-[22ch]"
                style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 72" }}>
                Every company started as one thought.
              </h2>
              <p className="serif text-[1.1rem] md:text-[1.25rem] leading-[1.6] max-w-[56ch] mb-5"
                style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                It happened to you too. An idea at 2am. A conversation that didn&rsquo;t stop with you. A pattern only you noticed. You told a friend, maybe wrote it down — and life moved on.
              </p>
              <p className="serif text-[1.1rem] md:text-[1.25rem] leading-[1.6] max-w-[56ch]"
                style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                Most ideas end there. Not because they were wrong — because there was nowhere to take them.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════ II / The barrier ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-24 md:py-40 border-t"
          style={{ background: 'rgba(10,8,20,0.55)', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div className="max-w-[1400px] mx-auto">
            <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>II / The barrier</div>
            <h2 className="serif leading-[1.05] tracking-[-0.025em] mb-14 max-w-[24ch]"
              style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 72" }}>
              The old path keeps most ideas underground.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-16">
              {/* Tile 1 — Venture: a closed gate, most decks never read */}
              <div className="relative flex flex-col gap-5 p-7 md:p-8 border" style={{ borderColor: 'rgba(244,238,228,0.08)', background: 'rgba(244,238,228,0.02)' }}>
                <div className="flex items-start justify-between">
                  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden>
                    <rect x="6" y="10" width="30" height="26" stroke="#8a7f72" strokeWidth="1.2" />
                    <line x1="12" y1="10" x2="12" y2="36" stroke="#8a7f72" strokeWidth="1.2" />
                    <line x1="18" y1="10" x2="18" y2="36" stroke="#8a7f72" strokeWidth="1.2" />
                    <line x1="24" y1="10" x2="24" y2="36" stroke="#8a7f72" strokeWidth="1.2" />
                    <line x1="30" y1="10" x2="30" y2="36" stroke="#8a7f72" strokeWidth="1.2" />
                    <circle cx="36" cy="23" r="2" fill="#e89660" />
                  </svg>
                  <div className="serif text-[2.5rem] leading-none" style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 30, 'opsz' 72" }}>
                    0.1<span className="text-[1rem] align-top ml-0.5">%</span>
                  </div>
                </div>
                <div className="mono text-[0.64rem] uppercase tracking-[0.26em]" style={{ color: '#8a7f72' }}>Venture</div>
                <h3 className="serif text-[1.3rem] leading-[1.25] tracking-[-0.01em]" style={{ color: '#f4eee4', fontVariationSettings: "'SOFT' 50, 'opsz' 36" }}>
                  Of all decks, this is what funds actually read.
                </h3>
              </div>

              {/* Tile 2 — Proximity: a wall between two circles */}
              <div className="relative flex flex-col gap-5 p-7 md:p-8 border" style={{ borderColor: 'rgba(244,238,228,0.08)', background: 'rgba(244,238,228,0.02)' }}>
                <div className="flex items-start justify-between">
                  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden>
                    <circle cx="10" cy="21" r="5" stroke="#8a7f72" strokeWidth="1.2" />
                    <circle cx="32" cy="21" r="5" stroke="#8a7f72" strokeWidth="1.2" />
                    <line x1="21" y1="6" x2="21" y2="36" stroke="#e89660" strokeWidth="1.5" strokeDasharray="2 3" />
                  </svg>
                  <div className="serif text-[2.5rem] leading-none" style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 30, 'opsz' 72" }}>
                    Who
                  </div>
                </div>
                <div className="mono text-[0.64rem] uppercase tracking-[0.26em]" style={{ color: '#8a7f72' }}>Proximity</div>
                <h3 className="serif text-[1.3rem] leading-[1.25] tracking-[-0.01em]" style={{ color: '#f4eee4', fontVariationSettings: "'SOFT' 50, 'opsz' 36" }}>
                  Your network, your school, your zip — not your idea.
                </h3>
              </div>

              {/* Tile 3 — Geography: a globe with a single lit dot */}
              <div className="relative flex flex-col gap-5 p-7 md:p-8 border" style={{ borderColor: 'rgba(244,238,228,0.08)', background: 'rgba(244,238,228,0.02)' }}>
                <div className="flex items-start justify-between">
                  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden>
                    <circle cx="21" cy="21" r="15" stroke="#8a7f72" strokeWidth="1.2" />
                    <path d="M6 21 Q21 14 36 21 Q21 28 6 21" stroke="#8a7f72" strokeWidth="1" fill="none" />
                    <line x1="21" y1="6" x2="21" y2="36" stroke="#8a7f72" strokeWidth="1" />
                    <circle cx="12" cy="16" r="2" fill="#e89660" />
                  </svg>
                  <div className="serif text-[2.5rem] leading-none" style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 30, 'opsz' 72" }}>
                    1
                    <span className="text-[1rem] align-bottom ml-0.5 text-[#8a7f72]">/195</span>
                  </div>
                </div>
                <div className="mono text-[0.64rem] uppercase tracking-[0.26em]" style={{ color: '#8a7f72' }}>Geography</div>
                <h3 className="serif text-[1.3rem] leading-[1.25] tracking-[-0.01em]" style={{ color: '#f4eee4', fontVariationSettings: "'SOFT' 50, 'opsz' 36" }}>
                  One country gets most of the capital. The rest wait.
                </h3>
              </div>
            </div>
            <p className="serif text-[1.25rem] md:text-[1.5rem] leading-[1.55] max-w-[58ch] italic"
              style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 36" }}>
              We thought that was broken.
            </p>
          </div>
        </section>

        {/* ═══════════ III / The shift — the mission pivot ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-32 md:py-52 border-t overflow-hidden"
          style={{ background: 'rgba(10,8,20,0.55)', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div className="max-w-[1400px] mx-auto relative z-10 grid grid-cols-12 gap-8 md:gap-12 items-center">
            {/* Left — the message */}
            <div className="col-span-12 md:col-span-7">
              <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>III / The shift</div>
              <h2 className="serif leading-[0.95] tracking-[-0.03em] mb-10 max-w-[16ch]"
                style={{ color: '#f4eee4', fontSize: 'clamp(2.75rem, 7vw, 6.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 144" }}>
                What if <br className="hidden md:inline" />the{' '}
                <em style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 144", color: 'transparent',
                  backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ecb48a 35%, #d99875 70%, #d67347 100%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>world</em>{' '}decided?
              </h2>
              <div className="mono text-[0.66rem] uppercase tracking-[0.3em] mb-10 flex items-center gap-3" style={{ color: '#e89660' }}>
                <span className="inline-block w-10 h-px" style={{ background: '#e89660' }} />
                <span>PNL&rsquo;s mission · give every idea a chance</span>
              </div>
              <p className="serif text-[1.2rem] md:text-[1.45rem] leading-[1.5] max-w-[48ch] mb-6"
                style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 36" }}>
                The internet already knows what&rsquo;s interesting.
              </p>
              <p className="serif text-[1.05rem] md:text-[1.2rem] leading-[1.65] max-w-[48ch] mb-5"
                style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                It reacts in tweets, threads, memes, money. Bored in hours. Obsessed in weeks. If that reaction could <em style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>fund</em> what&rsquo;s worth building — and being wrong cost nothing — the floor for starting something drops to zero.
              </p>
              <p className="serif text-[1.1rem] md:text-[1.3rem] leading-[1.5] max-w-[48ch] mt-8"
                style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                That&rsquo;s PNL. The crowd becomes the committee.{' '}
                <em style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>Conviction becomes capital.</em>
              </p>
            </div>

            {/* Right — the world deciding: a constellation of voices converging on one verdict */}
            <div className="col-span-12 md:col-span-5 flex items-center justify-center mt-8 md:mt-0">
              <div className="relative w-full max-w-[520px] aspect-square">
                <svg viewBox="0 0 600 600" className="w-full h-full" style={{ animation: 'globeDrift 24s ease-in-out infinite' }} aria-hidden>
                  <defs>
                    <radialGradient id="globeCore">
                      <stop offset="0%" stopColor="#fff4b8" stopOpacity="1" />
                      <stop offset="30%" stopColor="#e89628" stopOpacity="0.7" />
                      <stop offset="70%" stopColor="#d67347" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#e89628" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Sphere wireframe — abstract globe */}
                  <circle cx="300" cy="300" r="230" stroke="rgba(232,150,96,0.22)" strokeWidth="1" fill="none" />
                  <ellipse cx="300" cy="300" rx="230" ry="75" stroke="rgba(232,150,96,0.16)" strokeWidth="0.7" fill="none" />
                  <ellipse cx="300" cy="300" rx="230" ry="150" stroke="rgba(232,150,96,0.12)" strokeWidth="0.6" fill="none" />
                  <ellipse cx="300" cy="300" rx="75" ry="230" stroke="rgba(232,150,96,0.12)" strokeWidth="0.6" fill="none" />
                  <ellipse cx="300" cy="300" rx="150" ry="230" stroke="rgba(232,150,96,0.1)" strokeWidth="0.6" fill="none" />

                  {/* Conviction lines: 12 voices flowing inward to the center verdict */}
                  {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
                    const x = 300 + Math.cos(angle) * 230;
                    const y = 300 + Math.sin(angle) * 230;
                    return (
                      <line
                        key={`line-${i}`}
                        x1={x} y1={y} x2={300} y2={300}
                        stroke="rgba(232,150,96,0.28)" strokeWidth="0.8" strokeDasharray="3 5"
                        style={{ animation: `convictionFlow 4.5s ease-in-out infinite`, animationDelay: `${i * 0.25}s` }}
                      />
                    );
                  })}

                  {/* The voices — 36 dots around the sphere, mixed believers/critics/neutral */}
                  {Array.from({ length: 36 }).map((_, i) => {
                    const angle = (i / 36) * Math.PI * 2 + (i % 3) * 0.08;
                    const radius = 230 + ((i * 11) % 7) - 3;
                    const x = 300 + Math.cos(angle) * radius;
                    const y = 300 + Math.sin(angle) * radius;
                    const size = 1.8 + ((i * 5) % 3);
                    const kind = i % 5;
                    const color = kind === 0 ? '#3f7a42' : kind === 1 ? '#d67347' : '#fff4b8';
                    const dur = 2.8 + ((i * 7) % 30) / 10;
                    const delay = ((i * 13) % 50) / 10;
                    return (
                      <circle
                        key={`dot-${i}`}
                        cx={x} cy={y} r={size} fill={color}
                        style={{
                          animation: `voiceTwinkle ${dur}s ease-in-out infinite`,
                          animationDelay: `${delay}s`,
                          transformOrigin: `${x}px ${y}px`,
                        }}
                      />
                    );
                  })}

                  {/* Pulsing central verdict — collective conviction */}
                  <circle cx="300" cy="300" r="130" fill="url(#globeCore)"
                    style={{ animation: 'verdictPulse 4s ease-in-out infinite', transformOrigin: '300px 300px' }} />
                  <circle cx="300" cy="300" r="16" fill="#fff4b8" />
                  <circle cx="300" cy="300" r="8" fill="#ffffff" />
                </svg>
                {/* Caption */}
                <div className="absolute left-0 right-0 -bottom-2 text-center mono text-[0.6rem] uppercase tracking-[0.32em]"
                  style={{ color: 'rgba(232,150,96,0.55)' }}>
                  The crowd · the verdict
                </div>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes voiceTwinkle {
              0%, 100% { opacity: 0.25; transform: scale(0.75); }
              50%      { opacity: 1;    transform: scale(1.25); }
            }
            @keyframes convictionFlow {
              0%, 100% { opacity: 0.08; stroke-dashoffset: 0; }
              50%      { opacity: 0.55; stroke-dashoffset: -8; }
            }
            @keyframes verdictPulse {
              0%, 100% { opacity: 0.55; transform: scale(0.96); }
              50%      { opacity: 0.95; transform: scale(1.06); }
            }
            @keyframes globeDrift {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              50%      { transform: translateY(-6px) rotate(0.6deg); }
            }
          `}</style>
        </section>

        {/* ═══════════ IV / How it grows — believers vs critics mechanism ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-24 md:py-40 border-t"
          style={{ background: 'rgba(10,8,20,0.55)', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div className="max-w-[1400px] mx-auto">
            <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>IV / How it grows</div>
            <h2 className="serif leading-[1.05] tracking-[-0.025em] mb-6 max-w-[22ch]"
              style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 72" }}>
              Every idea gets two camps. Both matter.
            </h2>
            <p className="serif text-[1.1rem] md:text-[1.25rem] leading-[1.6] max-w-[56ch] mb-16"
              style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
              When you plant an idea, two sides form around it. The outcome is decided by how much conviction flows to each.
            </p>

            {/* Visual diagram — two energy streams converging on the seed */}
            <div aria-hidden className="relative w-full max-w-[900px] mx-auto my-16 md:my-20" style={{ aspectRatio: '3 / 1' }}>
              <svg viewBox="0 0 900 300" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="believerStream" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(63,122,66,0)" />
                    <stop offset="60%" stopColor="rgba(63,122,66,0.7)" />
                    <stop offset="100%" stopColor="rgba(127,200,120,1)" />
                  </linearGradient>
                  <linearGradient id="criticStream" x1="1" y1="0" x2="0" y2="0">
                    <stop offset="0%" stopColor="rgba(214,115,71,0)" />
                    <stop offset="60%" stopColor="rgba(214,115,71,0.7)" />
                    <stop offset="100%" stopColor="rgba(236,180,138,1)" />
                  </linearGradient>
                  <radialGradient id="seedGlow">
                    <stop offset="0%" stopColor="#fff4b8" stopOpacity="1" />
                    <stop offset="50%" stopColor="#e89628" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#8a3a10" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Believer stream (left to center) */}
                <path d="M 40 60 Q 240 90 430 140" stroke="url(#believerStream)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M 40 100 Q 240 120 430 145" stroke="url(#believerStream)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
                <path d="M 40 20 Q 240 60 430 138" stroke="url(#believerStream)" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4" />

                {/* Critic stream (right to center) */}
                <path d="M 860 60 Q 660 90 470 140" stroke="url(#criticStream)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M 860 100 Q 660 120 470 145" stroke="url(#criticStream)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
                <path d="M 860 20 Q 660 60 470 138" stroke="url(#criticStream)" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4" />

                {/* Dotted photon trail (left side, believers) */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <circle key={`b-${i}`} cx={100 + i * 70} cy={75 + i * 14} r="1.8" fill="#7fc878" opacity={0.3 + i * 0.12} />
                ))}
                {/* Dotted photon trail (right side, critics) */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <circle key={`c-${i}`} cx={800 - i * 70} cy={75 + i * 14} r="1.8" fill="#ecb48a" opacity={0.3 + i * 0.12} />
                ))}

                {/* Central seed */}
                <circle cx="450" cy="150" r="45" fill="url(#seedGlow)" />
                <circle cx="450" cy="150" r="13" fill="#fff4b8" opacity="0.95" />
                <circle cx="450" cy="150" r="7" fill="#ffffff" opacity="0.85" />

                {/* Roots descending from seed */}
                <path d="M 450 175 Q 430 210 405 245" stroke="rgba(180,120,70,0.55)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M 450 175 Q 470 210 495 245" stroke="rgba(180,120,70,0.55)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M 450 175 Q 450 215 450 255" stroke="rgba(180,120,70,0.45)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                <path d="M 450 175 Q 415 205 380 230" stroke="rgba(180,120,70,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d="M 450 175 Q 485 205 520 230" stroke="rgba(180,120,70,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />

                {/* Labels */}
                <text x="40" y="140" fill="#3f7a42" style={{ font: "500 11px ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.24em", textTransform: "uppercase" }}>BELIEVERS → YES</text>
                <text x="860" y="140" fill="#d67347" textAnchor="end" style={{ font: "500 11px ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.24em", textTransform: "uppercase" }}>NO ← CRITICS</text>
                <text x="450" y="285" fill="#8a7f72" textAnchor="middle" style={{ font: "400 10px ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.28em", textTransform: "uppercase" }}>the idea</text>
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              <article className="flex flex-col gap-5 md:pr-8 md:border-r" style={{ borderColor: 'rgba(63,122,66,0.25)' }}>
                <div className="mono text-[0.7rem] uppercase tracking-[0.26em]" style={{ color: '#3f7a42' }}>The believers</div>
                <h3 className="serif text-[1.8rem] leading-[1.1] tracking-[-0.02em]" style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>
                  They stake on <em style={{ color: '#3f7a42', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>yes.</em>
                </h3>
                <p className="serif text-[1.05rem] leading-[1.65]" style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                  People who look at your idea and think <em style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>this should exist.</em> Their conviction is the water, the sun, the capital that lets the idea grow.
                </p>
              </article>
              <article className="flex flex-col gap-5">
                <div className="mono text-[0.7rem] uppercase tracking-[0.26em]" style={{ color: '#d67347' }}>The critics</div>
                <h3 className="serif text-[1.8rem] leading-[1.1] tracking-[-0.02em]" style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>
                  They stake on <em style={{ color: '#d67347', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>no.</em>
                </h3>
                <p className="serif text-[1.05rem] leading-[1.65]" style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                  People who look at it and think <em style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>this won&rsquo;t work.</em> Their doubt isn&rsquo;t noise — it&rsquo;s the pressure test that separates real ideas from empty ones.
                </p>
              </article>
            </div>
            <div className="mt-16 pt-10 border-t max-w-[62ch]" style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
              <p className="serif text-[1.1rem] md:text-[1.25rem] leading-[1.6]"
                style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                The market runs. Prices move. The side with more conviction by the end{' '}
                <em style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>takes the whole pool</em>.
                If the <em style={{ color: '#3f7a42', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>believers</em> win, the idea launches and they receive the tokens — the critics&rsquo; stakes become the believers&rsquo; reward.
                If the <em style={{ color: '#d67347', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>critics</em> win, they claim the pool in SOL — the believers&rsquo; stakes become the critics&rsquo; reward.
              </p>
              <Link href="/whitepaper" className="inline-flex items-center gap-2 mt-8 mono text-[0.66rem] uppercase tracking-[0.24em] hover:text-[#f4eee4] transition-colors" style={{ color: '#e89660' }}>
                <span>Read the mechanism</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════ V / What could go wrong — the settlement truth ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-24 md:py-40 border-t"
          style={{ background: 'rgba(10,8,20,0.55)', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div className="max-w-[1400px] mx-auto">
            <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>V / The settlement</div>
            <h2 className="serif leading-[1.05] tracking-[-0.025em] mb-6 max-w-[22ch]"
              style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 72" }}>
              Winners take the pool. Losers fund it.
            </h2>
            <p className="serif text-[1.1rem] md:text-[1.25rem] leading-[1.6] max-w-[58ch] mb-16"
              style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
              Prediction markets are honest about stakes. The winning side earns the entire pool — including the losing side&rsquo;s SOL. There&rsquo;s no free conviction; there&rsquo;s also no trapped capital. Either you were right, or you funded the people who were.
            </p>

            {/* Visual: two outcome trees side by side — bloom vs gently archive */}
            <div aria-hidden className="grid grid-cols-2 gap-6 md:gap-12 max-w-[900px] mx-auto mb-16 md:mb-20">
              {/* Bloom tree — believers win */}
              <div className="relative" style={{ aspectRatio: '1 / 1.15' }}>
                <svg viewBox="0 0 200 230" className="w-full h-full" preserveAspectRatio="xMidYMax meet">
                  <defs>
                    <radialGradient id="bloomGlow">
                      <stop offset="0%" stopColor="rgba(127,200,120,0.5)" />
                      <stop offset="100%" stopColor="rgba(127,200,120,0)" />
                    </radialGradient>
                  </defs>
                  {/* Ambient glow */}
                  <circle cx="100" cy="100" r="95" fill="url(#bloomGlow)" />
                  {/* Trunk */}
                  <path d="M 100 210 Q 102 170 100 130 Q 98 90 100 60" stroke="#ecb48a" strokeWidth="3" fill="none" strokeLinecap="round" />
                  {/* Branches */}
                  <path d="M 100 130 Q 75 110 55 80" stroke="#d99875" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M 100 130 Q 125 110 145 80" stroke="#d99875" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M 100 95 Q 80 75 65 50" stroke="#b8613a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M 100 95 Q 120 75 135 50" stroke="#b8613a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M 100 60 Q 98 40 100 25" stroke="#b8613a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  {/* Green leaves (believers) */}
                  {[
                    [55, 80, 4], [65, 50, 3.5], [100, 25, 4.5], [135, 50, 3.5], [145, 80, 4],
                    [80, 100, 3], [120, 100, 3], [85, 60, 3], [115, 60, 3], [75, 70, 2.5], [125, 70, 2.5],
                    [50, 65, 2.5], [150, 65, 2.5], [95, 40, 2.5], [105, 40, 2.5],
                  ].map(([x, y, r], i) => (
                    <circle key={i} cx={x as number} cy={y as number} r={r as number} fill="#3f7a42" opacity="0.85" />
                  ))}
                  {/* Floating golden tokens — new holders receiving */}
                  <circle cx="40" cy="30" r="2.5" fill="#fff4b8" opacity="0.9" />
                  <circle cx="170" cy="45" r="2" fill="#fff4b8" opacity="0.8" />
                  <circle cx="30" cy="110" r="1.8" fill="#fff4b8" opacity="0.7" />
                  <circle cx="175" cy="120" r="2.2" fill="#fff4b8" opacity="0.85" />
                  <circle cx="60" cy="20" r="1.5" fill="#fff4b8" opacity="0.6" />
                  {/* Ground line */}
                  <line x1="30" y1="212" x2="170" y2="212" stroke="rgba(230,180,115,0.4)" strokeWidth="0.8" />
                  {/* Label */}
                  <text x="100" y="227" fill="#3f7a42" textAnchor="middle" style={{ font: "500 9px ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.26em", textTransform: "uppercase" }}>
                    BLOOM · LAUNCH
                  </text>
                </svg>
              </div>
              {/* Archive — critics win, seed rests */}
              <div className="relative" style={{ aspectRatio: '1 / 1.15' }}>
                <svg viewBox="0 0 200 230" className="w-full h-full" preserveAspectRatio="xMidYMax meet">
                  <defs>
                    <radialGradient id="archiveGlow">
                      <stop offset="0%" stopColor="rgba(214,115,71,0.25)" />
                      <stop offset="100%" stopColor="rgba(214,115,71,0)" />
                    </radialGradient>
                  </defs>
                  <circle cx="100" cy="180" r="70" fill="url(#archiveGlow)" />
                  {/* Dormant seed underground, gentle roots */}
                  <circle cx="100" cy="155" r="10" fill="#d67347" opacity="0.85" />
                  <circle cx="100" cy="155" r="5" fill="#8a3a10" opacity="0.9" />
                  {/* Roots — descending, muted */}
                  <path d="M 100 165 Q 85 190 70 210" stroke="rgba(180,120,70,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M 100 165 Q 115 190 130 210" stroke="rgba(180,120,70,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M 100 165 Q 100 195 100 220" stroke="rgba(180,120,70,0.45)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                  <path d="M 100 165 Q 70 180 50 195" stroke="rgba(180,120,70,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />
                  <path d="M 100 165 Q 130 180 150 195" stroke="rgba(180,120,70,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />
                  {/* Refund flow — small arrows returning to earth */}
                  <path d="M 100 60 Q 100 80 100 100" stroke="rgba(236,180,138,0.5)" strokeWidth="1" fill="none" strokeDasharray="3 3" />
                  <path d="M 60 50 Q 75 80 95 110" stroke="rgba(236,180,138,0.4)" strokeWidth="1" fill="none" strokeDasharray="3 3" />
                  <path d="M 140 50 Q 125 80 105 110" stroke="rgba(236,180,138,0.4)" strokeWidth="1" fill="none" strokeDasharray="3 3" />
                  {/* Falling leaves back to soil */}
                  <circle cx="70" cy="35" r="2.5" fill="#d67347" opacity="0.6" />
                  <circle cx="100" cy="25" r="2" fill="#d67347" opacity="0.5" />
                  <circle cx="135" cy="40" r="2.5" fill="#d67347" opacity="0.6" />
                  <circle cx="80" cy="60" r="1.8" fill="#d67347" opacity="0.45" />
                  <circle cx="125" cy="60" r="1.8" fill="#d67347" opacity="0.45" />
                  {/* Ground line */}
                  <line x1="30" y1="148" x2="170" y2="148" stroke="rgba(230,180,115,0.4)" strokeWidth="0.8" />
                  {/* Label */}
                  <text x="100" y="227" fill="#d67347" textAnchor="middle" style={{ font: "500 9px ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.26em", textTransform: "uppercase" }}>
                    ARCHIVE · CRITICS WIN
                  </text>
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              <div className="flex flex-col gap-6">
                <div className="flex items-baseline justify-between pb-4 border-b" style={{ borderColor: 'rgba(63,122,66,0.35)' }}>
                  <div className="serif text-[1.4rem]" style={{ color: '#f4eee4' }}>If the <em style={{ color: '#3f7a42', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>believers</em> win</div>
                  <div className="mono text-[0.6rem] uppercase tracking-[0.26em]" style={{ color: '#3f7a42' }}>Launch</div>
                </div>
                <ul className="flex flex-col gap-4 serif text-[1rem] leading-[1.55]" style={{ color: '#d8cfc0' }}>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#3f7a42' }}>→</span><span>The token launches on Solana via pump.fun — a real company takes its first breath.</span></li>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#3f7a42' }}>→</span><span>Believers receive the token airdrop (65% of supply), pro-rata to their stake.</span></li>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#3f7a42' }}>→</span><span>Critics&rsquo; SOL stakes are absorbed into the launch — their conviction funded the win.</span></li>
                </ul>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex items-baseline justify-between pb-4 border-b" style={{ borderColor: 'rgba(214,115,71,0.35)' }}>
                  <div className="serif text-[1.4rem]" style={{ color: '#f4eee4' }}>If the <em style={{ color: '#d67347', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>critics</em> win</div>
                  <div className="mono text-[0.6rem] uppercase tracking-[0.26em]" style={{ color: '#d67347' }}>Archive</div>
                </div>
                <ul className="flex flex-col gap-4 serif text-[1rem] leading-[1.55]" style={{ color: '#d8cfc0' }}>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#d67347' }}>→</span><span>The idea doesn&rsquo;t launch. Archived on-chain as a permanent signal.</span></li>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#d67347' }}>→</span><span>Critics claim the entire SOL pool, pro-rata to their stake.</span></li>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#d67347' }}>→</span><span>Believers&rsquo; SOL stakes become the critics&rsquo; reward — conviction has a cost.</span></li>
                </ul>
              </div>
            </div>
            <div className="mt-16 pt-10 border-t max-w-[64ch]" style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
              <div className="mono text-[0.62rem] uppercase tracking-[0.28em] mb-3" style={{ color: '#8a7f72' }}>The exit hatch · tied vote or target not met</div>
              <p className="serif text-[1.05rem] md:text-[1.15rem] leading-[1.6]"
                style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                If believers and critics end exactly balanced — or the market never reaches its funding target — the contract resolves as a refund. Both sides get their SOL back pro-rata. <em style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 100, 'WONK' 0" }}>No platform fee, no forfeit.</em> It&rsquo;s the clean reset for inconclusive markets.
              </p>
            </div>
            <p className="serif text-[1.2rem] md:text-[1.4rem] leading-[1.55] max-w-[60ch] mt-14 italic"
              style={{ color: '#ecb48a', fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 36" }}>
              Being right pays. Being wrong is the cost of having conviction at all.
            </p>
          </div>
        </section>

        {/* ═══════════ The thesis — why this really matters ═══════════ */}
        <section id="thesis" className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-32 md:py-52 border-t overflow-hidden"
          style={{ background: 'rgba(10,8,20,0.55)', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div className="max-w-[1400px] mx-auto relative z-10 grid grid-cols-12 gap-8 md:gap-14">
            {/* Left — the invitation */}
            <div className="col-span-12 md:col-span-5">
              <div className="mono text-[0.64rem] uppercase tracking-[0.3em] mb-6 flex items-center gap-3" style={{ color: '#e89660' }}>
                <span className="inline-block w-10 h-px" style={{ background: '#e89660' }} />
                <span>The thesis</span>
              </div>
              <h2 className="serif leading-[0.98] tracking-[-0.025em] mb-10"
                style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 144" }}>
                What we&rsquo;re{' '}
                <em style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 144", color: 'transparent',
                  backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ecb48a 35%, #d99875 70%, #d67347 100%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>really</em>{' '}
                building.
              </h2>
              <p className="serif text-[1.1rem] md:text-[1.25rem] leading-[1.6] max-w-[42ch] mb-8"
                style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                &ldquo;VCs&rdquo; and &ldquo;fundraising&rdquo; are shorthand — easy words to make an unfamiliar idea land. The actual game is much bigger.
              </p>

              {/* Gateway visual — two columns of light + threshold, a sacred place for ideas to come from */}
              <div aria-hidden className="relative w-full max-w-[340px] mt-8 hidden md:block" style={{ aspectRatio: '5 / 4' }}>
                <svg viewBox="0 0 500 400" className="w-full h-full" style={{ animation: 'gatewayBreath 8s ease-in-out infinite' }}>
                  <defs>
                    <radialGradient id="thresholdGlow" cx="0.5" cy="0.65" r="0.7">
                      <stop offset="0%" stopColor="#fff4b8" stopOpacity="0.85" />
                      <stop offset="40%" stopColor="#e89628" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#e89628" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="columnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(236,180,138,0.15)" />
                      <stop offset="50%" stopColor="rgba(236,180,138,0.9)" />
                      <stop offset="100%" stopColor="rgba(138,58,16,0.85)" />
                    </linearGradient>
                  </defs>

                  {/* Radiant threshold behind the columns — light from within */}
                  <ellipse cx="250" cy="260" rx="180" ry="200" fill="url(#thresholdGlow)" />

                  {/* Ground line */}
                  <line x1="40" y1="360" x2="460" y2="360" stroke="rgba(232,150,96,0.35)" strokeWidth="0.8" />

                  {/* Left column */}
                  <line x1="155" y1="80" x2="155" y2="360" stroke="url(#columnGrad)" strokeWidth="4" strokeLinecap="round" />
                  {/* Right column */}
                  <line x1="345" y1="80" x2="345" y2="360" stroke="url(#columnGrad)" strokeWidth="4" strokeLinecap="round" />

                  {/* Architrave — subtle horizontal beam */}
                  <line x1="140" y1="78" x2="360" y2="78" stroke="rgba(236,180,138,0.6)" strokeWidth="2" strokeLinecap="round" />
                  <line x1="125" y1="68" x2="375" y2="68" stroke="rgba(236,180,138,0.25)" strokeWidth="1" strokeLinecap="round" />

                  {/* Ideas drifting through the gateway — tiny floating dots */}
                  {[
                    [220, 160, 2], [265, 135, 1.8], [195, 210, 1.5], [290, 230, 2],
                    [240, 290, 2.5], [215, 255, 1.6], [275, 185, 1.4], [250, 120, 1.2],
                  ].map(([x, y, r], i) => (
                    <circle key={i} cx={x as number} cy={y as number} r={r as number} fill="#fff4b8"
                      style={{
                        animation: `ideaDrift ${4 + (i % 3)}s ease-in-out infinite`,
                        animationDelay: `${i * 0.3}s`,
                        transformOrigin: `${x}px ${y}px`,
                      }} />
                  ))}

                  {/* Central bright orb at threshold base — the source */}
                  <circle cx="250" cy="340" r="10" fill="#fff4b8" style={{ animation: 'verdictPulse 5s ease-in-out infinite', transformOrigin: '250px 340px' }} />
                  <circle cx="250" cy="340" r="5" fill="#ffffff" />
                </svg>
                <div className="absolute left-0 right-0 -bottom-2 text-center mono text-[0.58rem] uppercase tracking-[0.32em]"
                  style={{ color: 'rgba(232,150,96,0.5)' }}>
                  The gateway
                </div>
              </div>
            </div>

            {/* Right — the 5 claims */}
            <div className="col-span-12 md:col-span-7 md:pl-8 md:border-l" style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
              <div className="flex flex-col gap-10 md:gap-12">
                {[
                  {
                    numeral: 'I',
                    headline: 'Ideas need a home before they need funding.',
                    body: 'Before a pitch deck, before a round, every company is a thought looking for its first listener. PNL is built for that earliest moment — when an idea is still fragile, still forming, still asking whether it belongs in the world.',
                  },
                  {
                    numeral: 'II',
                    headline: 'In the age of AI, human origination becomes sacred.',
                    body: 'As machines learn to execute, what remains uniquely ours is the spark itself — the intuition, the pattern only you saw. PNL is the digital gathering-ground where that origination can happen publicly, without gatekeepers.',
                  },
                  {
                    numeral: 'III',
                    headline: 'Conviction reveals what opinion hides.',
                    body: 'The internet runs on reactions; most of them free, most of them empty. Prediction markets turn reactions into commitments — and commitments show which ideas actually have weight behind them, not just attention.',
                  },
                  {
                    numeral: 'IV',
                    headline: 'Venture capital isn\u2019t wrong — just narrow.',
                    body: 'VCs optimize for patterns they can already recognize. A global market of believers and critics sees further — catching ideas from places no fund is flying to. PNL doesn\u2019t replace venture. It opens a door venture couldn\u2019t reach.',
                  },
                  {
                    numeral: 'V',
                    headline: 'Every pitched idea joins a library of human imagination.',
                    body: 'On-chain permanence means nothing fully dies. Ideas that didn\u2019t launch remain as signals — for the author to return to, for future builders to learn from. Over time, PNL accumulates as a record of humans attempting themselves.',
                  },
                ].map((claim) => (
                  <article key={claim.numeral} className="grid grid-cols-[auto_1fr] gap-5 md:gap-7 items-baseline">
                    <span className="serif text-[1.9rem] md:text-[2.1rem] leading-none"
                      style={{ color: '#e89660', fontVariationSettings: "'SOFT' 30, 'opsz' 72", letterSpacing: '0.02em' }}>
                      {claim.numeral}
                    </span>
                    <div className="flex flex-col gap-3">
                      <h3 className="serif text-[1.3rem] md:text-[1.55rem] leading-[1.2] tracking-[-0.015em]"
                        style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>
                        {claim.headline}
                      </h3>
                      <p className="serif text-[0.98rem] md:text-[1.05rem] leading-[1.65] max-w-[56ch]"
                        style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                        {claim.body}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-14 pt-8 border-t" style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
                <Link href="/whitepaper" className="group inline-flex items-center gap-3 mono text-[0.72rem] uppercase tracking-[0.26em] hover:text-[#f4eee4] transition-colors" style={{ color: '#e89660' }}>
                  <span className="relative inline-block after:absolute after:left-0 after:bottom-[-4px] after:h-px after:w-full after:bg-current after:scale-x-0 after:origin-left group-hover:after:scale-x-100 after:transition-transform after:duration-500">
                    Read the full thesis
                  </span>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes ideaDrift {
              0%, 100% { opacity: 0.4; transform: translateY(0) scale(0.85); }
              50%      { opacity: 1;   transform: translateY(-4px) scale(1.15); }
            }
            @keyframes gatewayBreath {
              0%, 100% { transform: scale(1); }
              50%      { transform: scale(1.015); }
            }
          `}</style>
        </section>

        {/* ═══════════ VI / The vision — close the story, invite the reader ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-32 md:py-48 border-t overflow-hidden"
          style={{ background: 'rgba(10,8,20,0.55)', borderColor: 'rgba(244,238,228,0.06)' }}>
          {/* Warm horizon glow behind the forest */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[-40vh] z-[0]"
            style={{ width: 'min(130vw, 1600px)', height: 'min(130vw, 1600px)',
              background: 'radial-gradient(circle at 50% 50%, rgba(232,150,96,0.22) 0%, rgba(214,115,71,0.1) 25%, transparent 55%)' }} />

          {/* Forest on the horizon — many trees growing, near to far, proving the vision is already underway */}
          <svg aria-hidden className="pointer-events-none absolute left-0 right-0 bottom-0 z-[1] w-full"
            viewBox="0 0 1600 280" preserveAspectRatio="xMidYMax slice" style={{ height: '36vh', minHeight: '200px' }}>
            <defs>
              <linearGradient id="horizonLand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(244,238,228,0)" />
                <stop offset="100%" stopColor="rgba(138,58,16,0.18)" />
              </linearGradient>
              <linearGradient id="treeNear" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(236,180,138,0.15)" />
                <stop offset="70%" stopColor="rgba(214,115,71,0.5)" />
                <stop offset="100%" stopColor="rgba(214,115,71,0.75)" />
              </linearGradient>
              <linearGradient id="treeMid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(236,180,138,0.08)" />
                <stop offset="70%" stopColor="rgba(214,115,71,0.3)" />
                <stop offset="100%" stopColor="rgba(214,115,71,0.45)" />
              </linearGradient>
              <linearGradient id="treeFar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(236,180,138,0.05)" />
                <stop offset="80%" stopColor="rgba(214,115,71,0.18)" />
                <stop offset="100%" stopColor="rgba(214,115,71,0.28)" />
              </linearGradient>
            </defs>

            {/* Distant land fade */}
            <rect x="0" y="180" width="1600" height="100" fill="url(#horizonLand)" />
            {/* Far layer — many distant tiny trees */}
            <g fill="url(#treeFar)" opacity="0.7">
              {[70, 130, 175, 225, 285, 335, 395, 455, 520, 580, 640, 700, 770, 830, 895, 955, 1020, 1080, 1145, 1210, 1275, 1340, 1405, 1470, 1540].map((x, i) => {
                const h = 22 + ((x * 7) % 18);
                const s = 0.8 + ((x * 3) % 40) / 100;
                return (
                  <g key={`far-${i}`} transform={`translate(${x} 230)`}>
                    <line x1="0" y1="0" x2="0" y2={-h} stroke="url(#treeFar)" strokeWidth="0.6" />
                    <line x1="0" y1={-h * 0.6} x2={-h * 0.35 * s} y2={-h * 0.9} stroke="url(#treeFar)" strokeWidth="0.5" />
                    <line x1="0" y1={-h * 0.5} x2={h * 0.35 * s} y2={-h * 0.85} stroke="url(#treeFar)" strokeWidth="0.5" />
                  </g>
                );
              })}
            </g>
            {/* Mid layer — medium trees */}
            <g opacity="0.85">
              {[110, 225, 330, 455, 580, 700, 830, 955, 1090, 1210, 1340, 1475].map((x, i) => {
                const h = 50 + ((x * 11) % 30);
                return (
                  <g key={`mid-${i}`} transform={`translate(${x} 240)`}>
                    {/* Trunk */}
                    <path d={`M 0 0 Q -1 ${-h * 0.4} 0 ${-h * 0.7} Q 1 ${-h * 0.85} 0 ${-h}`}
                      stroke="url(#treeMid)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                    {/* Branches */}
                    <line x1="0" y1={-h * 0.55} x2={-h * 0.35} y2={-h * 0.85} stroke="url(#treeMid)" strokeWidth="1" strokeLinecap="round" />
                    <line x1="0" y1={-h * 0.5} x2={h * 0.38} y2={-h * 0.8} stroke="url(#treeMid)" strokeWidth="1" strokeLinecap="round" />
                    <line x1="0" y1={-h * 0.7} x2={-h * 0.22} y2={-h * 0.92} stroke="url(#treeMid)" strokeWidth="0.8" strokeLinecap="round" />
                    <line x1="0" y1={-h * 0.72} x2={h * 0.24} y2={-h * 0.94} stroke="url(#treeMid)" strokeWidth="0.8" strokeLinecap="round" />
                    {/* Glow at canopy */}
                    <circle cx="0" cy={-h} r="1.6" fill="rgba(232,150,96,0.6)" />
                    <circle cx={-h * 0.35} cy={-h * 0.85} r="1.2" fill="rgba(232,150,96,0.45)" />
                    <circle cx={h * 0.38} cy={-h * 0.8} r="1.2" fill="rgba(232,150,96,0.45)" />
                  </g>
                );
              })}
            </g>
            {/* Near layer — larger foreground trees */}
            <g opacity="0.95">
              {[155, 390, 630, 880, 1125, 1365].map((x, i) => {
                const h = 85 + ((x * 13) % 40);
                return (
                  <g key={`near-${i}`} transform={`translate(${x} 255)`}>
                    {/* Trunk with S-curve */}
                    <path d={`M 0 0 Q 2 ${-h * 0.35} -1 ${-h * 0.55} Q -3 ${-h * 0.75} 1 ${-h * 0.9} Q 0 ${-h * 0.97} 0 ${-h}`}
                      stroke="url(#treeNear)" strokeWidth="2" fill="none" strokeLinecap="round" />
                    {/* Main branches */}
                    <path d={`M 0 ${-h * 0.55} Q ${-h * 0.2} ${-h * 0.65} ${-h * 0.42} ${-h * 0.85}`}
                      stroke="url(#treeNear)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                    <path d={`M 0 ${-h * 0.5} Q ${h * 0.25} ${-h * 0.62} ${h * 0.48} ${-h * 0.82}`}
                      stroke="url(#treeNear)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                    <path d={`M 0 ${-h * 0.75} Q ${-h * 0.15} ${-h * 0.85} ${-h * 0.3} ${-h * 0.95}`}
                      stroke="url(#treeNear)" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                    <path d={`M 0 ${-h * 0.78} Q ${h * 0.18} ${-h * 0.88} ${h * 0.34} ${-h}`}
                      stroke="url(#treeNear)" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                    {/* Warm sun-seed at base */}
                    <circle cx="0" cy="0" r="3" fill="rgba(232,150,40,0.85)" />
                    {/* Leaf glows at tips */}
                    <circle cx={-h * 0.42} cy={-h * 0.85} r="1.6" fill="rgba(127,200,120,0.7)" />
                    <circle cx={h * 0.48} cy={-h * 0.82} r="1.6" fill="rgba(127,200,120,0.7)" />
                    <circle cx="0" cy={-h} r="1.8" fill="rgba(127,200,120,0.75)" />
                    <circle cx={-h * 0.3} cy={-h * 0.95} r="1.2" fill="rgba(127,200,120,0.55)" />
                    <circle cx={h * 0.34} cy={-h} r="1.2" fill="rgba(127,200,120,0.55)" />
                  </g>
                );
              })}
            </g>
            {/* Ground horizon line */}
            <line x1="0" y1="258" x2="1600" y2="258" stroke="rgba(230,180,115,0.35)" strokeWidth="0.8" />
          </svg>
          <div className="relative z-10 max-w-[1400px] mx-auto">
            <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>VI / The vision</div>
            <h2 className="serif leading-[1] tracking-[-0.03em] mb-12 max-w-[18ch]"
              style={{ color: '#f4eee4', fontSize: 'clamp(2.5rem, 6.5vw, 6rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 144" }}>
              A more{' '}
              <em style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 144", color: 'transparent',
                backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ecb48a 35%, #d99875 70%, #d67347 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>fertile</em>{' '}
              internet.
            </h2>
            <p className="serif text-[1.15rem] md:text-[1.3rem] leading-[1.6] max-w-[58ch] mb-5"
              style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
              Imagine the next 10,000 companies don&rsquo;t begin in a Palo Alto conference room. They begin in a dorm in Mumbai. A cafe in Lagos. A subway in São Paulo. A teenager&rsquo;s bedroom in Iowa.
            </p>
            <p className="serif text-[1.15rem] md:text-[1.3rem] leading-[1.6] max-w-[58ch] mb-16"
              style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
              An internet where anyone with conviction — an idea, or an eye for one — can become a founder. A day-one holder. Both.
            </p>
            <div className="pt-12 border-t" style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
              <h3 className="serif leading-[0.95] tracking-[-0.03em] mb-10"
                style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 6vw, 5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 144" }}>
                You have ideas.<br />
                <em style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 144", color: 'transparent',
                  backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ffd7a8 25%, #d99875 60%, #d67347 100%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>Time to plant one.</em>
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-start">
                <button onClick={handleLaunchClick} className="group relative inline-flex items-center gap-3 px-7 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] font-semibold transition-colors duration-300"
                  style={{ background: '#e89660', color: '#0a0814' }}>
                  <span>Pitch your idea</span>
                  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" className="transition-transform duration-300 group-hover:translate-x-1.5">
                    <path d="M1 5H19M19 5L14 1M19 5L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                  </svg>
                </button>
                <Link href="/browse" className="group inline-flex items-center gap-3 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] transition-colors" style={{ color: '#f4eee4' }}>
                  <span className="relative inline-block after:absolute after:left-0 after:bottom-[-4px] after:h-px after:w-full after:bg-current after:scale-x-0 after:origin-left group-hover:after:scale-x-100 after:transition-transform after:duration-500">Enter the markets</span>
                  <span className="text-[#8a7f72] group-hover:text-[#e89660] transition-colors">↗</span>
                </Link>
                <Link href="/whitepaper" className="group inline-flex items-center gap-3 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] transition-colors" style={{ color: '#8a7f72' }}>
                  <span className="relative inline-block after:absolute after:left-0 after:bottom-[-4px] after:h-px after:w-full after:bg-current after:scale-x-0 after:origin-left group-hover:after:scale-x-100 after:transition-transform after:duration-500">Read the thesis</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ Footer ═══════════ */}
        <footer className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-12 border-t"
          style={{ background: '#0a0814', borderColor: 'rgba(244,238,228,0.08)' }}>
          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="mono text-[0.6rem] uppercase tracking-[0.28em] text-[#8a7f72]">$PNL · CA</span>
              <TokenAddress />
            </div>
            <div className="flex items-center gap-5">
              <a href="/whitepaper" aria-label="Whitepaper" className="text-[#8a7f72] hover:text-[#e89660] transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M5 4a2 2 0 012-2h6l6 6v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm7 0H7v16h10V9h-4a1 1 0 01-1-1V4zm3.586 4L13 5.414V8h2.586z" /></svg>
              </a>
              <a href="https://x.com/pnldotmarket" target="_blank" rel="noopener noreferrer" aria-label="X" className="text-[#8a7f72] hover:text-[#f4eee4] transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <a href="https://discord.gg/38pkg4vm" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="text-[#8a7f72] hover:text-[#e89660] transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" /></svg>
              </a>
            </div>
            <div className="mono text-[0.58rem] uppercase tracking-[0.28em] text-[#8a7f72] md:text-right">
              <div>© 2026 PNL · Solana Mainnet</div>
              <div className="text-[#6a6058] mt-1">A protocol for ideas.</div>
            </div>
          </div>
        </footer>

      </div>

      {/* Meteor cursor — desktop only, pointer:fine */}
      <MeteorCursor />

      {/* Cosmic Onboarding Modal */}
      <CosmicOnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onJoinUniverse={handleJoinUniverse}
        onContinueAsGuest={handleContinueAsGuest}
        isSettingUpProfile={isSettingUpProfile}
      />
    </>
  );
}
