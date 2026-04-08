'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import CosmicOnboardingModal from '@/components/CosmicOnboardingModal';

interface AuthModalContextType {
  showAuthModal: () => void;
  hideAuthModal: () => void;
  isAuthModalOpen: boolean;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Only render modal after client-side mount to avoid hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showAuthModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const hideAuthModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AuthModalContext.Provider value={{ showAuthModal, hideAuthModal, isAuthModalOpen: isOpen }}>
      {children}
      {isMounted && (
        <CosmicOnboardingModal
          isOpen={isOpen}
          onClose={hideAuthModal}
          skipGreeting={true}
        />
      )}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}
