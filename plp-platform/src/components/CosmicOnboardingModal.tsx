'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Sparkles, Rocket, Zap, ArrowRight, UserCircle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ipfsUtils } from '@/lib/ipfs';

interface CosmicOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinUniverse: () => void;
  onContinueAsGuest: () => void;
  isSettingUpProfile?: boolean;
}

// Random cosmic names for greeting
const cosmicNames = [
  'Stardust Voyager',
  'Nebula Pioneer',
  'Cosmic Wanderer',
  'Stellar Explorer',
  'Galaxy Seeker',
  'Astral Traveler',
  'Quantum Dreamer',
  'Celestial Navigator',
  'Space Visionary',
  'Nova Chaser',
  'Pulsar Rider',
  'Comet Hunter',
  'Meteor Mage',
  'Solar Sage',
  'Lunar Legend',
];

// Random username prefixes and suffixes
const usernamePrefixes = [
  'Cosmic', 'Stellar', 'Nebula', 'Quantum', 'Astral', 'Galactic',
  'Void', 'Pulsar', 'Nova', 'Meteor', 'Solar', 'Lunar', 'Celestial',
  'Comet', 'Asteroid', 'Photon', 'Quasar', 'Supernova', 'Orbit',
  'Eclipse', 'Zenith', 'Aurora', 'Stardust', 'Plasma', 'Gravity'
];

const usernameSuffixes = [
  'Voyager', 'Pioneer', 'Explorer', 'Seeker', 'Wanderer', 'Traveler',
  'Navigator', 'Dreamer', 'Hunter', 'Rider', 'Mage', 'Sage', 'Legend',
  'Keeper', 'Guardian', 'Walker', 'Runner', 'Drifter', 'Chaser',
  'Observer', 'Watcher', 'Master', 'Knight', 'Phantom', 'Spirit'
];

// Template cosmic avatars
const cosmicAvatars = [
  { id: 'nebula', name: 'Nebula', path: '/cosmic-avatars/nebula.svg' },
  { id: 'galaxy', name: 'Galaxy', path: '/cosmic-avatars/galaxy.svg' },
  { id: 'supernova', name: 'Supernova', path: '/cosmic-avatars/supernova.svg' },
  { id: 'pulsar', name: 'Pulsar', path: '/cosmic-avatars/pulsar.svg' },
  { id: 'blackhole', name: 'Black Hole', path: '/cosmic-avatars/blackhole.svg' },
  { id: 'comet', name: 'Comet', path: '/cosmic-avatars/comet.svg' },
  { id: 'starcluster', name: 'Star Cluster', path: '/cosmic-avatars/starcluster.svg' },
  { id: 'moonphase', name: 'Moon Phase', path: '/cosmic-avatars/moonphase.svg' },
];

type OnboardingStep = 'greeting' | 'welcome' | 'choice' | 'profile';

