'use client';

import React, { useMemo, useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

// Tree branch type
type BranchData = {
  points: [number, number, number][];
  radius: number;
  delay: number;
  colorFrom: string;
  colorTo: string;
};

// Hand-designed asymmetric tree topology (not mirrored)
// Coordinates: x left(-)/right(+), y up(+)/down(-), z depth
const BRANCHES: BranchData[] = [
  // Trunk — thick, slight S-curve
  { points: [[0, -5, 0], [0.2, -3.5, 0.1], [-0.15, -2, 0], [0.1, -0.5, 0.05], [-0.1, 1, 0], [0.05, 2.3, 0]], radius: 0.14, delay: 0.0, colorFrom: '#fff5e1', colorTo: '#ecb48a' },
  // Lower-left heavy main branch (asymmetric, reaches far)
  { points: [[0, -2.5, 0], [-1.2, -2.2, 0.2], [-2.3, -1.5, 0.3], [-3.2, -0.5, 0.1], [-3.8, 0.6, -0.2], [-4.0, 1.8, -0.1]], radius: 0.09, delay: 0.4, colorFrom: '#ecb48a', colorTo: '#d99875' },
  // Lower-right main branch
  { points: [[0, -2.2, 0], [1.0, -2.0, -0.1], [2.0, -1.3, -0.2], [2.8, -0.3, -0.1], [3.3, 0.8, 0.1]], radius: 0.08, delay: 0.5, colorFrom: '#ecb48a', colorTo: '#d99875' },
  // Right-secondary
  { points: [[0, -1.0, 0], [1.4, -0.8, 0.1], [2.6, -0.2, 0.3], [3.5, 0.8, 0.2], [3.9, 2.0, 0.0]], radius: 0.07, delay: 0.7, colorFrom: '#ecb48a', colorTo: '#d99875' },
  // Mid-left reaching upward
  { points: [[-0.1, 0, 0], [-1.0, 0.5, 0.1], [-1.9, 1.4, 0.2], [-2.6, 2.4, 0.05], [-3.0, 3.5, -0.1]], radius: 0.06, delay: 0.85, colorFrom: '#d99875' , colorTo: '#b8613a' },
  // Mid-right reaching upward
  { points: [[0.1, 0.2, 0], [0.9, 0.8, -0.1], [1.7, 1.8, 0.0], [2.3, 2.9, 0.1], [2.7, 4.0, 0.0]], radius: 0.06, delay: 0.95, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Upper-left tall
  { points: [[-0.1, 1.2, 0], [-0.5, 2.2, 0.05], [-1.0, 3.2, 0.1], [-1.5, 4.3, 0], [-1.8, 5.3, 0]], radius: 0.05, delay: 1.1, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Upper-right tall
  { points: [[0.1, 1.3, 0], [0.4, 2.4, -0.05], [0.8, 3.5, 0], [1.1, 4.6, 0.05], [1.3, 5.6, 0]], radius: 0.05, delay: 1.15, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Crown-center
  { points: [[0.05, 2.3, 0], [0.0, 3.4, 0], [-0.1, 4.5, 0], [0.0, 5.7, 0]], radius: 0.04, delay: 1.3, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Sub-branches from lower-left
  { points: [[-2.3, -1.5, 0.3], [-2.9, -0.8, 0.5], [-3.4, 0.2, 0.6], [-3.6, 1.2, 0.4]], radius: 0.04, delay: 1.0, colorFrom: '#d99875', colorTo: '#b8613a' },
  { points: [[-3.2, -0.5, 0.1], [-3.8, 0.3, -0.3], [-4.4, 1.2, -0.4], [-4.8, 2.2, -0.3]], radius: 0.04, delay: 1.15, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Sub-branches from lower-right
  { points: [[2.8, -0.3, -0.1], [3.4, 0.5, 0.1], [3.9, 1.4, 0.3], [4.1, 2.3, 0.2]], radius: 0.04, delay: 1.25, colorFrom: '#d99875', colorTo: '#b8613a' },
  { points: [[3.3, 0.8, 0.1], [3.8, 1.7, -0.1], [4.2, 2.7, -0.2]], radius: 0.035, delay: 1.4, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Fine upper-left branches
  { points: [[-2.6, 2.4, 0.05], [-2.9, 3.2, 0.0], [-3.2, 4.1, -0.1]], radius: 0.03, delay: 1.5, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[-3.0, 3.5, -0.1], [-3.3, 4.3, -0.2], [-3.5, 5.1, 0]], radius: 0.03, delay: 1.6, colorFrom: '#b8613a', colorTo: '#7a4428' },
  // Fine upper-right branches
  { points: [[2.3, 2.9, 0.1], [2.6, 3.7, 0.0], [2.9, 4.5, -0.1]], radius: 0.03, delay: 1.55, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[2.7, 4.0, 0.0], [2.9, 4.8, 0.1], [3.0, 5.7, 0]], radius: 0.03, delay: 1.7, colorFrom: '#b8613a', colorTo: '#7a4428' },
  // Crown left tips
  { points: [[-1.8, 5.3, 0], [-2.1, 6.0, 0]], radius: 0.025, delay: 1.85, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[-1.5, 4.3, 0], [-1.9, 4.9, 0.2], [-2.1, 5.5, 0.1]], radius: 0.025, delay: 1.9, colorFrom: '#b8613a', colorTo: '#7a4428' },
  // Crown right tips
  { points: [[1.3, 5.6, 0], [1.5, 6.3, 0]], radius: 0.025, delay: 1.95, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[1.1, 4.6, 0.05], [1.4, 5.2, -0.1], [1.6, 5.9, 0]], radius: 0.025, delay: 2.0, colorFrom: '#b8613a', colorTo: '#7a4428' },
  // Crown center top
  { points: [[0.0, 5.7, 0], [-0.1, 6.3, 0], [0.0, 6.9, 0]], radius: 0.025, delay: 2.05, colorFrom: '#b8613a', colorTo: '#7a4428' },
  // ─── Extra secondary/tertiary branches for fuller canopy ───
  // Lower-left extra sprouts off main
  { points: [[-1.2, -2.2, 0.2], [-1.6, -1.4, 0.3], [-2.0, -0.5, 0.4], [-2.1, 0.4, 0.3]], radius: 0.045, delay: 0.75, colorFrom: '#ecb48a', colorTo: '#d99875' },
  { points: [[-2.9, -0.8, 0.5], [-3.4, 0.0, 0.7], [-3.7, 0.9, 0.8]], radius: 0.035, delay: 1.2, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Lower-right extra sprouts
  { points: [[1.0, -2.0, -0.1], [1.3, -1.0, -0.2], [1.6, 0.0, -0.1], [1.7, 0.9, -0.05]], radius: 0.045, delay: 0.85, colorFrom: '#ecb48a', colorTo: '#d99875' },
  { points: [[2.0, -1.3, -0.2], [2.5, -0.5, -0.4], [2.9, 0.4, -0.5]], radius: 0.035, delay: 1.1, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Mid interior branches — filling sparse center
  { points: [[-1.0, 0.5, 0.1], [-1.3, 1.3, 0.3], [-1.5, 2.2, 0.4]], radius: 0.04, delay: 1.05, colorFrom: '#d99875', colorTo: '#b8613a' },
  { points: [[0.9, 0.8, -0.1], [1.2, 1.6, -0.3], [1.4, 2.5, -0.4]], radius: 0.04, delay: 1.15, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Diagonal arching branches
  { points: [[-1.9, 1.4, 0.2], [-2.3, 2.1, 0.0], [-2.6, 2.8, -0.2]], radius: 0.035, delay: 1.35, colorFrom: '#d99875', colorTo: '#b8613a' },
  { points: [[1.7, 1.8, 0.0], [2.0, 2.5, -0.2], [2.3, 3.2, -0.3]], radius: 0.035, delay: 1.4, colorFrom: '#d99875', colorTo: '#b8613a' },
  // Upper secondary branches
  { points: [[-0.5, 2.2, 0.05], [-0.8, 3.0, 0.2], [-1.1, 3.8, 0.1]], radius: 0.03, delay: 1.5, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[0.4, 2.4, -0.05], [0.7, 3.3, -0.2], [1.0, 4.1, -0.1]], radius: 0.03, delay: 1.55, colorFrom: '#b8613a', colorTo: '#7a4428' },
  // Outer canopy whiskers
  { points: [[-3.3, 4.3, -0.2], [-3.9, 4.8, -0.3]], radius: 0.022, delay: 1.75, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[2.9, 4.8, 0.1], [3.4, 5.3, 0.2]], radius: 0.022, delay: 1.8, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[-2.1, 6.0, 0], [-2.5, 6.5, 0.1]], radius: 0.02, delay: 2.0, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[1.5, 6.3, 0], [1.9, 6.8, -0.1]], radius: 0.02, delay: 2.05, colorFrom: '#b8613a', colorTo: '#7a4428' },
  // Interior delicate twigs
  { points: [[-0.1, 4.5, 0], [-0.4, 5.0, 0.1], [-0.5, 5.5, 0]], radius: 0.022, delay: 1.7, colorFrom: '#b8613a', colorTo: '#7a4428' },
  { points: [[-0.1, 4.5, 0], [0.3, 5.1, -0.1], [0.5, 5.6, 0]], radius: 0.022, delay: 1.75, colorFrom: '#b8613a', colorTo: '#7a4428' },
];

// Leaf anchor positions (branch tip 3D coords) — live markets occupy these
const LEAF_ANCHORS: [number, number, number][] = [
  [-4.0, 1.8, -0.1], [3.3, 0.8, 0.1], [3.9, 2.0, 0.0],
  [-3.0, 3.5, -0.1], [2.7, 4.0, 0.0],
  [-1.8, 5.3, 0], [1.3, 5.6, 0],
  [-3.6, 1.2, 0.4], [-4.8, 2.2, -0.3],
  [4.1, 2.3, 0.2], [4.2, 2.7, -0.2],
  [-3.2, 4.1, -0.1], [-3.5, 5.1, 0],
  [2.9, 4.5, -0.1], [3.0, 5.7, 0],
  [0.0, 6.9, 0], [-2.1, 6.0, 0], [1.5, 6.3, 0],
];

function Branch({ data, startTime }: { data: BranchData; startTime: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  const { curve, geometry } = useMemo(() => {
    const vectors = data.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const c = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.5);
    const g = new THREE.TubeGeometry(c, 60, data.radius, 8, false);
    // Start hidden — growth animation reveals triangles progressively via setDrawRange
    g.setDrawRange(0, 0);
    return { curve: c, geometry: g };
  }, [data]);

  // Gradient along the branch via vertex colors
  useEffect(() => {
    const colorFrom = new THREE.Color(data.colorFrom);
    const colorTo = new THREE.Color(data.colorTo);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const minY = Math.min(...data.points.map((p) => p[1]));
    const maxY = Math.max(...data.points.map((p) => p[1]));
    const range = maxY - minY || 1;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = Math.min(1, Math.max(0, (y - minY) / range));
      const c = colorFrom.clone().lerp(colorTo, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }, [geometry, data]);

  // River-flow growth — progressively reveal the tube from base to tip via setDrawRange.
  // TubeGeometry emits vertices in order along the curve (ring by ring), so advancing the draw range
  // paints the tube as if liquid were rising through the stem.
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const elapsed = clock.elapsedTime - startTime - data.delay;
    const duration = 3.0; // slower, more deliberate flow
    const t = Math.max(0, Math.min(1, elapsed / duration));
    // Soft ease-out — fast initial surge, gentle settle at the tip
    const eased = 1 - Math.pow(1 - t, 2.2);
    const geom = meshRef.current.geometry as THREE.BufferGeometry;
    if (geom.index) {
      const total = geom.index.count;
      geom.setDrawRange(0, Math.floor(total * eased));
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial ref={matRef} vertexColors transparent opacity={1} toneMapped={false} />
    </mesh>
  );
}

type LiveMarket = {
  id: string;
  name: string;
  volume: number;
  participants: number;
  yesPercent: number | null;
};

function Leaves({ markets, onHover, startTime }: { markets: LiveMarket[]; onHover: (m: LiveMarket | null, px?: number, py?: number) => void; startTime: number }) {
  const { camera, size } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const data = useMemo(() => {
    const count = Math.min(markets.length, LEAF_ANCHORS.length);
    const maxVol = Math.max(1, ...markets.map((m) => m.volume || 0));
    return Array.from({ length: count }, (_, i) => {
      const m = markets[i];
      const pos = LEAF_ANCHORS[i];
      const volNorm = (m.volume || 0) / maxVol;
      return {
        m,
        pos,
        size: 0.09 + volNorm * 0.08,
        delay: 2.2 + i * 0.09,
        pulse: 2.4 + (1 - volNorm) * 3,
      };
    });
  }, [markets]);

  // Project world → screen for tooltip positioning on hover
  const projectHover = (worldPos: THREE.Vector3, market: LiveMarket) => {
    const v = worldPos.clone().project(camera);
    const px = (v.x + 1) * 0.5 * size.width;
    const py = (-v.y + 1) * 0.5 * size.height;
    onHover(market, px, py);
  };

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const d = data[i];
      if (!d) return;
      const elapsed = clock.elapsedTime - startTime - d.delay;
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        const fade = Math.max(0, Math.min(1, elapsed / 1.0));
        // Pulse brightness
        const pulse = 0.85 + Math.sin((clock.elapsedTime + i) * (2 * Math.PI / d.pulse)) * 0.15;
        mat.opacity = fade * pulse;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((d) => (
        <mesh
          key={d.m.id}
          position={d.pos}
          onPointerOver={(e) => {
            e.stopPropagation();
            const worldPos = new THREE.Vector3(...d.pos);
            projectHover(worldPos, d.m);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            onHover(null);
            document.body.style.cursor = 'default';
          }}
          onClick={() => {
            window.location.href = `/market/${d.m.id}`;
          }}
        >
          <sphereGeometry args={[d.size, 16, 16]} />
          <meshBasicMaterial color="#fff7e8" transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// Ambient particle mist drifting upward
function Mist() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 80;
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 11 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
      speeds[i] = 0.15 + Math.random() * 0.35;
    }
    return { positions, speeds };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const pos = (pointsRef.current.geometry.attributes.position as THREE.BufferAttribute);
    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) + speeds[i] * delta * 0.35;
      if (y > 7) {
        y = -6;
        pos.setX(i, (Math.random() - 0.5) * 10);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#ecb48a" transparent opacity={0.55} toneMapped={false} depthWrite={false} />
    </points>
  );
}

// Sun at the root — yellowish orange disc sitting BEHIND the trunk so the stem's tip lands on the sun's center
function RootGlow({
  startTime,
  onClick,
}: {
  startTime: number;
  // Optional click handler. When provided, the seed becomes the
  // interactive "door" — clicking it (and only it) is what enters the
  // docs from the cover page. The cursor changes to pointer on hover
  // and the seed pulses brighter to signal affordance.
  onClick?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ camera, clock }) => {
    if (meshRef.current) meshRef.current.lookAt(camera.position);
    if (matRef.current) {
      const elapsed = clock.elapsedTime - startTime;
      const t = Math.max(0, Math.min(1, elapsed / 1.6));
      const eased = 1 - Math.pow(1 - t, 3);
      // Brighter on hover; a slow ambient pulse the rest of the time so
      // it reads as a living focal point rather than a static disc.
      const pulse = 0.92 + Math.sin((clock.elapsedTime - startTime) * 1.4) * 0.06;
      const target = hovered ? 1 : pulse * 0.95;
      matRef.current.opacity = eased * target;
    }
  });

  // Switch the body cursor on hover so the affordance is obvious without
  // a textual cue. Restored on unmount or hover-out.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.cursor = hovered && onClick ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered, onClick]);

  return (
    <mesh
      ref={meshRef}
      position={[0, -5.0, -0.3]}
      renderOrder={-1}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onPointerOver={onClick ? () => setHovered(true) : undefined}
      onPointerOut={onClick ? () => setHovered(false) : undefined}
      // Slight scale-up on hover for tactile feedback without breaking
      // the visual silhouette of the tree.
      scale={hovered ? 1.12 : 1}
    >
      <circleGeometry args={[0.58, 96]} />
      <meshBasicMaterial
        ref={matRef}
        color="#e89628"
        transparent
        opacity={0}
        toneMapped={false}
      />
    </mesh>
  );
}

// Deep botanical root system — scaled to ~0.5× tree height (sapling proportions)
// 4 tiers: primary taproots → secondary → tertiary → fine root-hair capillaries
// Each entry tapers from startRadius (near origin) to endRadius (at the tip)
const ROOT_CAPILLARIES: { points: [number, number, number][]; startRadius: number; endRadius: number }[] = [
  // ── PRIMARY (3 thick taproots, deep anchors) ──
  // Center taproot plunges straight down
  { points: [[0, -5, 0], [0.05, -5.5, 0.05], [-0.05, -6.4, -0.05], [0.03, -7.3, 0], [0, -8.0, 0]], startRadius: 0.11, endRadius: 0.035 },
  // Left primary sweeping down-outward
  { points: [[0, -5, 0], [-0.3, -5.4, 0.15], [-0.6, -6.0, 0.3], [-0.85, -6.7, 0.4], [-1.05, -7.3, 0.45]], startRadius: 0.095, endRadius: 0.03 },
  // Right primary sweeping down-outward
  { points: [[0, -5, 0], [0.3, -5.4, -0.15], [0.6, -6.0, -0.3], [0.85, -6.7, -0.4], [1.05, -7.3, -0.45]], startRadius: 0.095, endRadius: 0.03 },

  // ── SECONDARY (branching off primary midpoints and tips) ──
  // From center-primary midpoint (y≈-6.4), small lateral feeder roots
  { points: [[-0.05, -6.4, -0.05], [-0.35, -6.8, 0.15], [-0.6, -7.2, 0.25]], startRadius: 0.04, endRadius: 0.018 },
  { points: [[-0.05, -6.4, -0.05], [0.3, -6.8, -0.15], [0.6, -7.2, -0.25]], startRadius: 0.04, endRadius: 0.018 },
  // From center taproot tip (y=-8.0)
  { points: [[0, -8.0, 0], [-0.3, -8.5, 0.2], [-0.55, -9.1, 0.35]], startRadius: 0.034, endRadius: 0.014 },
  { points: [[0, -8.0, 0], [0.3, -8.5, -0.2], [0.55, -9.1, -0.35]], startRadius: 0.034, endRadius: 0.014 },
  { points: [[0, -8.0, 0], [0.05, -8.6, 0.25], [0.08, -9.2, 0.4]], startRadius: 0.03, endRadius: 0.012 },
  { points: [[0, -8.0, 0], [-0.05, -8.6, -0.2], [-0.1, -9.3, -0.3]], startRadius: 0.03, endRadius: 0.012 },
  // From left primary midpoint
  { points: [[-0.6, -6.0, 0.3], [-0.95, -6.4, 0.45], [-1.3, -6.8, 0.55]], startRadius: 0.04, endRadius: 0.018 },
  { points: [[-0.85, -6.7, 0.4], [-1.2, -7.1, 0.55], [-1.5, -7.5, 0.6]], startRadius: 0.038, endRadius: 0.016 },
  // From left primary tip
  { points: [[-1.05, -7.3, 0.45], [-1.4, -7.7, 0.55], [-1.75, -8.1, 0.6]], startRadius: 0.036, endRadius: 0.015 },
  { points: [[-1.05, -7.3, 0.45], [-1.25, -7.85, 0.4], [-1.45, -8.4, 0.35]], startRadius: 0.033, endRadius: 0.013 },
  // From right primary midpoint
  { points: [[0.6, -6.0, -0.3], [0.95, -6.4, -0.45], [1.3, -6.8, -0.55]], startRadius: 0.04, endRadius: 0.018 },
  { points: [[0.85, -6.7, -0.4], [1.2, -7.1, -0.55], [1.5, -7.5, -0.6]], startRadius: 0.038, endRadius: 0.016 },
  // From right primary tip
  { points: [[1.05, -7.3, -0.45], [1.4, -7.7, -0.55], [1.75, -8.1, -0.6]], startRadius: 0.036, endRadius: 0.015 },
  { points: [[1.05, -7.3, -0.45], [1.25, -7.85, -0.4], [1.45, -8.4, -0.35]], startRadius: 0.033, endRadius: 0.013 },

  // ── TERTIARY (finer roots branching from secondary tips) ──
  // From left-mid secondary (-1.3, -6.8, 0.55)
  { points: [[-1.3, -6.8, 0.55], [-1.65, -7.1, 0.7], [-1.95, -7.4, 0.8]], startRadius: 0.018, endRadius: 0.007 },
  { points: [[-1.3, -6.8, 0.55], [-1.55, -7.2, 0.5], [-1.75, -7.55, 0.4]], startRadius: 0.016, endRadius: 0.006 },
  // From left far secondary (-1.5, -7.5, 0.6)
  { points: [[-1.5, -7.5, 0.6], [-1.85, -7.85, 0.7], [-2.15, -8.15, 0.75]], startRadius: 0.017, endRadius: 0.006 },
  { points: [[-1.5, -7.5, 0.6], [-1.7, -7.95, 0.55], [-1.9, -8.35, 0.45]], startRadius: 0.015, endRadius: 0.005 },
  // From left deepest secondary (-1.75, -8.1, 0.6)
  { points: [[-1.75, -8.1, 0.6], [-2.05, -8.45, 0.7], [-2.3, -8.7, 0.75]], startRadius: 0.016, endRadius: 0.006 },
  { points: [[-1.45, -8.4, 0.35], [-1.7, -8.85, 0.35], [-1.9, -9.2, 0.3]], startRadius: 0.015, endRadius: 0.005 },
  // From right-mid secondary (1.3, -6.8, -0.55)
  { points: [[1.3, -6.8, -0.55], [1.65, -7.1, -0.7], [1.95, -7.4, -0.8]], startRadius: 0.018, endRadius: 0.007 },
  { points: [[1.3, -6.8, -0.55], [1.55, -7.2, -0.5], [1.75, -7.55, -0.4]], startRadius: 0.016, endRadius: 0.006 },
  // From right far secondary (1.5, -7.5, -0.6)
  { points: [[1.5, -7.5, -0.6], [1.85, -7.85, -0.7], [2.15, -8.15, -0.75]], startRadius: 0.017, endRadius: 0.006 },
  { points: [[1.5, -7.5, -0.6], [1.7, -7.95, -0.55], [1.9, -8.35, -0.45]], startRadius: 0.015, endRadius: 0.005 },
  // From right deepest secondary
  { points: [[1.75, -8.1, -0.6], [2.05, -8.45, -0.7], [2.3, -8.7, -0.75]], startRadius: 0.016, endRadius: 0.006 },
  { points: [[1.45, -8.4, -0.35], [1.7, -8.85, -0.35], [1.9, -9.2, -0.3]], startRadius: 0.015, endRadius: 0.005 },
  // Center-down tertiary
  { points: [[-0.55, -9.1, 0.35], [-0.75, -9.5, 0.5], [-0.9, -9.8, 0.6]], startRadius: 0.014, endRadius: 0.005 },
  { points: [[0.55, -9.1, -0.35], [0.75, -9.5, -0.5], [0.9, -9.8, -0.6]], startRadius: 0.014, endRadius: 0.005 },
  { points: [[0.08, -9.2, 0.4], [0.12, -9.6, 0.5], [0.1, -9.9, 0.55]], startRadius: 0.012, endRadius: 0.004 },
  { points: [[-0.1, -9.3, -0.3], [-0.15, -9.7, -0.4], [-0.12, -10.0, -0.45]], startRadius: 0.012, endRadius: 0.004 },

  // ── QUATERNARY (root hairs — very fine capillaries fanning at depths) ──
  // Left cluster
  { points: [[-1.95, -7.4, 0.8], [-2.2, -7.65, 0.9], [-2.4, -7.85, 0.95]], startRadius: 0.008, endRadius: 0.003 },
  { points: [[-2.15, -8.15, 0.75], [-2.4, -8.4, 0.85], [-2.6, -8.6, 0.9]], startRadius: 0.008, endRadius: 0.003 },
  { points: [[-2.3, -8.7, 0.75], [-2.55, -8.95, 0.85], [-2.75, -9.15, 0.9]], startRadius: 0.008, endRadius: 0.003 },
  { points: [[-1.9, -9.2, 0.3], [-2.1, -9.5, 0.4], [-2.25, -9.75, 0.45]], startRadius: 0.007, endRadius: 0.0025 },
  { points: [[-0.9, -9.8, 0.6], [-1.05, -10.1, 0.7], [-1.15, -10.3, 0.75]], startRadius: 0.007, endRadius: 0.0025 },
  // Right cluster
  { points: [[1.95, -7.4, -0.8], [2.2, -7.65, -0.9], [2.4, -7.85, -0.95]], startRadius: 0.008, endRadius: 0.003 },
  { points: [[2.15, -8.15, -0.75], [2.4, -8.4, -0.85], [2.6, -8.6, -0.9]], startRadius: 0.008, endRadius: 0.003 },
  { points: [[2.3, -8.7, -0.75], [2.55, -8.95, -0.85], [2.75, -9.15, -0.9]], startRadius: 0.008, endRadius: 0.003 },
  { points: [[1.9, -9.2, -0.3], [2.1, -9.5, -0.4], [2.25, -9.75, -0.45]], startRadius: 0.007, endRadius: 0.0025 },
  { points: [[0.9, -9.8, -0.6], [1.05, -10.1, -0.7], [1.15, -10.3, -0.75]], startRadius: 0.007, endRadius: 0.0025 },
  // Deep center cluster
  { points: [[0.1, -9.9, 0.55], [0.15, -10.2, 0.65], [0.1, -10.4, 0.7]], startRadius: 0.006, endRadius: 0.002 },
  { points: [[-0.12, -10.0, -0.45], [-0.18, -10.3, -0.55], [-0.15, -10.5, -0.6]], startRadius: 0.006, endRadius: 0.002 },
  // Extra mid-depth fine hairs
  { points: [[-0.6, -7.2, 0.25], [-0.8, -7.5, 0.35], [-0.95, -7.7, 0.4]], startRadius: 0.008, endRadius: 0.003 },
  { points: [[0.6, -7.2, -0.25], [0.8, -7.5, -0.35], [0.95, -7.7, -0.4]], startRadius: 0.008, endRadius: 0.003 },
  { points: [[-1.75, -7.55, 0.4], [-2.0, -7.75, 0.35], [-2.15, -7.9, 0.3]], startRadius: 0.007, endRadius: 0.0025 },
  { points: [[1.75, -7.55, -0.4], [2.0, -7.75, -0.35], [2.15, -7.9, -0.3]], startRadius: 0.007, endRadius: 0.0025 },
];

function RootCapillary({ data, startTime }: { data: (typeof ROOT_CAPILLARIES)[number]; startTime: number }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const geometry = useMemo(() => {
    const vectors = data.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.5);
    const tubularSegments = 36;
    const radialSegments = 6;
    const geom = new THREE.TubeGeometry(curve, tubularSegments, data.startRadius, radialSegments, false);
    // Taper the tube by scaling each cross-section ring from startRadius → endRadius
    const pos = geom.attributes.position;
    const ratio = data.endRadius / data.startRadius;
    const vertsPerRing = radialSegments + 1;
    const rings = tubularSegments + 1;
    for (let r = 0; r < rings; r++) {
      const t = r / (rings - 1);
      const scale = 1 + (ratio - 1) * t;
      const center = curve.getPointAt(t);
      for (let v = 0; v < vertsPerRing; v++) {
        const idx = r * vertsPerRing + v;
        pos.setXYZ(
          idx,
          center.x + (pos.getX(idx) - center.x) * scale,
          center.y + (pos.getY(idx) - center.y) * scale,
          center.z + (pos.getZ(idx) - center.z) * scale,
        );
      }
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }, [data]);
  useEffect(() => {
    // 3-stop gradient so the trunk → root transition is seamless AND the root stays warm
    // rather than passing through muddy beige: cream → warm sienna → deep earth brown.
    const colorStart = new THREE.Color('#fff5e1'); // matches trunk base exactly
    const colorMid = new THREE.Color('#b46a3a'); // warm sienna mid
    const colorEnd = new THREE.Color('#3a1c0d'); // deep earth at capillary tips
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const ys = data.points.map((p) => p[1]);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const range = maxY - minY || 1;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = 1 - Math.min(1, Math.max(0, (y - minY) / range));
      const c = t < 0.5
        ? colorStart.clone().lerp(colorMid, t * 2)
        : colorMid.clone().lerp(colorEnd, (t - 0.5) * 2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }, [geometry, data]);
  // Gentle fade-in so the whole root system materializes smoothly on load
  // (no per-capillary staggering — the underground appears as one unified system).
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const elapsed = clock.elapsedTime - startTime;
    const duration = 1.1;
    const t = Math.max(0, Math.min(1, elapsed / duration));
    // Smooth ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    matRef.current.opacity = eased * 0.9;
  });
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial ref={matRef} vertexColors transparent opacity={0} toneMapped={false} />
    </mesh>
  );
}

