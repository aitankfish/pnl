'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Users, Rocket, Shield, Zap, CheckCircle, ExternalLink, ArrowRight, XCircle, ChevronDown } from 'lucide-react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useRouter } from 'next/navigation';
import CosmicOnboardingModal from '@/components/CosmicOnboardingModal';

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

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);
  const { authenticated, user, login } = useWallet();
  const router = useRouter();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [isSettingUpProfile, setIsSettingUpProfile] = useState(false);
  const hasSetupProfileRef = useRef(false);

  // If user is already authenticated on mount, redirect to browse
  useEffect(() => {
    if (authenticated && user) {
      console.log('🎯 User already authenticated on mount, redirecting to /browse');
      router.push('/browse');
    }
  }, []);

  // Auto-setup profile after authentication
  useEffect(() => {
    const setupProfile = async () => {
      console.log('🔍 Auth state check:', { authenticated, hasUser: !!user, isSettingUpProfile, hasSaved: hasSetupProfileRef.current });

      if (authenticated && user && !hasSetupProfileRef.current) {
        const walletAddress = user.wallet?.address;
        if (!walletAddress) {
          router.push('/browse');
          setShowOnboardingModal(false);
          setIsSettingUpProfile(false);
          return;
        }

        hasSetupProfileRef.current = true;

        // Immediately redirect to browse - profile creation happens in background
        console.log('🚀 User authenticated! Redirecting to /browse...');
        setShowOnboardingModal(false);
        setIsSettingUpProfile(false);
        router.push('/browse');

        // Background profile setup
        try {
          // Check if profile already exists and has username
          const checkResponse = await fetch(`/api/profile/${walletAddress}`);
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
          const response = await fetch('/api/profile/update', {
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

  const handleLaunchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!authenticated) {
      // User not logged in - show onboarding modal with choice
      setShowOnboardingModal(true);
    } else {
      // User is authenticated - navigate to browse page
      router.push('/browse');
    }
  };

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

  return (
    <>
      <div className="space-y-12 md:space-y-20 pt-3 sm:pt-4 px-3 sm:px-6 pb-8 md:pb-12 relative overflow-hidden">
        {/* Cosmic gradient background */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-purple-900/20 via-black to-black"></div>

        {/* Dense twinkling starfield with varied colors and sizes */}
        <div className="fixed inset-0 pointer-events-none z-0">
          {[...Array(500)].map((_, i) => {
            // More size variety
            const sizeRand = Math.random();
            const size = sizeRand > 0.95 ? '3px' : sizeRand > 0.85 ? '2.5px' : sizeRand > 0.7 ? '2px' : sizeRand > 0.5 ? '1.5px' : '1px';

            // More vibrant color variety with cosmic palette
            const colors = [
              '#ffffff',   // white
              '#93c5fd',   // blue
              '#c4b5fd',   // purple
              '#fde047',   // yellow
              '#7dd3fc',   // cyan
              '#fbbf24',   // amber/gold
              '#f9a8d4',   // pink
              '#6ee7b7',   // emerald
              '#d8b4fe',   // violet
              '#fb923c',   // orange
              '#60a5fa',   // bright blue
              '#a78bfa',   // lavender
            ];
            const color = colors[Math.floor(Math.random() * colors.length)];

            // More varied durations
            const duration = 1.5 + Math.random() * 5;
            const delay = Math.random() * 6;

            return (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: size,
                  height: size,
                  background: color,
                  boxShadow: `0 0 ${size === '3px' ? '6px' : size === '2.5px' ? '5px' : size === '2px' ? '4px' : '2px'} ${color}`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.4, 1, 0.4],
                  scale: [0, 0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: duration,
                  repeat: Infinity,
                  delay: delay,
                  ease: 'easeInOut',
                }}
              />
            );
          })}
        </div>

        {/* Subtle shooting stars in background */}
        <div className="fixed inset-0 pointer-events-none z-0 opacity-30">
          {[
            { startX: 10, startY: 15, endX: 35, endY: 45, delay: 4 },
            { startX: 90, startY: 25, endX: 60, endY: 55, delay: 12 },
            { startX: 20, startY: 60, endX: 50, endY: 85, delay: 20 },
          ].map((star, i) => (
            <motion.div
              key={`shooting-star-${i}`}
              className="absolute"
              style={{
                left: `${star.startX}%`,
                top: `${star.startY}%`,
              }}
              animate={{
                x: [`0vw`, `${star.endX - star.startX}vw`],
                y: [`0vh`, `${star.endY - star.startY}vh`],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: star.delay,
                repeatDelay: 25,
                ease: 'linear',
              }}
            >
              <div className="relative">
                {/* Star head */}
                <div className="w-[3px] h-[3px] bg-white rounded-full blur-[0.5px]" />
                {/* Subtle tail */}
                <div
                  className="absolute top-0 left-0 w-[40px] h-[1px] bg-gradient-to-l from-white/40 to-transparent"
                  style={{ transform: 'translateX(-40px)' }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Hero Section with parallax */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="text-center space-y-6 max-w-5xl mx-auto relative min-h-[calc(100vh-80px)] flex flex-col justify-center z-10"
        >

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-white leading-tight relative z-10">
            {/* Glowing sun background effect - Fades in first */}
            <motion.div
              className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none"
              style={{ top: '75%' }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 0.5, scale: 1.2 }}
              transition={{ duration: 2.5, delay: 0.5, ease: 'easeOut' }}
            >
              <div className="w-80 h-80 md:w-[450px] md:h-[450px] bg-gradient-to-r from-yellow-200 via-orange-200 to-yellow-100 rounded-full blur-3xl animate-pulse"></div>
            </motion.div>

            {/* Headline text - Appears after glow */}
            <div>
              <motion.span
                className="text-transparent bg-clip-text cursor-pointer relative inline-block overflow-hidden"
                style={{
                  backgroundImage: 'linear-gradient(to right, rgb(209 213 219) 0%, rgb(255 255 255) 50%, rgb(209 213 219) 100%)',
                  backgroundSize: '200% 100%',
                  backgroundPosition: '0% 0%',
                  filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 15px rgba(209, 213, 219, 0.6)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))',
                  WebkitTextStroke: '0.5px rgba(200, 200, 200, 0.4)',
                  transition: 'background-position 0.3s ease, filter 0.3s ease',
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 2.5, ease: 'easeOut' }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  e.currentTarget.style.backgroundImage = 'linear-gradient(to right, rgb(209 213 219) 0%, rgb(255 255 255) 50%, rgb(209 213 219) 100%)';
                  e.currentTarget.style.backgroundPosition = `${x}% 0%`;
                  e.currentTarget.style.filter = 'drop-shadow(0 0 40px rgba(255, 255, 255, 1)) drop-shadow(0 0 20px rgba(209, 213, 219, 0.8)) drop-shadow(0 2px 12px rgba(0, 0, 0, 0.5))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundImage = 'linear-gradient(to right, rgb(209 213 219) 0%, rgb(255 255 255) 50%, rgb(209 213 219) 100%)';
                  e.currentTarget.style.backgroundPosition = '0% 0%';
                  e.currentTarget.style.filter = 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 15px rgba(209, 213, 219, 0.6)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))';
                }}
              >
                Discover Ideas
              </motion.span>
              <br />
              <motion.span
                className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-600 inline-block overflow-hidden cursor-pointer relative"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                transition={{
                  duration: 2.8,
                  delay: 3.8,
                  ease: [0.4, 0, 0.2, 1] // Natural flow - steady pace with smooth ending
                }}
                style={{
                  whiteSpace: 'nowrap',
                  filter: 'drop-shadow(0 0 20px rgba(251, 146, 60, 0.6))',
                  transition: 'all 0.4s ease',
                }}
                whileHover={{
                  scale: 1.05,
                  filter: 'drop-shadow(0 0 40px rgba(251, 146, 60, 1)) drop-shadow(0 0 60px rgba(234, 179, 8, 0.8))',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundImage = 'linear-gradient(to right, rgb(234 179 8) 0%, rgb(251 146 60) 50%, rgb(245 158 11) 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundImage = '';
                }}
              >
                In Their Genesis
              </motion.span>
            </div>
          </h1>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 5.3 }}
            className="flex justify-center"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
              <span className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-900/40 backdrop-blur-sm border border-purple-400/30 text-purple-200 text-sm font-semibold">
                <Zap className="w-4 h-4 text-cyan-400" />
                Let the Market Decide
              </span>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 5.8 }}
            className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed"
          >
            The first platform where <span className="text-cyan-400 font-semibold">community validates ideas</span> through prediction markets, giving you early access to tomorrow's breakthrough projects.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 6.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center pt-6"
          >
            <div className="relative group">
              {/* Outer cosmic glow - multiple layers */}
              <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-600 rounded-2xl blur-2xl opacity-40 group-hover:opacity-70 transition duration-700"></div>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-60 transition duration-500"></div>

              {/* Button with transparent background */}
              <Button
                onClick={handleLaunchClick}
                size="lg"
                className="relative overflow-hidden bg-transparent text-white font-bold text-xl px-14 py-8 rounded-2xl shadow-2xl transition-all hover:scale-105 border-2 border-purple-400/40 backdrop-blur-sm group-hover:border-cyan-400/60 group-hover:backdrop-blur-md"
              >
                <div className="flex items-center gap-4 relative z-10">
                  {/* Twinkling stars inside the button */}
                  <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                    {[...Array(25)].map((_, i) => {
                      const size = Math.random() > 0.7 ? '2px' : '1.5px';
                      const colors = ['#ffffff', '#93c5fd', '#c4b5fd', '#7dd3fc', '#a78bfa'];
                      const color = colors[Math.floor(Math.random() * colors.length)];
                      const duration = 1 + Math.random() * 3;
                      const delay = Math.random() * 4;

                      return (
                        <motion.div
                          key={i}
                          className="absolute rounded-full"
                          style={{
                            width: size,
                            height: size,
                            background: color,
                            boxShadow: `0 0 ${size === '2px' ? '4px' : '3px'} ${color}`,
                            left: `${5 + Math.random() * 90}%`,
                            top: `${10 + Math.random() * 80}%`,
                          }}
                          animate={{
                            opacity: [0.2, 1, 0.2],
                            scale: [0.8, 1.2, 0.8],
                          }}
                          transition={{
                            duration: duration,
                            repeat: Infinity,
                            delay: delay,
                            ease: 'easeInOut',
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Cosmic particles floating around rocket */}
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-cyan-400 rounded-full"
                        animate={{
                          x: [-10, 0],
                          y: [0, -8 * (i + 1), 0],
                          opacity: [0, 1, 0],
                          scale: [0, 1.5, 0],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.3,
                          ease: "easeOut",
                        }}
                      />
                    ))}
                  </div>

                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                    className="relative"
                  >
                    <Rocket className="w-7 h-7 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  </motion.div>

                  <span className="tracking-wide bg-gradient-to-r from-white via-cyan-100 to-purple-100 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    Launch
                  </span>

                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative"
                  >
                    <ArrowRight className="w-7 h-7 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  </motion.div>
                </div>
              </Button>
            </div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 7.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-12 left-0 right-0 flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="flex flex-col items-center"
            >
              <span className="text-sm text-gray-400 mb-2 text-center">Scroll to explore</span>
              <div className="w-6 h-10 border-2 border-gray-400/50 rounded-full flex items-start justify-center p-2">
                <motion.div
                  animate={{ y: [0, 12, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                />
              </div>
              <ChevronDown className="w-5 h-5 text-gray-400 mt-1" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Story Introduction */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.3 }}
          variants={scaleIn}
          className="max-w-4xl mx-auto"
        >
          <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-xl border-purple-400/30">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4 mb-4">
                {/* Animated Nova Character */}
                <div className="relative w-16 h-16 flex-shrink-0">
                  {/* Outer glow animation */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 animate-pulse opacity-50 blur-md"></div>

                  {/* Main avatar */}
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-700 flex items-center justify-center text-2xl border-2 border-cyan-300/50 overflow-hidden">
                    {/* Animated background particles */}
                    <div className="absolute inset-0">
                      <div className="absolute top-2 left-2 w-1 h-1 bg-white rounded-full animate-ping opacity-75"></div>
                      <div className="absolute bottom-3 right-3 w-1 h-1 bg-cyan-300 rounded-full animate-ping opacity-75" style={{ animationDelay: '0.5s' }}></div>
                      <div className="absolute top-4 right-2 w-0.5 h-0.5 bg-purple-300 rounded-full animate-ping opacity-75" style={{ animationDelay: '1s' }}></div>
                    </div>

                    {/* Character face */}
                    <div className="relative z-10 text-2xl filter drop-shadow-lg">
                      🧑‍🔬
                    </div>
                  </div>

                  {/* Rotating ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-purple-400 animate-spin" style={{ animationDuration: '3s' }}></div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Meet Nova</h3>
                  <p className="text-gray-300 text-base leading-relaxed">
                    A quantum physicist with a breakthrough idea: <span className="text-cyan-400 font-semibold">DIY Quantum Communication Kits</span> that make quantum cryptography accessible to everyone. Here's how Nova used P&L to turn vision into reality.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Phase 1: Community Validation */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          variants={fadeInUp}
          className="max-w-6xl mx-auto space-y-6"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xl font-bold shadow-lg shadow-cyan-500/50">
              1
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Community Validation</h2>
              <p className="text-cyan-400 text-sm uppercase tracking-wider font-medium">Phase 1: Prediction Market</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Story Text */}
            <div className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💡</div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">Nova Creates a Prediction Market</h4>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Instead of pitching to VCs, Nova asks the community: <span className="text-white font-semibold">"Will QuantumComm succeed?"</span>
                      </p>
                      <p className="text-gray-400 text-sm leading-relaxed mt-2">
                        The market runs for 7 days. People vote YES or NO with real SOL, putting money where their mouth is.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <div className="text-2xl font-bold text-green-400">247</div>
                        <div className="text-xs text-gray-400">YES Votes</div>
                      </div>
                      <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <div className="text-2xl font-bold text-red-400">53</div>
                        <div className="text-xs text-gray-400">NO Votes</div>
                      </div>
                      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="text-2xl font-bold text-blue-400">15.2</div>
                        <div className="text-xs text-gray-400">SOL Pool</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Market Card Mockup */}
            <TiltCard>
              <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-cyan-500/20 hover:border-cyan-400/40 transition-all shadow-xl hover:shadow-cyan-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-xl">
                      ⚛️
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg mb-1">QuantumComm - DIY Quantum Crypto</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">Science</Badge>
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs">$QCOMM</Badge>
                        <Badge className="bg-green-500/20 text-green-300 border-green-400/30 text-xs">✅ Active</Badge>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                    Making quantum cryptography accessible with DIY kits for secure communications...
                  </p>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400">✓ YES: 247</span>
                      <span className="text-red-400">✗ NO: 53</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div className="bg-gradient-to-r from-green-500 to-cyan-500 h-2.5 rounded-full" style={{width: '82%'}}></div>
                    </div>
                    <div className="text-center">
                      <span className="text-3xl font-bold text-white">82%</span>
                      <span className="text-sm text-gray-400 ml-2">YES</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
                    <div>
                      <div className="text-xs text-gray-400">Pool Target</div>
                      <div className="text-white font-bold">15 SOL</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Time Left</div>
                      <div className="text-orange-400 font-bold">2d 15h</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TiltCard>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Market Closed: 82% YES - Validation Successful ✓
            </div>
          </div>
        </motion.div>

        {/* Phase 2: Funding Round */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          variants={fadeInUp}
          className="max-w-6xl mx-auto space-y-6"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl font-bold shadow-lg shadow-blue-500/50">
              2
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Optional Funding Round</h2>
              <p className="text-blue-400 text-sm uppercase tracking-wider font-medium">Phase 2: Early Access</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Funding Card */}
            <div>
              <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl border-blue-400/30">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-white">Funding Progress</h3>
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30">Active</Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Raised</span>
                      <span className="text-white font-bold">42.8 SOL / 50 SOL</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all" style={{width: '85.6%'}}></div>
                    </div>
                    <div className="text-sm text-purple-400 font-semibold">85.6% Funded</div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-3">
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-xl font-bold text-white">156</div>
                      <div className="text-xs text-gray-400">Backers</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-xl font-bold text-white">0.27</div>
                      <div className="text-xs text-gray-400">Avg SOL</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-xl font-bold text-orange-400">4d</div>
                      <div className="text-xs text-gray-400">Left</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Early supporters get tokens at presale price before public launch</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Story Text */}
            <div className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💰</div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">Nova Opens Funding</h4>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        With community validation secured (82% YES), Nova opens an <span className="text-white font-semibold">optional funding round</span>.
                      </p>
                      <p className="text-gray-400 text-sm leading-relaxed mt-2">
                        Early believers from the prediction market get first access - like a presale, but only for validated projects.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-white font-semibold text-sm">Early Access Pricing</h5>
                        <p className="text-gray-400 text-xs">Backers get tokens at discounted rate</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-white font-semibold text-sm">Community Built</h5>
                        <p className="text-gray-400 text-xs">156 supporters before public launch</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-white font-semibold text-sm">Capital Secured</h5>
                        <p className="text-gray-400 text-xs">42.8 SOL to build the product</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>

        {/* Phase 3: Token Launch */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          variants={fadeInUp}
          className="max-w-6xl mx-auto space-y-6"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-bold shadow-lg shadow-purple-500/50">
              3
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Fair Launch</h2>
              <p className="text-purple-400 text-sm uppercase tracking-wider font-medium">Phase 3: Live on Pump.fun</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Story Text */}
            <div className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🚀</div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">QuantumComm Launches</h4>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        With validation and funding complete, <span className="text-white font-semibold">$QCOMM</span> launches on pump.fun with fair distribution.
                      </p>
                      <p className="text-gray-400 text-sm leading-relaxed mt-2">
                        156 early backers already hold tokens. Community formed ✓ Capital raised ✓ Mission validated ✓
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Token Address (CA)</span>
                      <code className="text-cyan-400 text-xs font-mono">7xKX...9dPs</code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Market Cap</span>
                      <span className="text-white font-semibold">$127K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">24h Volume</span>
                      <span className="text-green-400 font-semibold">$89K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Holders</span>
                      <span className="text-white font-semibold">312</span>
                    </div>
                  </div>

                  <Button asChild className="w-full bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 mt-4">
                    <a href="https://pump.fun" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Trade on Pump.fun
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Launch Success Card */}
            <div>
              <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl border-purple-400/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-xl">
                      ⚛️
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">$QCOMM</h3>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/20 text-green-300 border-green-400/30 text-xs">Launched</Badge>
                        <span className="text-xs text-gray-400">2 days ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="text-xs text-gray-400">Initial Pool</div>
                        <div className="text-white font-bold text-lg">42.8 SOL</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="text-xs text-gray-400">YES Voters</div>
                        <div className="text-green-400 font-bold text-lg">+340%</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="text-xs text-gray-400">Early Backers</div>
                        <div className="text-purple-400 font-bold text-lg">+180%</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="text-xs text-gray-400">Community</div>
                        <div className="text-white font-bold text-lg">312</div>
                      </div>
                    </div>

                    <div className="p-4 bg-green-500/5 rounded-lg border border-green-500/20">
                      <div className="flex items-center gap-2 text-green-400 text-sm font-semibold mb-2">
                        <CheckCircle className="w-4 h-4" />
                        Success Story
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        Nova's project went from idea to funded reality in 14 days. Early believers made 340% returns, and Nova has capital to build the product.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>

        {/* How Token Distribution Works */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.3 }}
          variants={scaleIn}
          className="max-w-5xl mx-auto"
        >
          <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-xl border-white/10">
            <CardContent className="p-6 md:p-8">
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <Shield className="w-12 h-12 mx-auto text-cyan-400 mb-3" />
                  <h3 className="text-2xl md:text-3xl font-bold text-white">How Token Distribution Works</h3>
                  <p className="text-base md:text-lg text-gray-300 leading-relaxed">
                    Fair distribution based on market outcome - everyone gets what they deserve
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-4">
                  {/* YES Wins Scenario */}
                  <div className="space-y-4 p-6 rounded-xl bg-green-500/5 border border-green-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-green-400">If YES Wins</h4>
                        <p className="text-xs text-gray-400">Project validated by community</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="text-green-400 font-bold mt-0.5">1.</div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">Token Launches on Pump.fun</h5>
                          <p className="text-gray-400 text-xs">Up to 55 SOL from pool used to launch token</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="text-green-400 font-bold mt-0.5">2.</div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">Token Distribution</h5>
                          <p className="text-gray-400 text-xs">65% to YES voters, 33% to team, 2% to PNL platform</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="text-green-400 font-bold mt-0.5">3.</div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">Platform Fee</h5>
                          <p className="text-gray-400 text-xs">5% of SOL pool goes to platform for sustainability</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="text-green-400 font-bold mt-0.5">4.</div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">Excess SOL (if pool exceeds 55)</h5>
                          <p className="text-gray-400 text-xs">Founder can claim excess SOL with vesting schedule</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-green-500/20">
                      <div className="text-xs text-gray-300">
                        <span className="text-green-400 font-semibold">Example:</span> Pool has 42.8 SOL. All 42.8 SOL used to launch $QCOMM on Pump.fun. Platform takes 2.14 SOL (5% fee). YES voters receive 65% of tokens, team gets 33%, PNL gets 2%.
                      </div>
                    </div>
                  </div>

                  {/* NO Wins Scenario */}
                  <div className="space-y-4 p-6 rounded-xl bg-red-500/5 border border-red-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                        <XCircle className="w-6 h-6 text-red-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-red-400">If NO Wins</h4>
                        <p className="text-xs text-gray-400">Community rejects the idea</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="text-red-400 font-bold mt-0.5">1.</div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">No Token Launch</h5>
                          <p className="text-gray-400 text-xs">Project doesn't proceed - community rejected the idea</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="text-red-400 font-bold mt-0.5">2.</div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">Platform Fee (5%)</h5>
                          <p className="text-gray-400 text-xs">Platform takes 5% of total pool</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="text-red-400 font-bold mt-0.5">3.</div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">NO Voters Get SOL</h5>
                          <p className="text-gray-400 text-xs">Receive SOL proportional to NO shares from remaining 95% pool</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="text-red-400 font-bold mt-0.5">4.</div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">YES Voters Lose</h5>
                          <p className="text-gray-400 text-xs">Their SOL goes to NO voters - incentive to back winners only</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-red-500/20">
                      <div className="text-xs text-gray-300">
                        <span className="text-red-400 font-semibold">Example:</span> Pool has 20 SOL. Community votes NO (project rejected). Platform takes 1 SOL (5% fee). NO voters split 19 SOL proportionally based on their shares. YES voters lose their stake.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center pt-4 space-y-4">
                  <p className="text-sm text-gray-400 max-w-2xl mx-auto">
                    This creates perfect incentive alignment: believers back good ideas, skeptics get rewarded for calling out bad ones. The market decides, not gatekeepers.
                  </p>

                  {/* Payout Calculation */}
                  <div className="pt-4 border-t border-white/10">
                    <h4 className="text-base font-semibold text-white mb-3">How Payouts Work</h4>
                    <div className="space-y-4 text-left max-w-3xl mx-auto">
                      <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <h5 className="text-sm font-semibold text-cyan-400 mb-2">Share Calculation (On-Chain Bonding Curve)</h5>
                        <p className="text-xs text-gray-300">
                          When you buy YES or NO votes, your shares are calculated using a bonding curve - early buyers get more shares per SOL, later buyers pay more. These shares are recorded on-chain.
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-green-500/5 rounded-lg border border-green-500/20">
                          <h5 className="text-sm font-semibold text-green-400 mb-2">If YES Wins</h5>
                          <p className="text-xs text-gray-300">
                            Your on-chain YES shares determine your portion of the 65% token allocation
                          </p>
                        </div>

                        <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                          <h5 className="text-sm font-semibold text-red-400 mb-2">If NO Wins</h5>
                          <p className="text-xs text-gray-300">
                            Your on-chain NO shares determine your portion of the 95% SOL pool
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Value Props - For Founders & Community */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          variants={fadeInUp}
          className="max-w-6xl mx-auto space-y-8"
        >
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Why P&L?
            </h2>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
              A fairer way to validate ideas and access early-stage opportunities
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* For Builders */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-xl border-purple-400/30">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <Rocket className="w-6 h-6 text-purple-400" />
                  </div>
                  <CardTitle className="text-2xl text-white">For Founders</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Validate Your Idea</h4>
                    <p className="text-gray-400 text-sm">Let the community decide if your project has potential before you build</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Build Community First</h4>
                    <p className="text-gray-400 text-sm">Gather believers and supporters before launch, not after</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Raise Capital Fairly</h4>
                    <p className="text-gray-400 text-sm">Optional funding phase lets early supporters participate like a presale</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* For Users */}
            <Card className="bg-gradient-to-br from-cyan-500/10 to-green-500/10 backdrop-blur-xl border-cyan-400/30">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-cyan-500/20 rounded-lg">
                    <Users className="w-6 h-6 text-cyan-400" />
                  </div>
                  <CardTitle className="text-2xl text-white">For Community</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Early Access</h4>
                    <p className="text-gray-400 text-sm">Discover and invest in ideas before VCs and institutional money</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Earn by Being Right</h4>
                    <p className="text-gray-400 text-sm">Vote YES on winners, or profit by calling out bad ideas with NO votes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Community Validated</h4>
                    <p className="text-gray-400 text-sm">Only projects that pass community validation get to launch</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.3 }}
          variants={scaleIn}
          className="text-center space-y-6 py-8 max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Your Turn
          </h2>
          <p className="text-lg text-gray-300">
            Be part of the community that discovers tomorrow's winners today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Button asChild size="lg" className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold text-base px-8 py-6 rounded-xl shadow-lg shadow-purple-500/25">
              <Link href="/browse">
                Start Voting
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-white/20 text-white hover:bg-white/10 font-semibold text-base px-8 py-6 rounded-xl">
              <Link href="/create">
                Submit Your Idea
              </Link>
            </Button>
          </div>
        </motion.div>

      </div>

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