export default function CosmicOnboardingModal({ isOpen, onClose, onJoinUniverse, onContinueAsGuest, isSettingUpProfile = false }: CosmicOnboardingModalProps) {
  const { login, user, authenticated } = usePrivy();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('choice');
  const [cosmicName, setCosmicName] = useState('');
  const [displayedName, setDisplayedName] = useState('');
  const [username, setUsername] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);

  // Generate random username
  const generateRandomUsername = async (): Promise<string> => {
    let attempts = 0;
    while (attempts < 10) {
      const prefix = usernamePrefixes[Math.floor(Math.random() * usernamePrefixes.length)];
      const suffix = usernameSuffixes[Math.floor(Math.random() * usernameSuffixes.length)];
      const randomNum = Math.floor(Math.random() * 999);
      const generatedUsername = `${prefix}${suffix}${randomNum}`;

      // Check if username is unique
      const isUnique = await checkUsernameUniqueness(generatedUsername);
      if (isUnique) {
        return generatedUsername;
      }
      attempts++;
    }

    // Fallback: add timestamp if all attempts fail
    const timestamp = Date.now().toString().slice(-6);
    return `CosmicUser${timestamp}`;
  };

  // Check username uniqueness via API
  const checkUsernameUniqueness = async (usernameToCheck: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/profile/check-username?username=${encodeURIComponent(usernameToCheck)}`);
      const data = await response.json();
      return data.available || false;
    } catch (error) {
      console.error('Error checking username:', error);
      return true; // Assume available on error
    }
  };

  // Generate random cosmic name when modal opens
  useEffect(() => {
    if (isOpen) {
      const randomName = cosmicNames[Math.floor(Math.random() * cosmicNames.length)];
      setCosmicName(randomName);
      setDisplayedName('');
      setStep('greeting');
      setUsername('');
      setProfilePicture(null);
      setProfilePreview('');
      setSelectedTemplate('');
    }
  }, [isOpen]);

  // Set the full name immediately for the animation
  useEffect(() => {
    if (step === 'greeting' && cosmicName) {
      setDisplayedName(cosmicName);
    }
  }, [step, cosmicName]);

  // Auto-advance from greeting to welcome
  useEffect(() => {
    if (step === 'greeting') {
      const timer = setTimeout(() => setStep('welcome'), 6200); // Increased to allow smooth completion and pause
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Auto-advance from welcome to choice
  useEffect(() => {
    if (step === 'welcome') {
      const timer = setTimeout(() => setStep('choice'), 4000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleGuestProceed = () => {
    onContinueAsGuest();
  };

  const handleJoinClick = () => {
    onJoinUniverse();
  };

  const handleRandomUsername = async () => {
    setIsCheckingUsername(true);
    const randomUsername = await generateRandomUsername();
    setUsername(randomUsername);
    setIsCheckingUsername(false);
  };

  const handleTemplateSelect = (templatePath: string) => {
    setSelectedTemplate(templatePath);
    setProfilePreview(templatePath);
    setProfilePicture(null); // Clear custom upload if template selected
  };

  // Save profile to backend after successful login
  const saveProfileToBackend = async (walletAddress: string) => {
    try {
      console.log('🚀 Starting profile save...', { walletAddress, username });
      setIsSavingProfile(true);

      let finalUsername = username.trim();
      let profilePhotoUrl = '';

      // Generate defaults if user didn't provide them
      if (!finalUsername) {
        console.log('📝 Generating random username...');
        finalUsername = await generateRandomUsername();
        console.log('✅ Generated username:', finalUsername);
      }

      // Use template avatar if selected
      if (selectedTemplate) {
        profilePhotoUrl = selectedTemplate;
        console.log('🎨 Using template avatar:', selectedTemplate);
      }
      // Upload custom profile picture to IPFS if provided
      else if (profilePicture) {
        console.log('📸 Uploading custom photo to IPFS...');
        const ipfsUri = await ipfsUtils.uploadImage(profilePicture);
        profilePhotoUrl = ipfsUtils.getGatewayUrl(ipfsUri);
        console.log('✅ Photo uploaded:', profilePhotoUrl);
      }
      // Generate random template if no picture selected
      else {
        const randomAvatar = cosmicAvatars[Math.floor(Math.random() * cosmicAvatars.length)];
        profilePhotoUrl = randomAvatar.path;
        console.log('🎲 Using random avatar:', randomAvatar.name);
      }

      console.log('💾 Saving to backend...', { finalUsername, profilePhotoUrl });

      // Save to backend using the same API as wallet page
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          username: finalUsername,
          profilePhotoUrl,
          email: user?.email,
        }),
      });

      const result = await response.json();
      console.log('📦 Backend response:', result);

      if (result.success) {
        console.log('✅ Profile saved successfully! Redirecting to /browse...');
        // Just redirect - keep modal/loading visible until new page loads
        router.push('/browse');
        // Don't call onClose() - let the page navigation handle cleanup
      } else {
        console.error('❌ Profile save failed:', result);
      }
    } catch (error) {
      console.error('💥 Error saving profile:', error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Auto-save logic has been moved to page.tsx to prevent duplicate profile creation

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Memoize the background so it doesn't re-render - creates cinematic effect
  const milkyWayBackground = useMemo(() => {
    // Generate static random values for dust lanes
    const dustLanes = Array.from({ length: 12 }, (_, i) => ({
      rotation: 20 + (i * 8),
      width: 200 + Math.random() * 400,
      height: 60 + Math.random() * 120,
      x: 30 + Math.random() * 40,
      y: 25 + Math.random() * 50,
      opacity: 0.3 + Math.random() * 0.4,
    }));

    // Generate static random values for nebula clouds
    const nebulaClouds = Array.from({ length: 20 }, () => ({
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      size: 100 + Math.random() * 250,
      color: ['rgba(150, 180, 255, 0.15)', 'rgba(180, 150, 255, 0.12)', 'rgba(120, 150, 230, 0.1)', 'rgba(200, 170, 255, 0.08)'][Math.floor(Math.random() * 4)],
    }));

    // Generate static random values for stars
    const stars = Array.from({ length: 8000 }, () => {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const bandCenterY = ((100 - x) * 0.6) + 20;
      const distanceFromBand = Math.abs(y - bandCenterY);

      const inSuperCoreBand = distanceFromBand < 8;
      const inCoreBand = distanceFromBand >= 8 && distanceFromBand < 18;
      const inDenseBand = distanceFromBand >= 18 && distanceFromBand < 28;
      const inModerateBand = distanceFromBand >= 28 && distanceFromBand < 38;
      const inSparseBand = distanceFromBand >= 38 && distanceFromBand < 48;

      let renderChance;
      if (inSuperCoreBand) renderChance = 1;
      else if (inCoreBand) renderChance = 0.98;
      else if (inDenseBand) renderChance = 0.85;
      else if (inModerateBand) renderChance = 0.5;
      else if (inSparseBand) renderChance = 0.2;
      else renderChance = 0.04;

      if (Math.random() > renderChance) return null;

      const rand = Math.random();
      const size = rand > 0.99 ? '3px' : rand > 0.96 ? '2px' : rand > 0.88 ? '1.5px' : rand > 0.70 ? '1px' : '0.8px';

      let colors;
      if (inSuperCoreBand || inCoreBand) {
        colors = ['#ffffff', '#fffef8', '#fff8f0', '#ffe8d0', '#ffd8c0', '#d0e0ff', '#e8f0ff', '#c8d8ff', '#b8c8ff', '#a0b8ff', '#ffd0e8', '#ffe0f0', '#f0d8ff', '#e8e8ff', '#f8f8ff', '#f0f8ff'];
      } else if (inDenseBand) {
        colors = ['#ffffff', '#fff8ff', '#e6f0ff', '#d8e8ff', '#c0d0ff', '#b0c8ff', '#ffeef8', '#f0e8ff'];
      } else if (inModerateBand) {
        colors = ['#ffffff', '#f0f5ff', '#e8f0ff', '#d8e8ff', '#c8d8ff'];
      } else {
        colors = ['#ffffff', '#f5f8ff', '#e8f0ff'];
      }

      const color = colors[Math.floor(Math.random() * colors.length)];
      const opacity = inSuperCoreBand ? 0.7 + Math.random() * 0.3 : inCoreBand ? 0.6 + Math.random() * 0.4 : inDenseBand ? 0.5 + Math.random() * 0.4 : inModerateBand ? 0.3 + Math.random() * 0.4 : 0.2 + Math.random() * 0.3;
      const shouldTwinkle = Math.random() > 0.7;

      return { x, y, size, color, opacity, shouldTwinkle };
    }).filter(Boolean);

    // Generate static random values for bright stars
    const brightStars = Array.from({ length: 120 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() > 0.5 ? '3px' : '2.5px',
      color: ['#ffffff', '#fff8f0', '#d0e0ff', '#ffd0e8', '#e8d8ff'][Math.floor(Math.random() * 5)],
      animationDuration: 1 + Math.random() * 2,
      animationDelay: Math.random() * 2,
    }));

    return { dustLanes, nebulaClouds, stars, brightStars };
  }, []); // Empty deps = only generate once

  // Determine if we should show full cosmic background (only during greeting)
  const showFullCosmicBackground = step === 'greeting';

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Background Layer - Full cosmic for greeting, transparent overlay for others */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 overflow-hidden"
            style={{
              background: showFullCosmicBackground
                ? 'linear-gradient(to bottom, #000308 0%, #00010a 50%, #000308 100%)'
                : 'rgba(0, 0, 0, 0.85)',
              backdropFilter: showFullCosmicBackground ? 'none' : 'blur(8px)',
              transition: 'background 0.8s ease-in-out, backdrop-filter 0.8s ease-in-out',
            }}
          >
            {/* Cosmic elements - only render during greeting for performance */}
            {showFullCosmicBackground && (
              <>
                {/* Main Milky Way Band - Blue/Purple Glow */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0"
                  style={{
                    background: `
                      radial-gradient(
                        ellipse 140% 60% at 50% 45%,
                        rgba(100, 120, 200, 0.25) 0%,
                        rgba(120, 100, 220, 0.2) 15%,
                        rgba(80, 100, 180, 0.15) 25%,
                        rgba(60, 80, 150, 0.1) 35%,
                        transparent 50%
                      )
                    `,
                    filter: 'blur(40px)',
                  }}
                />

                {/* Bright Galactic Core - Pink/Orange center */}
                <div
                  className="absolute"
                  style={{
                    top: '40%',
                    left: '55%',
                    transform: 'translate(-50%, -50%)',
                    width: '400px',
                    height: '300px',
                    background: 'radial-gradient(ellipse, rgba(255, 150, 200, 0.4) 0%, rgba(255, 180, 150, 0.3) 15%, rgba(200, 150, 255, 0.2) 30%, rgba(150, 120, 255, 0.1) 50%, transparent 70%)',
                    filter: 'blur(60px)',
                  }}
                />

                {/* Secondary core glow - more blue */}
                <div
                  className="absolute"
                  style={{
                    top: '45%',
                    left: '45%',
                    transform: 'translate(-50%, -50%)',
                    width: '500px',
                    height: '350px',
                    background: 'radial-gradient(ellipse, rgba(150, 180, 255, 0.2) 0%, rgba(120, 150, 255, 0.15) 30%, transparent 60%)',
                    filter: 'blur(70px)',
                  }}
                />

                {/* Dark dust lanes */}
                {milkyWayBackground.dustLanes.map((lane, i) => (
                  <div
                    key={`dust-lane-${i}`}
                    className="absolute"
                    style={{
                      background: 'radial-gradient(ellipse, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 10, 0.6) 30%, transparent 70%)',
                      width: `${lane.width}px`,
                      height: `${lane.height}px`,
                      left: `${lane.x}%`,
                      top: `${lane.y}%`,
                      transform: `rotate(${lane.rotation}deg)`,
                      filter: 'blur(30px)',
                      opacity: lane.opacity,
                    }}
                  />
                ))}

                {/* Bright nebula clouds - purple/blue */}
                {milkyWayBackground.nebulaClouds.map((cloud, i) => (
                  <div
                    key={`nebula-${i}`}
                    className="absolute rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${cloud.color} 0%, transparent 70%)`,
                      width: `${cloud.size}px`,
                      height: `${cloud.size}px`,
                      left: `${cloud.x}%`,
                      top: `${cloud.y}%`,
                      transform: 'translate(-50%, -50%)',
                      filter: 'blur(50px)',
                    }}
                  />
                ))}

                {/* Dense star field forming Milky Way band */}
                {milkyWayBackground.stars.map((star: any, i) => (
                  <div
                    key={`star-${i}`}
                    className={`absolute rounded-full ${star.shouldTwinkle ? 'animate-pulse' : ''}`}
                    style={{
                      width: star.size,
                      height: star.size,
                      background: star.color,
                      boxShadow: star.size === '3px'
                        ? `0 0 6px ${star.color}, 0 0 10px ${star.color}`
                        : star.size === '2px'
                          ? `0 0 4px ${star.color}`
                          : star.size === '1.5px'
                            ? `0 0 2px ${star.color}`
                            : `0 0 1px ${star.color}`,
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      opacity: star.opacity,
                      animationDuration: star.shouldTwinkle ? `${1 + Math.random() * 3}s` : undefined,
                      animationDelay: star.shouldTwinkle ? `${Math.random() * 2}s` : undefined,
                    }}
                  />
                ))}

                {/* Extra bright prominent twinkling stars */}
                {milkyWayBackground.brightStars.map((star, i) => (
                  <div
                    key={`bright-star-${i}`}
                    className="absolute rounded-full animate-pulse"
                    style={{
                      width: star.size,
                      height: star.size,
                      background: star.color,
                      boxShadow: `0 0 10px ${star.color}, 0 0 20px ${star.color}, 0 0 30px rgba(255, 255, 255, 0.3)`,
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      opacity: 0.9,
                      animationDuration: `${star.animationDuration}s`,
                      animationDelay: `${star.animationDelay}s`,
                    }}
                  />
                ))}
              </>
            )}
          </motion.div>

          {/* Full-Screen Loading Overlay for Auth/Save */}
          {(isWaitingForAuth || isSavingProfile || isSettingUpProfile) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-lg flex items-center justify-center"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="mx-auto mb-6"
                >
                  <Sparkles className="w-16 h-16 text-cyan-300" />
                </motion.div>
                <p className="text-white text-2xl font-medium mb-3">
                  {isWaitingForAuth || isSettingUpProfile ? 'Waiting for authentication...' : 'Setting up your cosmic profile...'}
                </p>
                <p className="text-gray-400 text-base">
                  {isWaitingForAuth || isSettingUpProfile ? 'Complete login in the Privy window' : 'Uploading to the stars'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Content Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
              {/* Step 1: Greeting */}
              {step === 'greeting' && (
                <motion.div
                  key="greeting"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center"
                >
                  <div className="text-6xl md:text-8xl font-bold overflow-hidden flex items-center justify-center gap-3">
                    <motion.span
                      className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent inline-block"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    >
                      Hi,
                    </motion.span>
                    <motion.span
                      className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent inline-block whitespace-nowrap"
                      style={{
                        overflow: 'hidden',
                        display: 'inline-block',
                      }}
                      initial={{ maxWidth: 0, opacity: 0 }}
                      animate={{ maxWidth: '100%', opacity: 1 }}
                      transition={{
                        maxWidth: { duration: 3.5, delay: 1.4, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.5, delay: 1.4, ease: 'easeOut' }
                      }}
                    >
                      <span className="inline-block">{displayedName}</span>
                    </motion.span>
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 5.2, duration: 0.6, ease: 'easeOut' }}
                    className="mt-4"
                  >
                    <Sparkles className="w-12 h-12 mx-auto text-yellow-300 animate-pulse" />
                  </motion.div>
                </motion.div>
              )}

              {/* Step 2: Welcome Message */}
              {step === 'welcome' && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center max-w-2xl px-6"
                >
                  <motion.p
                    className="text-2xl md:text-3xl text-white leading-relaxed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Welcome to the <span className="text-cyan-300 font-semibold">vastness of the universe</span> where you'll witness{' '}
                    <span className="text-purple-300 font-semibold">clashes of ideas</span>,{' '}
                    <span className="text-pink-300 font-semibold">new kinds of innovation</span>, and the birth of tomorrow's breakthroughs.
                  </motion.p>
                </motion.div>
              )}

              {/* Step 3: Choice */}
              {step === 'choice' && (
                <motion.div
                  key="choice"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5 }}
                  className="w-full max-w-md"
                >
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center mb-8"
                  >
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                      How would you like to proceed?
                    </h2>
                    <p className="text-gray-400">Choose your path through the cosmos</p>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-4"
                  >
                    {/* Join Button */}
                    <button
                      onClick={handleJoinClick}
                      className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 rounded-2xl px-8 py-6 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Rocket className="w-8 h-8 text-white" />
                          <div className="text-left">
                            <div className="text-xl font-bold text-white">Join the Universe</div>
                            <div className="text-sm text-white/80">Create account & unlock full power</div>
                          </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-white group-hover:translate-x-2 transition-transform" />
                      </div>
                    </button>

                    {/* Guest Button */}
                    <button
                      onClick={handleGuestProceed}
                      className="w-full group relative overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl px-8 py-6 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <UserCircle className="w-8 h-8 text-gray-400 group-hover:text-white transition-colors" />
                          <div className="text-left">
                            <div className="text-xl font-bold text-white">Continue as Guest</div>
                            <div className="text-sm text-gray-400">Explore without commitment</div>
                          </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-white group-hover:translate-x-2 transition-all" />
                      </div>
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {/* Step 4: Profile Setup */}
              {step === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="relative w-full max-w-md"
                >
                  <div className="bg-transparent backdrop-blur-sm p-8">
                    <motion.div
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-center mb-8"
                    >
                      <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                        Create Your Identity
                      </h2>
                      <p className="text-gray-400">Set up your cosmic profile</p>
                    </motion.div>

                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Profile Picture Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-3 text-center">
                          Choose Your Avatar
                        </label>

                        {/* Template Avatars Grid */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                          {cosmicAvatars.map((avatar) => (
                            <button
                              key={avatar.id}
                              onClick={() => handleTemplateSelect(avatar.path)}
                              className={`relative rounded-xl overflow-hidden transition-all ${
                                selectedTemplate === avatar.path
                                  ? 'ring-2 ring-cyan-400 scale-105'
                                  : 'ring-1 ring-white/10 hover:ring-white/30 hover:scale-105'
                              }`}
                            >
                              <img src={avatar.path} alt={avatar.name} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>

                        {/* Custom Upload Option */}
                        <div className="text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePictureChange}
                            className="hidden"
                            id="profile-upload"
                          />
                          <label
                            htmlFor="profile-upload"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-sm text-gray-400 hover:text-white cursor-pointer transition-all"
                          >
                            <UserCircle className="w-4 h-4" />
                            Or upload custom photo
                          </label>
                        </div>

                        {/* Selected Preview */}
                        {profilePreview && (
                          <div className="flex justify-center mt-4">
                            <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-cyan-400">
                              <img src={profilePreview} alt="Selected" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Username Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Choose Username <span className="text-gray-600 text-xs">(optional)</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter cosmic name or leave empty"
                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                          />
                          <button
                            onClick={handleRandomUsername}
                            disabled={isCheckingUsername}
                            className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white transition-all disabled:opacity-50"
                            title="Generate random username"
                          >
                            {isCheckingUsername ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              >
                                <Sparkles className="w-5 h-5" />
                              </motion.div>
                            ) : (
                              <Sparkles className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-2">
                          {username ? 'Perfect! ' : 'No worries! '}
                          {username ? 'You can change this later.' : "We'll generate one for you."}
                        </p>
                      </div>

                      {/* Connect to Join Button */}
                      <button
                        onClick={() => {
                          setIsWaitingForAuth(true);
                          login();
                        }}
                        disabled={isWaitingForAuth}
                        className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:from-gray-600 disabled:to-gray-600 rounded-xl px-6 py-4 transition-all duration-300"
                      >
                        <div className="relative flex items-center justify-center gap-2">
                          {isWaitingForAuth ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              >
                                <Sparkles className="w-5 h-5 text-white" />
                              </motion.div>
                              <span className="font-semibold text-white">Connecting...</span>
                            </>
                          ) : (
                            <>
                              <Rocket className="w-5 h-5 text-white" />
                              <span className="font-semibold text-white">Connect to Join</span>
                              <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-2 transition-transform" />
                            </>
                          )}
                        </div>
                      </button>

                      {!isWaitingForAuth && (
                        <p className="text-xs text-center text-gray-500">
                          Email, Google, Twitter, or Solana Wallet
                        </p>
                      )}

                      {/* Back Link */}
                      <button
                        onClick={() => setStep('choice')}
                        className="w-full text-sm text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        ← Back to options
                      </button>
                    </motion.div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