// Bilva leaf (Lord Shiva's sacred plant) — trifoliate silhouette: three elongated leaflets
// joined at the base, center one tallest, side leaflets angled outward
const LEAF_SHAPE = (() => {
  const s = new THREE.Shape();
  // Base of petiole
  s.moveTo(0, -0.5);
  // Outer edge of right leaflet: sweep up and around to its tip
  s.quadraticCurveTo(0.15, -0.3, 0.3, -0.05);
  s.quadraticCurveTo(0.48, 0.15, 0.38, 0.35);
  // Inner notch between right leaflet and center leaflet
  s.quadraticCurveTo(0.25, 0.4, 0.12, 0.4);
  // Right edge of center leaflet up to tip
  s.quadraticCurveTo(0.16, 0.65, 0, 0.95);
  // Left edge of center leaflet back down
  s.quadraticCurveTo(-0.16, 0.65, -0.12, 0.4);
  // Notch between center and left leaflet
  s.quadraticCurveTo(-0.25, 0.4, -0.38, 0.35);
  // Around left leaflet tip and back down to base
  s.quadraticCurveTo(-0.48, 0.15, -0.3, -0.05);
  s.quadraticCurveTo(-0.15, -0.3, 0, -0.5);
  return s;
})();

// Procedural billboard leaves along branches (always face camera → always visible)
function GreenLeaves({ startTime }: { startTime: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const LEAVES_PER_BRANCH = 5;
  type Leaf = { pos: THREE.Vector3; size: number; tint: number; delay: number; phase: number; baseRotZ: number };
  const leaves = useMemo<Leaf[]>(() => {
    const out: Leaf[] = [];
    BRANCHES.slice(3).forEach((b, bi) => {
      const vectors = b.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const curve = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.5);
      for (let k = 0; k < LEAVES_PER_BRANCH; k++) {
        const t = 0.15 + Math.random() * 0.8;
        const pos = curve.getPointAt(t).clone();
        const tangent = curve.getTangentAt(t);
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        pos.addScaledVector(normal, side * (0.1 + Math.random() * 0.08));
        pos.y += (Math.random() - 0.5) * 0.08;
        pos.z += (Math.random() - 0.5) * 0.1;
        out.push({
          pos,
          size: 0.44 + Math.random() * 0.2,
          tint: Math.random(),
          delay: 2.2 + bi * 0.04 + k * 0.03,
          phase: Math.random() * Math.PI * 2,
          baseRotZ: (Math.random() - 0.5) * 0.8,
        });
      }
    });
    return out;
  }, []);

  useFrame(({ clock, camera }) => {
    if (!groupRef.current) return;
    const wind = Math.sin(clock.elapsedTime * 0.85) * 0.15;
    groupRef.current.children.forEach((child, i) => {
      const l = leaves[i];
      if (!l) return;
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const elapsed = clock.elapsedTime - startTime - l.delay;
      const fade = Math.max(0, Math.min(1, elapsed / 1.2));
      mat.opacity = fade * 0.96;
      // Billboard — face the camera so leaves are always visible
      mesh.lookAt(camera.position);
      // Then add wind sway on top
      mesh.rotation.z += l.baseRotZ + Math.sin(clock.elapsedTime * 1.3 + l.phase) * 0.22 + wind;
    });
  });

  // Dark forest green palette — mature, natural foliage against the warm tree
  const colors = ['#1f4a24', '#2d5a2e', '#1a3d1c', '#35633a', '#244d27', '#2a5230'];
  return (
    <group ref={groupRef}>
      {leaves.map((l, i) => (
        <mesh key={i} position={l.pos} scale={l.size * 1.25} renderOrder={10}>
          <shapeGeometry args={[LEAF_SHAPE, 16]} />
          <meshBasicMaterial
            color={colors[Math.floor(l.tint * colors.length)]}
            side={THREE.DoubleSide}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// Energy photons — trace the full anatomy of the plant from the soil to the sky:
//   (1) emerge at a capillary tip in the earth → flow up through the root
//   (2) pass through the sun/base and up the trunk
//   (3) travel out along a branch to a leaf tip
//   (4) escape outward into the universe above
// High density of particles = many simultaneous journeys, continuously recycling.
function EnergyPhotons({ startTime }: { startTime: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const PHOTON_COUNT = 26;

  // Pre-compute complete journey curves — many combinations of (root entry × branch exit)
  const paths = useMemo(() => {
    const trunkPts = BRANCHES[0].points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    // Use a diverse subset of capillaries as entry points (mix of primary taproots + fine hairs)
    const rootSubset = [0, 1, 2, 3, 5, 7, 9, 11, 14, 17, 22, 27, 32].map((i) => ROOT_CAPILLARIES[i]).filter(Boolean);

    const results: THREE.CatmullRomCurve3[] = [];

    rootSubset.forEach((root) => {
      // Reverse the capillary so the photon enters at its deepest tip and flows up to the base
      const rootRev = [...root.points].reverse().map(([x, y, z]) => new THREE.Vector3(x, y, z));

      BRANCHES.slice(1).forEach((branch) => {
        const attachY = branch.points[0][1];
        const trunkBelow = trunkPts.filter((p) => p.y <= attachY);
        const branchPts = branch.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
        const tip = branchPts[branchPts.length - 1];

        // Escape: extend beyond the leaf tip, biased outward + upward, into the sky
        const outward = new THREE.Vector3(tip.x, 0, tip.z).normalize();
        const escapeDir = outward.add(new THREE.Vector3(0, 1.4, 0)).normalize();
        const escape = [
          tip.clone().addScaledVector(escapeDir, 1.0),
          tip.clone().addScaledVector(escapeDir, 2.3),
          tip.clone().addScaledVector(escapeDir, 4.0),
          tip.clone().addScaledVector(escapeDir, 6.0),
        ];

        const full = [...rootRev, ...trunkBelow, ...branchPts, ...escape];
        if (full.length >= 4) {
          results.push(new THREE.CatmullRomCurve3(full, false, 'catmullrom', 0.4));
        }
      });

      // Extra: some photons travel the trunk straight up through the crown and escape vertically
      const fullTrunkEscape = [
        ...rootRev,
        ...trunkPts,
        trunkPts[trunkPts.length - 1].clone().add(new THREE.Vector3(0.05, 1.5, 0)),
        trunkPts[trunkPts.length - 1].clone().add(new THREE.Vector3(-0.05, 3.5, 0)),
        trunkPts[trunkPts.length - 1].clone().add(new THREE.Vector3(0, 5.5, 0)),
      ];
      results.push(new THREE.CatmullRomCurve3(fullTrunkEscape, false, 'catmullrom', 0.4));
    });

    return results;
  }, []);

  // Per-photon state: which path, progress, speed
  const photons = useRef(
    Array.from({ length: PHOTON_COUNT }, (_, i) => ({
      pathIdx: Math.floor(Math.random() * paths.length),
      t: -0.2 - Math.random() * 5, // staggered delays so photons are always emerging
      speed: 0.11 + Math.random() * 0.1, // 5–9s per full journey (root to sky)
    })),
  );

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const sceneElapsed = clock.elapsedTime - startTime;
    const sceneReady = Math.max(0, Math.min(1, (sceneElapsed - 0.8) / 1.2));

    photons.current.forEach((p, i) => {
      p.t += delta * p.speed;
      if (p.t >= 1) {
        // Vanished into the sky — respawn at a random capillary tip with a brief delay
        p.t = -0.1 - Math.random() * 0.8;
        p.pathIdx = Math.floor(Math.random() * paths.length);
        p.speed = 0.11 + Math.random() * 0.1;
      }

      const mesh = groupRef.current!.children[i] as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;

      if (p.t < 0) {
        mat.opacity = 0;
        return;
      }

      const tClamped = Math.max(0, Math.min(1, p.t));
      mesh.position.copy(paths[p.pathIdx].getPointAt(tClamped));

      // Brightness profile along the journey:
      //  - t ∈ [0.0, 0.08]   : rising from soil (fade in)
      //  - t ∈ [0.08, 0.82]  : inside the plant body (full brightness)
      //  - t ∈ [0.82, 1.0]   : escaping into the universe (fade out)
      const fadeIn = Math.min(1, p.t / 0.08);
      const fadeOut = Math.min(1, (1 - p.t) / 0.18);
      mat.opacity = Math.min(fadeIn, fadeOut) * 0.95 * sceneReady;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: PHOTON_COUNT }).map((_, i) => (
        <mesh key={i} renderOrder={5}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial
            color="#fff4b8"
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// Cursor dust — a small trail of glowing particles that follows the mouse in world-space.
// Lives in the camera's plane at z=0 so particles feel tangible in the canvas.
function CursorDust() {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse, viewport } = useThree();
  const DUST_COUNT = 6;
  const positions = useRef(
    Array.from({ length: DUST_COUNT }, () => ({ x: 0, y: 0 })),
  );

  useFrame(() => {
    if (!groupRef.current) return;
    // Normalized mouse coords → world coords at z=0
    const targetX = (mouse.x * viewport.width) / 2;
    const targetY = (mouse.y * viewport.height) / 2;

    positions.current.forEach((pos, i) => {
      // Each subsequent dust has more lag → natural trailing tail
      const lag = 0.22 - i * 0.028;
      pos.x += (targetX - pos.x) * lag;
      pos.y += (targetY - pos.y) * lag;

      const mesh = groupRef.current!.children[i] as THREE.Mesh;
      mesh.position.set(pos.x, pos.y, 1);
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: DUST_COUNT }).map((_, i) => {
        const size = 0.055 - i * 0.006;
        const opacity = 0.85 - i * 0.12;
        return (
          <mesh key={i} renderOrder={20}>
            <sphereGeometry args={[size, 10, 10]} />
            <meshBasicMaterial
              color="#fff4b8"
              transparent
              opacity={opacity}
              toneMapped={false}
              depthWrite={false}
              depthTest={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({
  markets,
  startTime,
  onHover,
  onSeedClick,
}: {
  markets: LiveMarket[];
  startTime: number;
  onHover: (m: LiveMarket | null, px?: number, py?: number) => void;
  onSeedClick?: () => void;
}) {
  // The whole-tree group rotation that rocked the trunk has been
  // removed — the docs cover wants a static, anchored tree. The
  // *individual leaves* still wiggle on their own per-leaf wind in
  // GreenLeaves below, so the foliage breathes without the trunk
  // swaying. EnergyPhotons + ChromaticAberration still animate too.
  return (
    <group position={[0, 0.6635, 0]} scale={0.48}>
      <RootGlow startTime={startTime} onClick={onSeedClick} />
      {ROOT_CAPILLARIES.map((c, i) => (
        <RootCapillary key={`root-${i}`} data={c} startTime={startTime} />
      ))}
      {BRANCHES.map((b, i) => (
        <Branch key={i} data={b} startTime={startTime} />
      ))}
      <GreenLeaves startTime={startTime} />
      <Leaves markets={markets} startTime={startTime} onHover={onHover} />
      <EnergyPhotons startTime={startTime} />
      <Mist />
    </group>
  );
}

export default function CosmicTree3D({
  markets,
  onSeedClick,
  skipIntro = false,
}: {
  markets: LiveMarket[];
  // When provided, clicking the central seed (the warm circle at the
  // base of the trunk) invokes this handler. The docs cover page uses
  // it to navigate into /docs. Omit for the live-app dashboard.
  onSeedClick?: () => void;
  // When true, render the tree in its settled state from frame one — no
  // branches drawing in, no leaves easing up, no root capillaries
  // unspooling. The docs cover wants the finished image immediately;
  // the live-app dashboard keeps the intro animation. Implementation:
  // shift the startTime far into the past so every per-component
  // `(clock.elapsedTime - startTime - delay)` is already past its
  // ease-in window from the very first render frame.
  skipIntro?: boolean;
}) {
  const [startTime] = useState(() =>
    performance.now() / 1000 - (skipIntro ? 60 : 0),
  );
  const [hoverInfo, setHoverInfo] = useState<{ market: LiveMarket; x: number; y: number } | null>(null);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
      <div className="absolute inset-0 pointer-events-auto">
        <Canvas
          camera={{ position: [0, 0.5, 10], fov: 55, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <Scene
              markets={markets}
              startTime={startTime}
              onSeedClick={onSeedClick}
              onHover={(m, x, y) => {
                if (m && x != null && y != null) setHoverInfo({ market: m, x, y });
                else setHoverInfo(null);
              }}
            />
            <CursorDust />
            <EffectComposer multisampling={0}>
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={new THREE.Vector2(0.0005, 0.0005)}
                radialModulation={false}
                modulationOffset={0}
              />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>

      {/* Tooltip overlay (HTML, projected from 3D) */}
      {hoverInfo && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: hoverInfo.x,
            top: hoverInfo.y,
            transform: 'translate(-50%, calc(-100% - 16px))',
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
              {hoverInfo.market.name.length > 26 ? hoverInfo.market.name.slice(0, 26) + '…' : hoverInfo.market.name}
            </div>
            <div className="text-[#8a7f72] mt-1 flex items-center gap-2">
              <span style={{ color: '#f4eee4' }}>◎{hoverInfo.market.volume.toFixed(2)}</span>
              <span>·</span>
              <span>{hoverInfo.market.participants} votes</span>
              {hoverInfo.market.yesPercent != null && (
                <>
                  <span>·</span>
                  <span style={{ color: '#e89660' }}>{Math.round(hoverInfo.market.yesPercent)}% YES</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
