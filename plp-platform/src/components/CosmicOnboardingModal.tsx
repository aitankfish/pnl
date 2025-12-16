'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Rocket, ArrowRight, UserCircle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
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

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Background Layer - Consistent dark overlay for all steps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 overflow-hidden"
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
            }}
          />

          {/* Full-Screen Loading Overlay for Auth/Save */}
          {(isWaitingForAuth || isSavingProfile || isSettingUpProfile) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-lg flex items-center justify-center px-4"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="mx-auto mb-4 sm:mb-6"
                >
                  <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-300" />
                </motion.div>
                <p className="text-white text-lg sm:text-2xl font-medium mb-2 sm:mb-3">
                  {isWaitingForAuth || isSettingUpProfile ? 'Waiting for authentication...' : 'Setting up your cosmic profile...'}
                </p>
                <p className="text-gray-400 text-sm sm:text-base">
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
                  className="text-center px-4 w-full max-w-4xl"
                >
                  <div className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold overflow-hidden flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                    <motion.span
                      className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent inline-block"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    >
                      Hi,
                    </motion.span>
                    <motion.span
                      className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent inline-block"
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
                      <span className="inline-block whitespace-nowrap">{displayedName}</span>
                    </motion.span>
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 5.2, duration: 0.6, ease: 'easeOut' }}
                    className="mt-4"
                  >
                    <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-yellow-300 animate-pulse" />
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
                  className="text-center max-w-2xl px-4 sm:px-6"
                >
                  <motion.p
                    className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-white leading-relaxed"
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
                  className="w-full max-w-md px-4 sm:px-0"
                >
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center mb-6 sm:mb-8"
                  >
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">
                      How would you like to proceed?
                    </h2>
                    <p className="text-sm sm:text-base text-gray-400">Choose your path through the cosmos</p>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3 sm:space-y-4"
                  >
                    {/* Join Button */}
                    <button
                      onClick={handleJoinClick}
                      className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 rounded-xl sm:rounded-2xl px-4 sm:px-8 py-4 sm:py-6 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <Rocket className="w-6 h-6 sm:w-8 sm:h-8 text-white flex-shrink-0" />
                          <div className="text-left">
                            <div className="text-base sm:text-xl font-bold text-white">Join the Universe</div>
                            <div className="text-xs sm:text-sm text-white/80">Create account & unlock full power</div>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:translate-x-2 transition-transform flex-shrink-0" />
                      </div>
                    </button>

                    {/* Guest Button */}
                    <button
                      onClick={handleGuestProceed}
                      className="w-full group relative overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-8 py-4 sm:py-6 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <UserCircle className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
                          <div className="text-left">
                            <div className="text-base sm:text-xl font-bold text-white">Continue as Guest</div>
                            <div className="text-xs sm:text-sm text-gray-400">Explore without commitment</div>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-white group-hover:translate-x-2 transition-all flex-shrink-0" />
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
                  className="relative w-full max-w-md px-4 sm:px-0 max-h-[90vh] overflow-y-auto"
                >
                  <div className="bg-transparent backdrop-blur-sm p-4 sm:p-8">
                    <motion.div
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-center mb-6 sm:mb-8"
                    >
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">
                        Create Your Identity
                      </h2>
                      <p className="text-sm sm:text-base text-gray-400">Set up your cosmic profile</p>
                    </motion.div>

                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-4 sm:space-y-6"
                    >
                      {/* Profile Picture Selection */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-2 sm:mb-3 text-center">
                          Choose Your Avatar
                        </label>

                        {/* Template Avatars Grid */}
                        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
                          {cosmicAvatars.map((avatar) => (
                            <button
                              key={avatar.id}
                              onClick={() => handleTemplateSelect(avatar.path)}
                              className={`relative aspect-square rounded-lg sm:rounded-xl overflow-hidden transition-all ${
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
                            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-xs sm:text-sm text-gray-400 hover:text-white cursor-pointer transition-all"
                          >
                            <UserCircle className="w-4 h-4" />
                            Or upload custom photo
                          </label>
                        </div>

                        {/* Selected Preview */}
                        {profilePreview && (
                          <div className="flex justify-center mt-3 sm:mt-4">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-cyan-400">
                              <img src={profilePreview} alt="Selected" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Username Input */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-2">
                          Choose Username <span className="text-gray-600 text-xs">(optional)</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter cosmic name or leave empty"
                            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                          />
                          <button
                            onClick={handleRandomUsername}
                            disabled={isCheckingUsername}
                            className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg sm:rounded-xl text-white transition-all disabled:opacity-50"
                            title="Generate random username"
                          >
                            {isCheckingUsername ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              >
                                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                              </motion.div>
                            ) : (
                              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
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
                        className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:from-gray-600 disabled:to-gray-600 rounded-lg sm:rounded-xl px-4 sm:px-6 py-3 sm:py-4 transition-all duration-300"
                      >
                        <div className="relative flex items-center justify-center gap-2">
                          {isWaitingForAuth ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              >
                                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                              </motion.div>
                              <span className="text-sm sm:text-base font-semibold text-white">Connecting...</span>
                            </>
                          ) : (
                            <>
                              <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                              <span className="text-sm sm:text-base font-semibold text-white">Connect to Join</span>
                              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:translate-x-2 transition-transform" />
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
                        className="w-full text-xs sm:text-sm text-gray-400 hover:text-gray-300 transition-colors"
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
