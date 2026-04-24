'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ipfsUtils } from '@/lib/ipfs';
import { useHeadlessAuth, getErrorMessage } from '@/hooks/useHeadlessAuth';
import { useDirectWallet } from '@/contexts/DirectWalletContext';
import {
  AuthMethodSelection,
  EmailInput,
  OTPInput,
  WalletSelection,
  OAuthPending,
  CosmicLoader,
} from '@/components/auth';

interface CosmicOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinUniverse?: () => void;
  onContinueAsGuest?: () => void;
  isSettingUpProfile?: boolean;
  skipGreeting?: boolean;
}

// Kept only for username auto-generation (not shown in greeting anymore)
const usernamePrefixes = [
  'Cosmic', 'Stellar', 'Nebula', 'Quantum', 'Astral', 'Galactic',
  'Void', 'Pulsar', 'Nova', 'Meteor', 'Solar', 'Lunar', 'Celestial',
  'Comet', 'Asteroid', 'Photon', 'Quasar', 'Supernova', 'Orbit',
  'Eclipse', 'Zenith', 'Aurora', 'Stardust', 'Plasma', 'Gravity',
];
const usernameSuffixes = [
  'Voyager', 'Pioneer', 'Explorer', 'Seeker', 'Wanderer', 'Traveler',
  'Navigator', 'Dreamer', 'Hunter', 'Rider', 'Mage', 'Sage', 'Legend',
  'Keeper', 'Guardian', 'Walker', 'Runner', 'Drifter', 'Chaser',
];

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

type OnboardingStep = 'greeting' | 'welcome' | 'choice' | 'auth-selection' | 'profile';

// Shared easing
const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

// Reusable arrow SVG matching landing style
const ArrowRightSvg = ({ className = '' }: { className?: string }) => (
  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" className={className}>
    <path d="M1 5H19M19 5L14 1M19 5L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
  </svg>
);

