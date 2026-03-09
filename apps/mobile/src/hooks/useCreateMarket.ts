/**
 * useCreateMarket — Multi-step wizard form state + 5-step submission pipeline
 * Manages form data, per-step validation, and on-chain market creation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VersionedTransaction } from '@solana/web3.js';
import { getSolanaConnection } from '@pnl/shared/solana';
import { apiUrl, parseError } from '@pnl/shared/utils';
import { useNetwork } from '@pnl/shared/hooks';
import { useAuth } from '../providers/AuthProvider';

const DRAFT_KEY = 'pnl:create-market-draft';

// ── Types ──────────────────────────────────────────────────────────────

export type SubmissionStep =
  | 'idle'
  | 'uploading'
  | 'preparing'
  | 'signing'
  | 'confirming'
  | 'completing'
  | 'success'
  | 'error';

export interface SocialLinks {
  website: string;
  github: string;
  twitter: string;
  discord: string;
  telegram: string;
  linkedin: string;
}

export interface CreateMarketForm {
  // Step 1 — Basic Info
  name: string;
  description: string;
  category: string;
  projectType: string;
  projectStage: string;
  teamSize: string;
  location: string;
  // Step 2 — Token & Market Config
  tokenSymbol: string;
  targetPool: string;
  marketDuration: string;
  // Step 3 — Social Links & Notes
  socialLinks: SocialLinks;
  additionalNotes: string;
}

export interface ProjectImage {
  uri: string;
  name: string;
  type: string;
}

export interface VideoFile {
  uri: string;
  name: string;
  type: string;
}

export interface FormErrors {
  [key: string]: string | undefined;
}

const INITIAL_FORM: CreateMarketForm = {
  name: '',
  description: '',
  category: '',
  projectType: '',
  projectStage: '',
  teamSize: '',
  location: '',
  tokenSymbol: '',
  targetPool: '',
  marketDuration: '',
  socialLinks: {
    website: '',
    github: '',
    twitter: '',
    discord: '',
    telegram: '',
    linkedin: '',
  },
  additionalNotes: '',
};

const INITIAL_SOCIAL: SocialLinks = {
  website: '',
  github: '',
  twitter: '',
  discord: '',
  telegram: '',
  linkedin: '',
};

// ── Draft Persistence ─────────────────────────────────────────────────

interface Draft {
  form: CreateMarketForm;
  projectImage: ProjectImage | null;
  galleryImages: ProjectImage[];
  pitchVideo: VideoFile | null;
  currentStep: number;
  savedAt: number;
}

// ── Validation Helpers ─────────────────────────────────────────────────

function validateStep1(form: CreateMarketForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Project name is required';
  else if (new TextEncoder().encode(form.name).length > 32)
    errors.name = 'Name must be 32 bytes or less';
  if (!form.description.trim()) errors.description = 'Description is required';
  if (!form.category) errors.category = 'Category is required';
  if (!form.projectType) errors.projectType = 'Project type is required';
  if (!form.projectStage) errors.projectStage = 'Project stage is required';
  if (!form.teamSize.trim()) errors.teamSize = 'Team size is required';
  else if (parseInt(form.teamSize, 10) < 1) errors.teamSize = 'Must be at least 1';
  return errors;
}

function validateStep2(form: CreateMarketForm, image: ProjectImage | null, galleryImages: ProjectImage[]): FormErrors {
  const errors: FormErrors = {};
  if (!form.tokenSymbol.trim()) errors.tokenSymbol = 'Token symbol is required';
  else if (form.tokenSymbol.length < 3 || form.tokenSymbol.length > 10)
    errors.tokenSymbol = 'Must be 3-10 characters';
  else if (!/^[A-Z0-9]+$/.test(form.tokenSymbol))
    errors.tokenSymbol = 'Only uppercase letters & numbers';
  if (!image) errors.projectImage = 'Project image is required';
  if (!form.targetPool) errors.targetPool = 'Target pool is required';
  if (!form.marketDuration) errors.marketDuration = 'Duration is required';
  // Meme category requires at least 1 gallery image (2 total with main)
  const isMeme = form.category.toLowerCase() === 'meme';
  if (isMeme && galleryImages.length < 1)
    errors.galleryImages = 'Meme projects need at least 2 images (add 1+ gallery image)';
  return errors;
}

// Step 3 is all optional — no validation needed.

// ── Hook ───────────────────────────────────────────────────────────────

export function useCreateMarket() {
  const [form, setForm] = useState<CreateMarketForm>(INITIAL_FORM);
  const [projectImage, setProjectImageState] = useState<ProjectImage | null>(null);
  const [galleryImages, setGalleryImages] = useState<ProjectImage[]>([]);
  const [pitchVideo, setPitchVideoState] = useState<VideoFile | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [submissionStep, setSubmissionStep] = useState<SubmissionStep>('idle');
  const [createdMarketId, setCreatedMarketId] = useState<string | null>(null);

  const { walletAddress, solanaWallet } = useAuth();
  const { network } = useNetwork();

  const [hasDraft, setHasDraft] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLoaded = useRef(false);

  // ── Draft: Load on mount ──────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) { draftLoaded.current = true; return; }
      try {
        const draft: Draft = JSON.parse(raw);
        setForm(draft.form);
        setProjectImageState(draft.projectImage);
        setGalleryImages(draft.galleryImages);
        setPitchVideoState(draft.pitchVideo);
        setCurrentStep(draft.currentStep);
        setHasDraft(true);
        draftLoaded.current = true;
      } catch {
        AsyncStorage.removeItem(DRAFT_KEY);
        draftLoaded.current = true;
      }
    });
  }, []);

  // ── Draft: Auto-save on changes (debounced 500ms) ─────────────────────

  useEffect(() => {
    if (!draftLoaded.current) return; // don't save before initial load
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const isEmpty =
        !form.name && !form.description && !form.tokenSymbol && !projectImage;
      if (isEmpty) {
        AsyncStorage.removeItem(DRAFT_KEY);
        setHasDraft(false);
        return;
      }
      const draft: Draft = {
        form,
        projectImage,
        galleryImages,
        pitchVideo,
        currentStep,
        savedAt: Date.now(),
      };
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setHasDraft(true);
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [form, projectImage, galleryImages, pitchVideo, currentStep]);

  // ── Draft: Clear helper ───────────────────────────────────────────────

  const clearDraft = useCallback(() => {
    AsyncStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  }, []);

  // ── Field Updaters ───────────────────────────────────────────────────

  const updateField = useCallback(
    (key: keyof Omit<CreateMarketForm, 'socialLinks'>, value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [errors],
  );

  const updateSocialLink = useCallback(
    (platform: keyof SocialLinks, value: string) => {
      setForm((prev) => ({
        ...prev,
        socialLinks: { ...prev.socialLinks, [platform]: value },
      }));
    },
    [],
  );

  const setProjectImage = useCallback(
    (uri: string, name: string, type: string) => {
      setProjectImageState({ uri, name, type });
      if (errors.projectImage) setErrors((prev) => ({ ...prev, projectImage: undefined }));
    },
    [errors],
  );

  const clearProjectImage = useCallback(() => {
    setProjectImageState(null);
  }, []);

  const addGalleryImage = useCallback(
    (uri: string, name: string, type: string) => {
      setGalleryImages((prev) => {
        if (prev.length >= 3) return prev; // max 3 gallery images (4 total with main)
        return [...prev, { uri, name, type }];
      });
    },
    [],
  );

  const removeGalleryImage = useCallback((index: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setPitchVideo = useCallback(
    (uri: string, name: string, type: string) => {
      setPitchVideoState({ uri, name, type });
    },
    [],
  );

  const clearPitchVideo = useCallback(() => {
    setPitchVideoState(null);
  }, []);

  // ── Step Navigation ──────────────────────────────────────────────────

  const nextStep = useCallback((): boolean => {
    let stepErrors: FormErrors = {};
    if (currentStep === 0) stepErrors = validateStep1(form);
    else if (currentStep === 1) stepErrors = validateStep2(form, projectImage, galleryImages);
    // Step 2 (pitch video) and Step 3 (social links) have no required fields

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return false;
    }
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, 4));
    return true;
  }, [currentStep, form, projectImage, galleryImages]);

  const prevStep = useCallback(() => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // ── 5-Step Submission Pipeline ───────────────────────────────────────

  const submit = useCallback(async (): Promise<boolean> => {
    if (!walletAddress) {
      Alert.alert('Wallet Required', 'Please connect your wallet first.');
      return false;
    }
    if (solanaWallet.status !== 'connected' || !solanaWallet.wallets?.[0]) {
      Alert.alert('Wallet Not Ready', 'Please wait for your wallet to connect.');
      return false;
    }

    try {
      // ── Step 1: Upload project & image ─────────────────────────────
      setSubmissionStep('uploading');

      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', form.description);
      formData.append('category', form.category);
      formData.append('projectType', form.projectType);
      formData.append('projectStage', form.projectStage);
      formData.append('teamSize', form.teamSize);
      formData.append('tokenSymbol', form.tokenSymbol);
      formData.append('targetPool', form.targetPool);
      formData.append('marketDuration', form.marketDuration);
      formData.append('creatorWalletAddress', walletAddress);
      formData.append('socialLinks', JSON.stringify(form.socialLinks));
      if (form.location) formData.append('location', form.location);
      if (form.additionalNotes) formData.append('additionalNotes', form.additionalNotes);

      if (projectImage) {
        formData.append('projectImage', {
          uri: projectImage.uri,
          name: projectImage.name,
          type: projectImage.type,
        } as any);
      }

      galleryImages.forEach((img, i) => {
        formData.append(`galleryImage${i}`, {
          uri: img.uri,
          name: img.name,
          type: img.type,
        } as any);
      });

      if (pitchVideo) {
        formData.append('pitchVideo', {
          uri: pitchVideo.uri,
          name: pitchVideo.name,
          type: pitchVideo.type,
        } as any);
      }

      const createRes = await fetch(apiUrl('/api/projects/create'), {
        method: 'POST',
        body: formData,
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error || 'Failed to create project');

      const { projectId, metadataUri } = createData.data;

      // ── Step 2: Prepare on-chain transaction ───────────────────────
      setSubmissionStep('preparing');

      const targetPoolLamports = parseFloat(form.targetPool) * 1_000_000_000;
      const durationDays = parseInt(form.marketDuration, 10);

      const prepareRes = await fetch(apiUrl('/api/markets/prepare-transaction'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          founderWallet: walletAddress,
          metadataUri,
          targetPool: targetPoolLamports,
          marketDuration: durationDays,
          network,
        }),
      });
      const prepareData = await prepareRes.json();
      if (!prepareData.success)
        throw new Error(prepareData.error || 'Failed to prepare transaction');

      const { serializedTransaction, marketPda, ipfsCid, expiryTime } = prepareData.data;

      // ── Step 3: Sign & send transaction ────────────────────────────
      setSubmissionStep('signing');

      const txBytes = Buffer.from(serializedTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBytes);

      const provider = await solanaWallet.wallets[0].getProvider();
      const connection = await getSolanaConnection(network);
      console.log('[CreateMarket] Signing with network:', network, 'RPC:', connection.rpcEndpoint);
      const { signature } = await (provider as any).request({
        method: 'signAndSendTransaction',
        params: { transaction, connection },
      });

      // ── Step 4: Confirm on-chain ───────────────────────────────────
      setSubmissionStep('confirming');

      await connection.confirmTransaction(signature, 'confirmed');

      // ── Step 5: Save to backend ────────────────────────────────────
      setSubmissionStep('completing');

      const completeRes = await fetch(apiUrl('/api/markets/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          marketAddress: marketPda,
          signature,
          ipfsCid,
          metadataUri,
          targetPool: targetPoolLamports,
          expiryTime,
          marketDuration: durationDays,
        }),
      });
      const completeData = await completeRes.json();
      if (!completeData.success) throw new Error(completeData.error || 'Failed to complete market');

      setCreatedMarketId(completeData.data?.marketId ?? projectId);
      setSubmissionStep('success');
      clearDraft();
      return true;
    } catch (err: any) {
      console.error('Market creation failed:', err);
      setSubmissionStep('error');
      const parsed = parseError(err);
      Alert.alert(parsed.title, `${parsed.message}\n\nYour data is preserved — please try again.`);
      // Reset submission step so user can retry
      setTimeout(() => setSubmissionStep('idle'), 300);
      return false;
    }
  }, [walletAddress, solanaWallet, form, projectImage, galleryImages, pitchVideo, network]);

  // ── Reset ────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setForm(INITIAL_FORM);
    setProjectImageState(null);
    setGalleryImages([]);
    setPitchVideoState(null);
    setErrors({});
    setCurrentStep(0);
    setSubmissionStep('idle');
    setCreatedMarketId(null);
    clearDraft();
  }, [clearDraft]);

  return {
    form,
    projectImage,
    galleryImages,
    pitchVideo,
    errors,
    currentStep,
    submissionStep,
    createdMarketId,
    hasDraft,
    updateField,
    updateSocialLink,
    setProjectImage,
    clearProjectImage,
    addGalleryImage,
    removeGalleryImage,
    setPitchVideo,
    clearPitchVideo,
    nextStep,
    prevStep,
    submit,
    reset,
    clearDraft,
  };
}
