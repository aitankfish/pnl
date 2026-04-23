'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Users, Rocket, Shield, Zap, CheckCircle, ExternalLink, ArrowRight, XCircle, ChevronDown } from 'lucide-react';
import { motion, useScroll, useTransform, useInView, useMotionValueEvent } from 'framer-motion';
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

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);
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
  useMotionValueEvent(heroScroll, 'change', (v) => {
    if (!launchRef.current) return;
    const wonk = Math.min(1, Math.max(0, v * 2));
    const soft = 100 - v * 60;
    launchRef.current.style.fontVariationSettings = `'SOFT' ${soft.toFixed(0)}, 'WONK' ${wonk.toFixed(2)}, 'opsz' 144`;
  });
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
              <Link href="/whitepaper" className="hover:text-[#f4eee4] transition-colors">Thesis</Link>
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

        {/* ═══════════ 01 / Why we built this ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-24 md:py-40" style={{ background: '#0a0814' }}>
          <div className="grid grid-cols-12 gap-6 max-w-[1400px] mx-auto">
            <div className="col-span-12 md:col-span-2 mono text-[0.64rem] uppercase tracking-[0.26em] mb-6 md:mb-0" style={{ color: '#e89660' }}>
              01 / Why we built this
            </div>
            <div className="col-span-12 md:col-span-7">
              <h2 className="serif leading-[1] tracking-[-0.025em] mb-10"
                style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 72" }}>
                Most ideas stay in a notebook.
              </h2>
              <p className="serif text-[1.1rem] md:text-[1.25rem] leading-[1.6] max-w-[56ch]"
                style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                You had the idea last year. You told two friends. One said it was brilliant. One ghosted. You never touched it again.
              </p>
              <p className="serif text-[1.1rem] md:text-[1.25rem] leading-[1.6] max-w-[56ch] mt-5"
                style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                Venture funds won't take your call. Pitch decks die in the spam folder. PNL flips the script:{' '}
                <em style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1", color: '#ecb48a' }}>
                  the internet votes on your idea, and if enough people believe, the vote itself funds the launch.
                </em>
              </p>
            </div>
            <aside className="col-span-12 md:col-span-3 mono text-[0.66rem] uppercase tracking-[0.22em] text-[#8a7f72] flex flex-col gap-6 mt-8 md:mt-2 md:pl-8 md:border-l"
              style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
              <div><div style={{ color: '#e89660' }}>No gatekeepers</div><div style={{ color: '#d8cfc0', marginTop: '6px', lineHeight: 1.7 }}>Anyone can pitch.<br />The world decides.</div></div>
              <div><div style={{ color: '#e89660' }}>Real money</div><div style={{ color: '#d8cfc0', marginTop: '6px', lineHeight: 1.7 }}>Winning ideas get<br />launch capital, instantly.</div></div>
              <div><div style={{ color: '#e89660' }}>On-chain proof</div><div style={{ color: '#d8cfc0', marginTop: '6px', lineHeight: 1.7 }}>Every vote, every launch —<br />permanent on Solana.</div></div>
            </aside>
          </div>
        </section>

        {/* ═══════════ 02 / How it works ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-24 md:py-40 border-t"
          style={{ background: '#0a0814', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div className="max-w-[1400px] mx-auto">
            <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>02 / How it works</div>
            <h2 className="serif leading-[1] tracking-[-0.025em] mb-16 max-w-[22ch]"
              style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 72" }}>
              Three steps. No pitch deck required.
            </h2>
            <div className="grid grid-cols-12 gap-6 md:gap-10">
              <article className="col-span-12 md:col-span-4 flex flex-col gap-5 md:pr-8 md:border-r" style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
                <div className="flex items-baseline gap-3">
                  <span className="serif text-[3rem] leading-none" style={{ color: '#e89660', fontVariationSettings: "'SOFT' 30, 'opsz' 96" }}>01</span>
                  <span className="mono text-[0.66rem] uppercase tracking-[0.24em] text-[#8a7f72]">Pitch it</span>
                </div>
                <h3 className="serif text-[1.7rem] leading-[1.1] tracking-[-0.02em]" style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>Post your idea.</h3>
                <p className="serif text-[1rem] leading-[1.65]" style={{ color: '#a89d8e' }}>Name it, describe it, done. Takes five minutes. The world starts voting immediately — YES if they believe in it, NO if they don&rsquo;t.</p>
              </article>
              <article className="col-span-12 md:col-span-4 flex flex-col gap-5 md:pr-8 md:border-r" style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
                <div className="flex items-baseline gap-3">
                  <span className="serif text-[3rem] leading-none" style={{ color: '#e89660', fontVariationSettings: "'SOFT' 30, 'opsz' 96" }}>02</span>
                  <span className="mono text-[0.66rem] uppercase tracking-[0.24em] text-[#8a7f72]">The world decides</span>
                </div>
                <h3 className="serif text-[1.7rem] leading-[1.1] tracking-[-0.02em]" style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>The vote runs.</h3>
                <p className="serif text-[1rem] leading-[1.65]" style={{ color: '#a89d8e' }}>For a set time, anyone can back YES or NO with real money. Each vote is a prediction. The price moves in real time. No committee. No insiders.</p>
              </article>
              <article className="col-span-12 md:col-span-4 flex flex-col gap-5">
                <div className="flex items-baseline gap-3">
                  <span className="serif text-[3rem] leading-none" style={{ color: '#e89660', fontVariationSettings: "'SOFT' 30, 'opsz' 96" }}>03</span>
                  <span className="mono text-[0.66rem] uppercase tracking-[0.24em] text-[#8a7f72]">It launches</span>
                </div>
                <h3 className="serif text-[1.7rem] leading-[1.1] tracking-[-0.02em]" style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>Believers fund it.</h3>
                <p className="serif text-[1rem] leading-[1.65]" style={{ color: '#a89d8e' }}>If YES wins, the entire pool becomes real launch capital. Your token ships on Solana via pump.fun. The people who voted for you get tokens. You&rsquo;re a real company.</p>
              </article>
            </div>
          </div>
        </section>

        {/* ═══════════ 03 / What you get ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-24 md:py-40 border-t"
          style={{ background: '#0a0814', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div className="max-w-[1400px] mx-auto">
            <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>03 / What you get</div>
            <h2 className="serif leading-[1] tracking-[-0.025em] mb-16 max-w-[22ch]"
              style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 72" }}>
              No matter what happens, nobody loses their shirt.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              <div className="flex flex-col gap-6">
                <div className="flex items-baseline justify-between pb-4 border-b" style={{ borderColor: 'rgba(255,106,61,0.35)' }}>
                  <div className="serif text-[1.4rem]" style={{ color: '#f4eee4' }}>If the idea <em style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1", color: '#e89660' }}>wins</em></div>
                  <div className="mono text-[0.6rem] uppercase tracking-[0.26em] text-[#e89660]">Launch</div>
                </div>
                <ul className="flex flex-col gap-4 serif text-[1rem] leading-[1.55]" style={{ color: '#d8cfc0' }}>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#8a7f72' }}>→</span><span>The entire pool turns into real launch money on pump.fun.</span></li>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#8a7f72' }}>→</span><span>Everyone who voted YES gets tokens — the more you staked, the more you get.</span></li>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#8a7f72' }}>→</span><span>The NO side&rsquo;s money gets split to YES voters as winnings. Being right pays.</span></li>
                </ul>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex items-baseline justify-between pb-4 border-b" style={{ borderColor: 'rgba(138,127,114,0.35)' }}>
                  <div className="serif text-[1.4rem]" style={{ color: '#f4eee4' }}>If the idea <em style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1", color: '#8a7f72' }}>loses</em></div>
                  <div className="mono text-[0.6rem] uppercase tracking-[0.26em] text-[#8a7f72]">Refund</div>
                </div>
                <ul className="flex flex-col gap-4 serif text-[1rem] leading-[1.55]" style={{ color: '#d8cfc0' }}>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#8a7f72' }}>→</span><span>The token doesn&rsquo;t launch. Clean exit, no bag left holding.</span></li>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#8a7f72' }}>→</span><span>Everyone who voted NO gets their money back + a share of the YES pool as winnings.</span></li>
                  <li className="flex gap-4"><span className="mono text-[0.62rem] pt-1.5" style={{ color: '#8a7f72' }}>→</span><span>The idea is archived on-chain. Come back with a better version whenever you&rsquo;re ready.</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ 04 / Who it's for ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-24 md:py-40 border-t"
          style={{ background: '#0a0814', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div className="max-w-[1400px] mx-auto">
            <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>04 / Who it's for</div>
            <h2 className="serif leading-[1] tracking-[-0.025em] mb-16 max-w-[24ch]"
              style={{ color: '#f4eee4', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 72" }}>
              Whether you have the idea — or you can spot the next one.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              <div className="flex flex-col gap-6 md:pr-8 md:border-r" style={{ borderColor: 'rgba(244,238,228,0.08)' }}>
                <div className="mono text-[0.7rem] uppercase tracking-[0.26em]" style={{ color: '#e89660' }}>If you&rsquo;ve been sitting on an idea</div>
                <h3 className="serif text-[1.9rem] leading-[1.1] tracking-[-0.02em]" style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>Stop writing docs. Let the world tell you if it&rsquo;s real.</h3>
                <ul className="flex flex-col gap-5 serif text-[1rem] leading-[1.65]" style={{ color: '#d8cfc0' }}>
                  <li className="flex gap-3"><span className="text-[#e89660] pt-1">→</span><span>Find out in days, not years, whether your idea resonates.</span></li>
                  <li className="flex gap-3"><span className="text-[#e89660] pt-1">→</span><span>Build a community of believers before you write a single line of code.</span></li>
                  <li className="flex gap-3"><span className="text-[#e89660] pt-1">→</span><span>Launch on day one with real money and real users — no begging investors.</span></li>
                </ul>
              </div>
              <div className="flex flex-col gap-6">
                <div className="mono text-[0.7rem] uppercase tracking-[0.26em]" style={{ color: '#e89660' }}>If you can spot a winner</div>
                <h3 className="serif text-[1.9rem] leading-[1.1] tracking-[-0.02em]" style={{ color: '#f4eee4', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>Back the ideas you believe in. Earn when you&rsquo;re right.</h3>
                <ul className="flex flex-col gap-5 serif text-[1rem] leading-[1.65]" style={{ color: '#d8cfc0' }}>
                  <li className="flex gap-3"><span className="text-[#e89660] pt-1">→</span><span>Get in on tomorrow&rsquo;s launches today, before anyone else.</span></li>
                  <li className="flex gap-3"><span className="text-[#e89660] pt-1">→</span><span>Your conviction becomes the token allocation — you&rsquo;re a day-one holder.</span></li>
                  <li className="flex gap-3"><span className="text-[#e89660] pt-1">→</span><span>Every vote is a bet on the future. The sharper you are, the more you win.</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ 05 / Your turn ═══════════ */}
        <section className="relative -mx-3 sm:-mx-6 px-6 md:px-10 py-32 md:py-48 border-t overflow-hidden"
          style={{ background: '#0a0814', borderColor: 'rgba(244,238,228,0.06)' }}>
          <div aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[-40vh] z-[0]"
            style={{ width: 'min(120vw, 1400px)', height: 'min(120vw, 1400px)',
              background: 'radial-gradient(circle at 50% 50%, rgba(255,138,76,0.3) 0%, rgba(255,58,31,0.12) 22%, transparent 55%)' }} />
          <div className="relative z-10 max-w-[1400px] mx-auto">
            <div className="mono text-[0.64rem] uppercase tracking-[0.26em] mb-6" style={{ color: '#e89660' }}>05 / Your turn</div>
            <h2 className="serif leading-[0.95] tracking-[-0.03em] mb-10"
              style={{ color: '#f4eee4', fontSize: 'clamp(2.75rem, 8vw, 7rem)', fontWeight: 400, fontVariationSettings: "'SOFT' 50, 'opsz' 144" }}>
              You have ideas.<br />
              <em style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1, 'opsz' 144", color: 'transparent',
                backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ffd7a8 25%, #d99875 60%, #d67347 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>Time to turn one into a company.</em>
            </h2>
            <p className="serif text-[1.15rem] md:text-[1.3rem] leading-[1.5] max-w-[52ch] mb-14"
              style={{ color: '#d8cfc0', fontWeight: 400, fontVariationSettings: "'SOFT' 60, 'opsz' 30" }}>
              Pitch the idea you&rsquo;ve been sitting on. Back the ones you believe in. No pitch decks, no investors — just you and the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-start">
              <Link href="/browse" className="group relative inline-flex items-center gap-3 px-7 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] font-semibold transition-colors duration-300"
                style={{ background: '#e89660', color: '#0a0814' }}>
                <span>Enter the markets</span>
                <svg width="20" height="10" viewBox="0 0 20 10" fill="none" className="transition-transform duration-300 group-hover:translate-x-1.5">
                  <path d="M1 5H19M19 5L14 1M19 5L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                </svg>
              </Link>
              <button onClick={handleLaunchClick} className="group inline-flex items-center gap-3 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] transition-colors" style={{ color: '#f4eee4' }}>
                <span className="relative inline-block after:absolute after:left-0 after:bottom-[-4px] after:h-px after:w-full after:bg-current after:scale-x-0 after:origin-left group-hover:after:scale-x-100 after:transition-transform after:duration-500">Pitch your idea</span>
                <span className="text-[#8a7f72] group-hover:text-[#e89660] transition-colors">↗</span>
              </button>
              <Link href="/whitepaper" className="group inline-flex items-center gap-3 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] transition-colors" style={{ color: '#8a7f72' }}>
                <span className="relative inline-block after:absolute after:left-0 after:bottom-[-4px] after:h-px after:w-full after:bg-current after:scale-x-0 after:origin-left group-hover:after:scale-x-100 after:transition-transform after:duration-500">Read the thesis</span>
              </Link>
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