export function CosmicOnboardingModal({
  isOpen,
  onClose,
  onJoinUniverse,
  onContinueAsGuest,
  isSettingUpProfile = false,
  skipGreeting = false,
}: CosmicOnboardingModalProps) {
  const { user } = usePrivy();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(skipGreeting ? 'auth-selection' : 'choice');
  const [username, setUsername] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const hasRedirectedRef = useRef(false);

  const {
    state: authState,
    selectEmail,
    selectWallet,
    handleSendCode,
    handleVerifyCode,
    handleOAuth,
    handleConnectWallet,
    goBack: authGoBack,
    reset: resetAuth,
    solanaWallets,
  } = useHeadlessAuth();

  const generateRandomUsername = async (): Promise<string> => {
    let attempts = 0;
    while (attempts < 10) {
      const prefix = usernamePrefixes[Math.floor(Math.random() * usernamePrefixes.length)];
      const suffix = usernameSuffixes[Math.floor(Math.random() * usernameSuffixes.length)];
      const randomNum = Math.floor(Math.random() * 999);
      const generatedUsername = `${prefix}${suffix}${randomNum}`;
      const isUnique = await checkUsernameUniqueness(generatedUsername);
      if (isUnique) return generatedUsername;
      attempts++;
    }
    return `CosmicUser${Date.now().toString().slice(-6)}`;
  };

  const checkUsernameUniqueness = async (usernameToCheck: string): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/profile/check-username?username=${encodeURIComponent(usernameToCheck)}`);
      const data = await response.json();
      return data.available || false;
    } catch (error) {
      console.error('Error checking username:', error);
      return true;
    }
  };

  useEffect(() => {
    const handleAuthSuccess = async () => {
      if (!isOpen || authState.status !== 'success' || hasRedirectedRef.current) return;
      const walletAddress = user?.wallet?.address;
      if (walletAddress) {
        try {
          const response = await authFetch(`/api/profile/${walletAddress}`);
          const result = await response.json();
          if (result.success && result.data?.username) {
            hasRedirectedRef.current = true;
            onClose();
            router.push('/wallet');
            return;
          }
        } catch (error) {
          console.error('Error checking profile:', error);
        }
      }
      setStep('profile');
    };
    handleAuthSuccess();
  }, [isOpen, authState.status, user?.wallet?.address, onClose, router]);

  useEffect(() => {
    if (isOpen) {
      setStep(skipGreeting ? 'auth-selection' : 'greeting');
      setUsername('');
      setProfilePicture(null);
      setProfilePreview('');
      setSelectedTemplate('');
      resetAuth();
      hasRedirectedRef.current = false;
    }
  }, [isOpen, resetAuth, skipGreeting]);

  // Auto-advance from greeting → welcome (1.3s) → choice (1.5s)
  useEffect(() => {
    if (step === 'greeting') {
      const timer = setTimeout(() => setStep('welcome'), 1300);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'welcome') {
      const timer = setTimeout(() => setStep('choice'), 1500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleGuestProceed = () => { onContinueAsGuest?.(); };
  const handleJoinClick = () => setStep('auth-selection');
  const handleSkipToChoice = () => {
    if (step === 'greeting' || step === 'welcome') setStep('choice');
  };
  const handleAuthBack = () => {
    if (authState.status === 'idle') setStep('choice');
    else authGoBack();
  };
  const handleResendCode = async () => {
    if (authState.email) {
      setIsResendingCode(true);
      await handleSendCode(authState.email);
      setIsResendingCode(false);
    }
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
    setProfilePicture(null);
  };
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveProfileToBackend = async (walletAddress: string) => {
    try {
      setIsSavingProfile(true);
      let finalUsername = username.trim();
      let profilePhotoUrl = '';
      if (!finalUsername) finalUsername = await generateRandomUsername();
      if (selectedTemplate) {
        profilePhotoUrl = selectedTemplate;
      } else if (profilePicture) {
        const ipfsUri = await ipfsUtils.uploadImage(profilePicture);
        profilePhotoUrl = ipfsUtils.getGatewayUrl(ipfsUri);
      } else {
        const randomAvatar = cosmicAvatars[Math.floor(Math.random() * cosmicAvatars.length)];
        profilePhotoUrl = randomAvatar.path;
      }
      const response = await authFetch('/api/profile/update', {
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
      if (result.success) {
        onClose();
        router.push('/wallet');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Cosmic backdrop — same atmospheric dark as landing, with soft amber halo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="fixed inset-0 z-50 overflow-hidden"
            style={{
              background: 'rgba(10,8,20,0.94)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {/* Radial warm glow, centered — matches landing's sun character */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 50% 55%, rgba(232,150,96,0.16) 0%, rgba(214,115,71,0.06) 28%, transparent 60%)',
              }}
            />
            {/* Faint static star grid for cosmic depth */}
            <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.35]" style={{
              backgroundImage:
                'radial-gradient(1px 1px at 18% 22%, #fff5e1, transparent),' +
                'radial-gradient(1px 1px at 62% 12%, #ffd7a8, transparent),' +
                'radial-gradient(1.5px 1.5px at 85% 30%, #fff5e1, transparent),' +
                'radial-gradient(1px 1px at 8% 78%, #ffa366, transparent),' +
                'radial-gradient(1px 1px at 38% 88%, #fff5e1, transparent),' +
                'radial-gradient(1.5px 1.5px at 72% 72%, #ffd7a8, transparent),' +
                'radial-gradient(1px 1px at 48% 45%, #fff5e1, transparent),' +
                'radial-gradient(1px 1px at 92% 82%, #ffd7a8, transparent)',
              backgroundSize: '100% 100%',
            }} />
          </motion.div>

          {/* Saving overlay */}
          {(isSavingProfile || isSettingUpProfile) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center px-4"
              style={{ background: 'rgba(10,8,20,0.96)', backdropFilter: 'blur(12px)' }}
            >
              <CosmicLoader
                message={isSettingUpProfile ? 'Preparing your account' : 'Saving your profile'}
                size="lg"
              />
            </motion.div>
          )}

          {/* Content container */}
          <div
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 ${
              step === 'greeting' || step === 'welcome' ? 'cursor-pointer' : ''
            }`}
            onClick={step === 'greeting' || step === 'welcome' ? handleSkipToChoice : undefined}
          >
            <AnimatePresence mode="wait">
              {/* ─── Greeting ─── */}
              {step === 'greeting' && (
                <motion.div
                  key="greeting"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                  className="text-center px-4 w-full max-w-3xl"
                >
                  <div className="mono text-[0.64rem] uppercase tracking-[0.32em] mb-5" style={{ color: '#e89660' }}>
                    · Welcome ·
                  </div>
                  <h2
                    className="serif leading-[0.95] tracking-[-0.025em]"
                    style={{
                      color: '#f4eee4',
                      fontSize: 'clamp(2rem, 6vw, 4.5rem)',
                      fontWeight: 400,
                      fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 144",
                    }}
                  >
                    Hello,{' '}
                    <em
                      style={{
                        fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 144",
                        color: 'transparent',
                        backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ecb48a 35%, #d99875 70%, #d67347 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                      }}
                    >
                      stranger.
                    </em>
                  </h2>
                </motion.div>
              )}

              {/* ─── Welcome line ─── */}
              {step === 'welcome' && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                  className="text-center max-w-[46ch] px-4 sm:px-6"
                >
                  <p
                    className="serif italic leading-[1.35] tracking-[-0.015em]"
                    style={{
                      color: '#f4eee4',
                      fontSize: 'clamp(1.4rem, 3.5vw, 2.25rem)',
                      fontWeight: 400,
                      fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 48",
                    }}
                  >
                    A place for ideas to come from.
                  </p>
                </motion.div>
              )}

              {/* ─── Choice ─── */}
              {step === 'choice' && (
                <motion.div
                  key="choice"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5, ease: EASE_OUT }}
                  className="w-full max-w-md px-4 sm:px-0"
                >
                  <div className="mono text-[0.62rem] uppercase tracking-[0.3em] mb-5 flex items-center gap-3"
                    style={{ color: '#e89660' }}>
                    <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
                    <span>Before we plant your idea</span>
                  </div>
                  <h2
                    className="serif leading-[1.05] tracking-[-0.02em] mb-8"
                    style={{
                      color: '#f4eee4',
                      fontSize: 'clamp(1.85rem, 4.5vw, 2.8rem)',
                      fontWeight: 400,
                      fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 72",
                    }}
                  >
                    Sign in to pitch — or look around first.
                  </h2>

                  <div className="flex flex-col gap-3">
                    {/* Primary — Sign in to pitch */}
                    <button
                      onClick={handleJoinClick}
                      className="group relative inline-flex items-center justify-between gap-3 px-6 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] font-semibold transition-colors duration-300 w-full"
                      style={{ background: '#e89660', color: '#0a0814' }}
                    >
                      <span className="flex items-center gap-3">
                        <span>Sign in to pitch</span>
                      </span>
                      <ArrowRightSvg className="transition-transform duration-300 group-hover:translate-x-1.5" />
                      <span className="absolute -right-0 -top-0 w-2 h-2" style={{ background: '#0a0814' }} />
                    </button>

                    {/* Secondary — Just looking */}
                    <button
                      onClick={handleGuestProceed}
                      className="group inline-flex items-center justify-between gap-3 px-6 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] transition-colors duration-300 w-full border"
                      style={{ color: '#d8cfc0', borderColor: 'rgba(244,238,228,0.15)' }}
                    >
                      <span className="relative inline-block after:absolute after:left-0 after:bottom-[-4px] after:h-px after:w-full after:bg-current after:scale-x-0 after:origin-left group-hover:after:scale-x-100 after:transition-transform after:duration-500">
                        Just looking for now
                      </span>
                      <span className="text-[#8a7f72] group-hover:text-[#e89660] transition-colors">↗</span>
                    </button>
                  </div>

                  <p className="mt-6 mono text-[0.58rem] uppercase tracking-[0.28em] text-center" style={{ color: '#8a7f72' }}>
                    No pitch deck required · you can leave anytime
                  </p>
                </motion.div>
              )}

              {/* ─── Auth selection (delegated) ─── */}
              {step === 'auth-selection' && (
                <motion.div
                  key="auth-selection"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="w-full flex items-center justify-center"
                >
                  {authState.status === 'idle' && (
                    <AuthMethodSelection
                      onSelectEmail={selectEmail}
                      onSelectOAuth={handleOAuth}
                      onSelectWallet={selectWallet}
                      onBack={skipGreeting ? onClose : handleAuthBack}
                      showCloseButton={skipGreeting}
                    />
                  )}

                  {authState.status === 'email-input' && (
                    <EmailInput
                      onSubmit={handleSendCode}
                      onBack={authGoBack}
                      isLoading={false}
                      error={authState.error ? getErrorMessage(authState.error) : null}
                    />
                  )}

                  {authState.status === 'email-sending' && (
                    <div className="w-full max-w-md px-4">
                      <CosmicLoader message="Sending verification code" />
                    </div>
                  )}

                  {(authState.status === 'otp-input' || authState.status === 'otp-verifying') && (
                    <OTPInput
                      email={authState.email || ''}
                      onSubmit={handleVerifyCode}
                      onResend={handleResendCode}
                      onBack={authGoBack}
                      isLoading={authState.status === 'otp-verifying'}
                      isResending={isResendingCode}
                      error={authState.error ? getErrorMessage(authState.error) : null}
                    />
                  )}

                  {authState.status === 'oauth-pending' && authState.provider && (
                    <OAuthPending
                      provider={authState.provider}
                      onCancel={() => resetAuth()}
                      onRetry={() => { if (authState.provider) handleOAuth(authState.provider); }}
                      error={authState.error ? getErrorMessage(authState.error) : null}
                    />
                  )}

                  {(authState.status === 'wallet-selecting' || authState.status === 'wallet-connecting') && (
                    <WalletSelection
                      onSelectWallet={handleConnectWallet}
                      onBack={authGoBack}
                      isConnecting={authState.status === 'wallet-connecting'}
                      connectingWallet={authState.walletType}
                      error={authState.error ? getErrorMessage(authState.error) : null}
                      detectedWallets={solanaWallets.map((w: any) => w.name)}
                    />
                  )}
                </motion.div>
              )}

              {/* ─── Profile setup ─── */}
              {step === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.55, ease: EASE_OUT }}
                  className="relative w-full max-w-md px-4 sm:px-0 max-h-[90vh] overflow-y-auto"
                >
                  <div className="p-4 sm:p-6">
                    <div className="mono text-[0.62rem] uppercase tracking-[0.3em] mb-4 flex items-center gap-3"
                      style={{ color: '#e89660' }}>
                      <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
                      <span>Almost there</span>
                    </div>
                    <h2
                      className="serif leading-[1.05] tracking-[-0.02em] mb-6"
                      style={{
                        color: '#f4eee4',
                        fontSize: 'clamp(1.7rem, 4vw, 2.4rem)',
                        fontWeight: 400,
                        fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 72",
                      }}
                    >
                      One last thing.
                    </h2>
                    <p className="serif text-[0.95rem] md:text-[1rem] leading-[1.6] mb-8"
                      style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                      Pick an avatar and a name. You can change both later.
                    </p>

                    <div className="space-y-6">
                      {/* Avatar section */}
                      <div>
                        <label className="mono text-[0.58rem] uppercase tracking-[0.28em] mb-3 block"
                          style={{ color: '#8a7f72' }}>
                          Avatar
                        </label>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {cosmicAvatars.map((avatar) => {
                            const isSelected = selectedTemplate === avatar.path;
                            return (
                              <button
                                key={avatar.id}
                                onClick={() => handleTemplateSelect(avatar.path)}
                                className="relative aspect-square overflow-hidden transition-all duration-300"
                                style={{
                                  border: isSelected ? '1px solid #e89660' : '1px solid rgba(244,238,228,0.08)',
                                  background: 'rgba(244,238,228,0.02)',
                                  outline: isSelected ? '2px solid rgba(232,150,96,0.4)' : 'none',
                                  outlineOffset: '2px',
                                }}
                              >
                                <img src={avatar.path} alt={avatar.name} className="w-full h-full object-cover" />
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePictureChange}
                            className="hidden"
                            id="profile-upload"
                          />
                          <label
                            htmlFor="profile-upload"
                            className="mono text-[0.6rem] uppercase tracking-[0.26em] cursor-pointer hover:text-[#f4eee4] transition-colors"
                            style={{ color: '#8a7f72' }}
                          >
                            ↗ Upload custom photo
                          </label>
                          {profilePreview && (
                            <div className="w-12 h-12 overflow-hidden" style={{ border: '1px solid rgba(232,150,96,0.4)' }}>
                              <img src={profilePreview} alt="Selected" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Username section */}
                      <div>
                        <label className="mono text-[0.58rem] uppercase tracking-[0.28em] mb-3 flex items-center justify-between"
                          style={{ color: '#8a7f72' }}>
                          <span>Name</span>
                          <span style={{ color: '#6a6058' }}>optional</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Or leave empty — we'll pick one"
                            className="flex-1 px-4 py-3 mono text-[0.8rem] transition-all"
                            style={{
                              background: 'rgba(244,238,228,0.04)',
                              border: '1px solid rgba(244,238,228,0.1)',
                              color: '#f4eee4',
                              letterSpacing: '0.05em',
                            }}
                          />
                          <button
                            onClick={handleRandomUsername}
                            disabled={isCheckingUsername}
                            className="px-4 py-3 mono text-[0.62rem] uppercase tracking-[0.24em] transition-all disabled:opacity-40"
                            style={{
                              background: 'rgba(244,238,228,0.04)',
                              border: '1px solid rgba(244,238,228,0.1)',
                              color: '#e89660',
                            }}
                            title="Generate random name"
                          >
                            {isCheckingUsername ? '···' : 'Random'}
                          </button>
                        </div>
                      </div>

                      {/* Submit */}
                      <button
                        onClick={() => {
                          if (user?.wallet?.address) {
                            hasRedirectedRef.current = true;
                            saveProfileToBackend(user.wallet.address);
                          }
                        }}
                        disabled={isSavingProfile}
                        className="group relative inline-flex items-center justify-between gap-3 px-6 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] font-semibold transition-colors duration-300 w-full mt-2 disabled:opacity-50"
                        style={{ background: '#e89660', color: '#0a0814' }}
                      >
                        <span>{isSavingProfile ? 'Planting seed…' : "Let's begin"}</span>
                        <ArrowRightSvg className="transition-transform duration-300 group-hover:translate-x-1.5" />
                        <span className="absolute -right-0 -top-0 w-2 h-2" style={{ background: '#0a0814' }} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Skip hint */}
            {(step === 'greeting' || step === 'welcome') && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.45 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="absolute bottom-8 mono text-[0.58rem] uppercase tracking-[0.32em]"
                style={{ color: '#8a7f72' }}
              >
                Tap anywhere to continue
              </motion.p>
            )}
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CosmicOnboardingModal;
