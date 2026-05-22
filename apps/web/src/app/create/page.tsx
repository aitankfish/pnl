'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, X, Check } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { config } from '@/lib/config';
import { createClientLogger } from '@/lib/logger';
import { useWallet } from '@/hooks/useWallet';
import { useSolBalance } from '@/lib/hooks/useSolBalance';
import {
  useWallets,
  useSignAndSendTransaction,
  useStandardWallets,
} from '@privy-io/react-auth/solana';
import { getSolanaConnection } from '@/lib/solana';
import bs58 from 'bs58';
import { useToast } from '@/lib/hooks/useToast';
import { isDevnet } from '@/lib/environment';
import { SOLANA_NETWORK } from '@/config/solana';
import {
  SeedIcon,
  RootIcon,
  BloomIcon,
  SunIcon,
  TreeIcon,
  LeafIcon,
} from '@/components/PlantIcons';
import { Dropdown, DropdownOption, DropdownGroup } from '@/components/Dropdown';
import { ResearchPaperFlow } from './ResearchPaperFlow';
import { KindTabs } from './KindTabs';
import {
  PaperSearchAutocomplete,
  type PaperSearchResult,
} from '@/components/research/PaperSearchAutocomplete';

const logger = createClientLogger();

// ── Cosmic-plant palette ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

type CitationRole = 'thesis' | 'foundation' | 'reference';
interface LinkedPaper {
  paper: PaperSearchResult;
  role: CitationRole;
  citationNote: string;
}

interface ProjectFormData {
  name: string;
  description: string;
  category: string;
  projectType: string;
  projectStage: string;
  location: string;
  teamSize: string;
  tokenSymbol: string;
  targetPool: string;
  marketDuration: string;
  projectImage?: File;
  projectDocument?: File;
  socialLinks: {
    website: string;
    github: string;
    linkedin: string;
    twitter: string;
    telegram: string;
    discord: string;
  };
  pitchVideo?: File;
  additionalNotes: string;
  linkedPapers: LinkedPaper[];
}

const initialFormData: ProjectFormData = {
  name: '',
  description: '',
  category: '',
  projectType: '',
  projectStage: '',
  location: '',
  teamSize: '',
  tokenSymbol: '',
  targetPool: '',
  marketDuration: '',
  socialLinks: { website: '', github: '', linkedin: '', twitter: '', telegram: '', discord: '' },
  additionalNotes: '',
  linkedPapers: [],
};

type StepId = 1 | 2 | 3 | 4 | 5;
type SubmissionStep = 'idle' | 'uploading' | 'preparing' | 'signing' | 'confirming' | 'completing';

const STEPS: Array<{
  id: StepId;
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: 1,
    Icon: SeedIcon,
    eyebrow: 'Step 1 of 5',
    title: 'The Seed',
    subtitle: 'What are you planting? Give it a name and a shape.',
  },
  {
    id: 2,
    Icon: RootIcon,
    eyebrow: 'Step 2 of 5',
    title: 'The Roots',
    subtitle: 'Where it stands. Who tends it. What it looks like.',
  },
  {
    id: 3,
    Icon: BloomIcon,
    eyebrow: 'Step 3 of 5',
    title: 'The Bloom',
    subtitle: 'How big should it grow. When should the grove decide.',
  },
  {
    id: 4,
    Icon: SunIcon,
    eyebrow: 'Step 4 of 5',
    title: 'The Voice',
    subtitle: 'Optional. Show your work — pitch, docs, links.',
  },
  {
    id: 5,
    Icon: TreeIcon,
    eyebrow: 'Step 5 of 5',
    title: 'Plant it',
    subtitle: 'One last look. When you\'re ready, set it in the grove.',
  },
];

const CATEGORY_GROUPS: DropdownGroup[] = [
  {
    label: 'Web3 & Crypto',
    options: [
      { value: 'defi', label: 'DeFi' },
      { value: 'nft', label: 'NFT' },
      { value: 'gaming', label: 'Gaming' },
      { value: 'dao', label: 'DAO' },
      { value: 'ai', label: 'AI/ML' },
      { value: 'infrastructure', label: 'Infrastructure' },
      { value: 'social', label: 'Social' },
      { value: 'meme', label: 'Meme' },
      { value: 'creator', label: 'Creator' },
    ],
  },
  {
    label: 'Traditional',
    options: [
      { value: 'healthcare', label: 'Healthcare' },
      { value: 'science', label: 'Science' },
      { value: 'education', label: 'Education' },
      { value: 'finance', label: 'Finance' },
      { value: 'commerce', label: 'Commerce' },
      { value: 'realestate', label: 'Real Estate' },
      { value: 'energy', label: 'Energy' },
      { value: 'media', label: 'Media' },
      { value: 'manufacturing', label: 'Manufacturing' },
      { value: 'mobility', label: 'Mobility' },
    ],
  },
  {
    label: 'Etc',
    options: [{ value: 'other', label: 'Other' }],
  },
];

const PROJECT_TYPES: DropdownOption[] = [
  { value: 'protocol', label: 'Protocol', hint: 'rails for others' },
  { value: 'application', label: 'Application', hint: 'used directly' },
  { value: 'platform', label: 'Platform', hint: 'host for others' },
  { value: 'service', label: 'Service', hint: 'human-powered' },
  { value: 'tool', label: 'Tool', hint: 'narrow utility' },
];

const PROJECT_STAGES: DropdownOption[] = [
  { value: 'idea', label: 'Idea', hint: 'just a seed' },
  { value: 'prototype', label: 'Prototype', hint: 'early sketch' },
  { value: 'mvp', label: 'MVP', hint: 'first working' },
  { value: 'beta', label: 'Beta', hint: 'in test' },
  { value: 'launched', label: 'Launched', hint: 'in the wild' },
];

const TARGET_POOLS: DropdownOption[] = [
  { value: '5000000000', label: '5 SOL', hint: 'small project' },
  { value: '10000000000', label: '10 SOL', hint: 'medium project' },
  { value: '15000000000', label: '15 SOL', hint: 'large project' },
];

const DURATIONS: DropdownOption[] = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '1 week' },
  { value: '14', label: '2 weeks' },
  { value: '30', label: '1 month' },
  { value: '60', label: '2 months' },
  { value: '90', label: '3 months' },
  { value: '180', label: '6 months' },
];

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams?.get('draft') ?? null;
  const { showToast } = useToast();
  const [kind, setKind] = useState<'project' | 'research'>('project');
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  // Draft prefill state — set once on mount when ?draft=<id> is present.
  // Lets us show a small "pre-filled from agent draft" badge in the UI
  // and avoids re-fetching across re-renders.
  const [draftLoaded, setDraftLoaded] = useState<boolean>(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  // When an agent (MCP) drafts a market, it can optionally attach a
  // provenance record — the conversation excerpt + code snippet that
  // birthed the idea. Keep it in state so we can pass it back to
  // /api/projects/create on submit, where it joins the Project doc
  // and surfaces on the market detail page as "Born in <agent> on <date>".
  const [draftProvenance, setDraftProvenance] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [furthestStep, setFurthestStep] = useState<StepId>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<SubmissionStep>('idle');
  const [isMounted, setIsMounted] = useState(false);
  const [isCustomPoolAmount, setIsCustomPoolAmount] = useState(false);
  const [planted, setPlanted] = useState<{
    marketId: string;
    marketAddress: string;
    name: string;
    signature: string;
  } | null>(null);

  const { primaryWallet, user, authenticated } = useWallet();
  const { wallets } = useWallets();
  const { wallets: standardWallets } = useStandardWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ─── Draft pre-fill ───────────────────────────────────────────
  // When the user arrives at /create?draft=<id> (typically from an MCP
  // tool's deep-link), fetch the agent-prepared payload and merge it
  // into formData. We only run this once and only when draftId is
  // present — re-mounting or query-param changes shouldn't reset the
  // form mid-edit.
  useEffect(() => {
    if (!draftId || draftLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/markets/drafts/${encodeURIComponent(draftId)}`);
        if (!res.ok) {
          const reason = res.status === 404 ? 'expired or unknown' : `error ${res.status}`;
          if (!cancelled) setDraftError(`Couldn't load that draft (${reason}). You can still fill the form by hand.`);
          return;
        }
        const json = (await res.json()) as {
          success: boolean;
          data?: { payload?: Record<string, unknown>; provenance?: Record<string, unknown> };
        };
        const payload = json?.data?.payload;
        const provenance = json?.data?.provenance;
        if (!payload || cancelled) return;
        if (provenance && typeof provenance === 'object') {
          setDraftProvenance(provenance);
        }
        setFormData((prev) => ({
          ...prev,
          name: typeof payload.name === 'string' ? payload.name : prev.name,
          description: typeof payload.description === 'string' ? payload.description : prev.description,
          category: typeof payload.category === 'string' ? payload.category : prev.category,
          projectType: typeof payload.projectType === 'string' ? payload.projectType : prev.projectType,
          projectStage: typeof payload.projectStage === 'string' ? payload.projectStage : prev.projectStage,
          location: typeof payload.location === 'string' ? payload.location : prev.location,
          teamSize: payload.teamSize != null ? String(payload.teamSize) : prev.teamSize,
          tokenSymbol: typeof payload.tokenSymbol === 'string' ? payload.tokenSymbol : prev.tokenSymbol,
          targetPool: payload.targetPoolSol != null ? String(payload.targetPoolSol) : prev.targetPool,
          marketDuration: payload.durationDays != null ? String(payload.durationDays) : prev.marketDuration,
          socialLinks: {
            ...prev.socialLinks,
            ...((payload.socialLinks && typeof payload.socialLinks === 'object')
              ? (payload.socialLinks as Partial<typeof prev.socialLinks>)
              : {}),
          },
        }));
        setDraftLoaded(true);
      } catch (e) {
        if (!cancelled) {
          setDraftError(
            `Couldn't load that draft — ${e instanceof Error ? e.message : 'network error'}. You can still fill the form by hand.`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId, draftLoaded]);

  // Wallet balance via the shared SWR hook — same source of truth as navbar,
  // sidebar, and /wallet. null preserves the prior "haven't fetched yet" semantic
  // so downstream gating still treats unknown != zero.
  const { solBalance: _solBalance, isLoading: _solLoading } = useSolBalance(
    authenticated ? primaryWallet?.address : null,
  );
  const walletBalance: number | null = authenticated && !_solLoading ? _solBalance : null;

  const setField = (field: keyof ProjectFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const setSocialLink = (platform: keyof ProjectFormData['socialLinks'], value: string) => {
    setFormData((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [platform]: value } }));
  };

  // Per-step validation. Returns map of field → error message; empty = valid.
  const validateStep = (step: StepId): Record<string, string> => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!formData.name.trim()) e.name = 'A name is required to plant.';
      if (!formData.description.trim()) e.description = 'Describe what you\'re growing.';
      else if (formData.description.length > config.ui.maxDescriptionLength)
        e.description = `Keep it under ${config.ui.maxDescriptionLength} characters.`;
      if (!formData.category) e.category = 'Pick a category.';
    }
    if (step === 2) {
      if (!formData.projectType) e.projectType = 'Pick a type.';
      if (!formData.projectStage) e.projectStage = 'Pick a stage.';
      if (!formData.teamSize || parseInt(formData.teamSize) < 1)
        e.teamSize = 'Team size must be at least 1.';
      if (!formData.projectImage) e.projectImage = 'A project image is required.';
    }
    if (step === 3) {
      if (!formData.tokenSymbol.trim()) e.tokenSymbol = 'A token symbol is required.';
      else if (formData.tokenSymbol.length < 3 || formData.tokenSymbol.length > 10)
        e.tokenSymbol = 'Symbol must be 3-10 characters.';
      else if (!/^[A-Z0-9]+$/.test(formData.tokenSymbol))
        e.tokenSymbol = 'Uppercase letters and numbers only.';
      if (!formData.targetPool) e.targetPool = 'Pick a target pool.';
      if (!formData.marketDuration) e.marketDuration = 'Pick a duration.';
    }
    if (step === 4) {
      if (formData.pitchVideo && formData.pitchVideo.size > 50 * 1024 * 1024)
        e.pitchVideo = 'Video must be 50MB or less.';
      if (formData.additionalNotes.length > config.ui.maxAdditionalNotesLength)
        e.additionalNotes = `Keep notes under ${config.ui.maxAdditionalNotesLength} characters.`;
    }
    return e;
  };

  const goNext = () => {
    const e = validateStep(currentStep);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    const next = Math.min(5, currentStep + 1) as StepId;
    setCurrentStep(next);
    setFurthestStep((f) => (next > f ? next : f));
    setErrors({});
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPrev = () => {
    const prev = Math.max(1, currentStep - 1) as StepId;
    setCurrentStep(prev);
    setErrors({});
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpToStep = (target: StepId) => {
    if (target > furthestStep) return;
    setCurrentStep(target);
    setErrors({});
  };

  // ─── Submission ─── (preserves the exact server-side flow:
  // /api/projects/create → /api/markets/prepare-transaction → Privy sign+send
  // → /api/markets/complete)
  const handlePlant = async () => {
    if (!primaryWallet) {
      showToast({
        type: 'error',
        title: 'Wallet not connected',
        message: 'Connect your wallet to plant.',
      });
      return;
    }
    const requiredSOL = 0.02;
    if (walletBalance !== null && walletBalance < requiredSOL) {
      showToast({
        type: 'error',
        title: 'Not enough SOL',
        message: `You need at least ${requiredSOL} SOL to plant.`,
        details: [`Current balance: ${walletBalance.toFixed(4)} SOL`],
      });
      return;
    }

    setIsSubmitting(true);
    setSubmissionStep('uploading');

    try {
      const apiFormData = new FormData();
      apiFormData.append('name', formData.name);
      apiFormData.append('description', formData.description);
      apiFormData.append('category', formData.category);
      apiFormData.append('projectType', formData.projectType);
      apiFormData.append('projectStage', formData.projectStage);
      apiFormData.append('location', formData.location || '');
      apiFormData.append('teamSize', formData.teamSize);
      apiFormData.append('tokenSymbol', formData.tokenSymbol);
      apiFormData.append('marketDuration', formData.marketDuration);
      apiFormData.append('socialLinks', JSON.stringify(formData.socialLinks));
      apiFormData.append('additionalNotes', formData.additionalNotes || '');
      apiFormData.append('creatorWalletAddress', primaryWallet.address);
      // If this market was drafted by an agent (via MCP) and carried
      // a provenance record, thread it through so it lands on the
      // Project doc and shows up on the market detail page.
      if (draftProvenance) {
        apiFormData.append('provenance', JSON.stringify(draftProvenance));
      }
      if (formData.projectImage) apiFormData.append('projectImage', formData.projectImage);
      if (formData.projectDocument) apiFormData.append('projectDocument', formData.projectDocument);
      if (formData.pitchVideo) apiFormData.append('pitchVideo', formData.pitchVideo);

      const projectResponse = await authFetch('/api/projects/create', {
        method: 'POST',
        body: apiFormData,
      });
      const projectResult = await projectResponse.json();
      if (!projectResult.success) throw new Error(projectResult.error || 'Failed to create project');

      setSubmissionStep('preparing');

      const transactionResponse = await authFetch('/api/markets/prepare-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          founderWallet: primaryWallet.address,
          metadataUri: projectResult.data.metadataUri,
          targetPool: formData.targetPool,
          marketDuration: parseInt(formData.marketDuration),
          network: SOLANA_NETWORK,
        }),
      });
      const transactionResult = await transactionResponse.json();
      if (!transactionResult.success) {
        // Surface the server-side root cause in the thrown message so the
        // toast doesn't just say "Failed to prepare transaction" with no clue.
        const baseMsg = transactionResult.error || 'Failed to prepare transaction';
        const detail = transactionResult.details ? ` — ${transactionResult.details}` : '';
        throw new Error(`${baseMsg}${detail}`);
      }

      if (!authenticated || !primaryWallet) {
        throw new Error('Wallet disconnected — please reconnect and try again.');
      }

      setSubmissionStep('signing');

      const rawTx = transactionResult.data.serializedTransaction;
      if (!rawTx) throw new Error('No serializedTransaction provided by server');
      const txBuffer = Buffer.from(rawTx, 'base64');

      const connection = await getSolanaConnection();
      const { Transaction } = await import('@solana/web3.js');
      const tx = Transaction.from(txBuffer);

      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        logger.error('[create] simulation failed', { err: sim.value.err, logs: sim.value.logs } as any);
        throw new Error(`Transaction simulation failed: ${JSON.stringify(sim.value.err)}`);
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      const freshTxBuffer = Buffer.from(
        tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
      );

      let solanaWallet: any;
      if (wallets && wallets.length > 0) {
        solanaWallet = wallets[0];
      } else if (standardWallets && standardWallets.length > 0) {
        const privyWallet = standardWallets.find(
          (w: any) => w.isPrivyWallet || w.name === 'Privy',
        );
        if (!privyWallet) throw new Error('No Privy wallet found');
        solanaWallet = privyWallet;
      } else {
        throw new Error('No Solana wallet found');
      }

      const result = await signAndSendTransaction({
        transaction: freshTxBuffer,
        wallet: solanaWallet,
        chain: isDevnet() ? 'solana:devnet' : 'solana:mainnet',
      });
      const signature = bs58.encode(result.signature);

      setSubmissionStep('confirming');
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      setSubmissionStep('completing');

      const completeResponse = await authFetch('/api/markets/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectResult.data.projectId,
          marketAddress: transactionResult.data.marketPda,
          signature,
          ipfsCid: transactionResult.data.ipfsCid,
          targetPool: formData.targetPool,
          expiryTime: transactionResult.data.expiryTime,
        }),
      });
      const completeResult = await completeResponse.json();
      if (!completeResult.success)
        throw new Error(completeResult.error || 'Failed to complete market creation');

      // Submit any linked-paper citations. Failures here are non-fatal —
      // the project is already live; citations can be added retroactively.
      if (formData.linkedPapers.length > 0) {
        const marketId = completeResult.data.marketId;
        await Promise.allSettled(
          formData.linkedPapers.map((l) =>
            authFetch(`/api/markets/${marketId}/cite`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paperId: l.paper.id,
                role: l.role,
                citationNote: l.citationNote || undefined,
              }),
            }).catch((err) => {
              logger.error('[create] citation submit failed', err as any);
            }),
          ),
        );
      }

      // Don't toast — the celebration speaks for itself.
      setPlanted({
        marketId: completeResult.data.marketId,
        marketAddress: transactionResult.data.marketPda,
        name: formData.name,
        signature,
      });
      setIsSubmitting(false);
      setSubmissionStep('idle');
    } catch (error) {
      logger.error('[create] plant failed', error as any);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      showToast({
        type: 'error',
        title: 'Couldn\'t plant the seed',
        message: msg,
        details: ['Try again or reach out on Discord.'],
        duration: 6000,
      });
      setIsSubmitting(false);
      setSubmissionStep('idle');
    }
  };

  // Loading splash — cosmic-themed (don't render the form until mount to
  // avoid wallet-state hydration mismatches).
  if (!isMounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" style={{ color: CREAM_DIM }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: AMBER }} />
        <span className="ml-3 mono text-[0.62rem] uppercase tracking-[0.24em]">Preparing soil…</span>
      </div>
    );
  }

  // Celebration takes over the page after a successful plant.
  if (planted) {
    return <PlantingCelebration {...planted} onWander={() => router.push('/launchpad')} />;
  }

  // Research papers are a separate, much shorter flow.
  if (kind === 'research') {
    return <ResearchPaperFlow onBack={() => setKind('project')} />;
  }

  const step = STEPS[currentStep - 1];

  return (
    <div className="px-4 sm:px-6 pb-20" style={{ color: CREAM }}>
      <div className="max-w-2xl mx-auto pt-8 sm:pt-12">
        <KindTabs kind={kind} onChange={setKind} />

        {/* ─── Editorial step header ─── */}
        <header className="text-center mb-8 sm:mb-10">
          <div
            className="inline-flex items-center justify-center w-12 h-12 mx-auto mb-4"
            style={{ border: `1px solid ${AMBER}55`, color: AMBER, background: `${AMBER}11` }}
          >
            <step.Icon className="w-6 h-6" />
          </div>
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-2"
            style={{ color: AMBER }}
          >
            {step.eyebrow}
          </p>
          <h1
            className="leading-[1.05] mb-3"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 350,
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontFeatureSettings: '"ss01"',
            }}
          >
            {step.title}
          </h1>
          <p
            className="mx-auto max-w-md"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
            }}
          >
            {step.subtitle}
          </p>
        </header>

        {/* ─── Progress dots ─── */}
        <ProgressDots
          currentStep={currentStep}
          furthestStep={furthestStep}
          onJump={jumpToStep}
        />

        {/* ─── Step content ─── */}
        <div className="space-y-6">
          {currentStep === 1 && (
            <SeedStep formData={formData} setField={setField} errors={errors} />
          )}
          {currentStep === 2 && (
            <RootsStep formData={formData} setField={setField} errors={errors} />
          )}
          {currentStep === 3 && (
            <BloomStep
              formData={formData}
              setField={setField}
              errors={errors}
              isCustom={isCustomPoolAmount}
              setIsCustom={setIsCustomPoolAmount}
            />
          )}
          {currentStep === 4 && (
            <VoiceStep
              formData={formData}
              setField={setField}
              setSocialLink={setSocialLink}
              errors={errors}
              founderWallet={primaryWallet?.address}
            />
          )}
          {currentStep === 5 && (
            <ReviewStep
              formData={formData}
              walletBalance={walletBalance}
              isSubmitting={isSubmitting}
              submissionStep={submissionStep}
              authenticated={authenticated}
            />
          )}
        </div>

        {/* ─── Bottom navigation ─── */}
        <div className="flex justify-between items-center mt-12 mb-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentStep === 1 || isSubmitting}
            className="mono text-[0.62rem] uppercase tracking-[0.24em] px-4 py-2.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
            onMouseEnter={(e) => {
              if (currentStep > 1 && !isSubmitting) {
                e.currentTarget.style.color = CREAM;
                e.currentTarget.style.borderColor = AMBER + '66';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = CREAM_DIM;
              e.currentTarget.style.borderColor = HAIR_STRONG;
            }}
          >
            ← Back
          </button>
          {currentStep === 5 ? (
            <button
              type="button"
              onClick={handlePlant}
              disabled={isSubmitting}
              className="mono text-[0.65rem] uppercase tracking-[0.28em] px-6 py-3 transition-colors inline-flex items-center gap-2 disabled:cursor-wait"
              style={{ background: AMBER, color: BG, minWidth: '200px', justifyContent: 'center' }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = PEACH;
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = AMBER;
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {submissionStep === 'uploading' && 'Sending to IPFS'}
                  {submissionStep === 'preparing' && 'Preparing'}
                  {submissionStep === 'signing' && 'Sign in wallet'}
                  {submissionStep === 'confirming' && 'On chain'}
                  {submissionStep === 'completing' && 'Finishing'}
                  {submissionStep === 'idle' && 'Working'}
                </>
              ) : (
                <>
                  <BloomIcon className="w-4 h-4" />
                  Plant it
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="mono text-[0.65rem] uppercase tracking-[0.28em] px-6 py-3 transition-colors"
              style={{ background: AMBER, color: BG }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
              onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Sub-components ───────────────────────

function ProgressDots({
  currentStep,
  furthestStep,
  onJump,
}: {
  currentStep: StepId;
  furthestStep: StepId;
  onJump: (s: StepId) => void;
}) {
  return (
    <nav className="flex items-center justify-center mb-10 sm:mb-14">
      {STEPS.map((s, i) => {
        const Icon = s.Icon;
        const isPast = s.id < currentStep;
        const isCurrent = s.id === currentStep;
        const reachable = s.id <= furthestStep;
        const color = isPast ? FOREST : isCurrent ? AMBER : CREAM_FAINT;
        const bg = isCurrent ? `${AMBER}1c` : 'transparent';
        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              onClick={() => reachable && onJump(s.id)}
              disabled={!reachable}
              className="flex flex-col items-center transition-colors"
              style={{ cursor: reachable ? 'pointer' : 'default', opacity: reachable ? 1 : 0.5 }}
              title={s.title}
            >
              <span
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-colors"
                style={{
                  border: `1px solid ${color}66`,
                  background: bg,
                  color,
                }}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <span
                className="hidden md:block mono uppercase tracking-[0.2em] text-[0.5rem] mt-1.5"
                style={{ color: isCurrent ? CREAM : CREAM_FAINT }}
              >
                {s.title}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className="h-px flex-1 max-w-[40px] sm:max-w-[60px] mx-1 sm:mx-2"
                style={{ background: s.id < currentStep ? FOREST + '88' : HAIR_STRONG }}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ── Field primitives (consistent cosmic-plant treatment) ──

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      className="block mono uppercase tracking-[0.22em] text-[0.6rem] mb-2"
      style={{ color: CREAM_DIM }}
    >
      {children}
      {required && <span style={{ color: AMBER }}> *</span>}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-1.5"
      style={{ color: CREAM_FAINT }}
    >
      {children}
    </p>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      className="mt-2 text-sm"
      style={{ color: EARTH, fontFamily: 'var(--font-fraunces, serif)' }}
    >
      {children}
    </p>
  );
}

const inputBase: React.CSSProperties = {
  background: 'transparent',
  color: CREAM,
  width: '100%',
  padding: '0.75rem 1rem',
  fontSize: '1rem',
  border: `1px solid ${HAIR_STRONG}`,
  outline: 'none',
  transition: 'border-color 200ms',
};

function focusOn(e: React.FocusEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.borderColor = AMBER;
}
function focusOff(e: React.FocusEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.borderColor = HAIR_STRONG;
}


// ── Step 1 — The Seed ──
function SeedStep({
  formData,
  setField,
  errors,
}: {
  formData: ProjectFormData;
  setField: (f: keyof ProjectFormData, v: any) => void;
  errors: Record<string, string>;
}) {
  const byteLength = useMemo(
    () => (formData.name ? new TextEncoder().encode(formData.name).length : 0),
    [formData.name],
  );
  return (
    <>
      <div>
        <FieldLabel required>Project name</FieldLabel>
        <input
          type="text"
          placeholder="What are you growing?"
          value={formData.name}
          onChange={(e) => setField('name', e.target.value)}
          onFocus={focusOn}
          onBlur={focusOff}
          style={{
            ...inputBase,
            borderColor: errors.name ? EARTH + '88' : HAIR_STRONG,
            fontFamily: 'var(--font-fraunces, serif)',
          }}
        />
        <FieldHint>
          Names cap at 32 bytes for pump.fun
          {byteLength > 0 && (
            <span style={{ color: byteLength > 32 ? EARTH : CREAM_FAINT }}>
              {' '}· {byteLength}/32 bytes{byteLength > 32 ? ' (will be truncated)' : ''}
            </span>
          )}
        </FieldHint>
        <FieldError>{errors.name}</FieldError>
      </div>

      <div>
        <FieldLabel required>Description</FieldLabel>
        <textarea
          placeholder="What is it, in one or two sentences?"
          value={formData.description}
          onChange={(e) => setField('description', e.target.value)}
          onFocus={focusOn}
          onBlur={focusOff}
          rows={4}
          style={{
            ...inputBase,
            borderColor: errors.description ? EARTH + '88' : HAIR_STRONG,
            resize: 'vertical',
            minHeight: '108px',
            fontFamily: 'var(--font-fraunces, serif)',
            lineHeight: 1.5,
          }}
        />
        <FieldHint>
          {formData.description.length}/{config.ui.maxDescriptionLength} characters
        </FieldHint>
        <FieldError>{errors.description}</FieldError>
      </div>

      <div>
        <FieldLabel required>Category</FieldLabel>
        <Dropdown
          value={formData.category}
          onChange={(v) => setField('category', v)}
          groups={CATEGORY_GROUPS}
          placeholder="Choose a category…"
          hasError={!!errors.category}
        />
        <FieldError>{errors.category}</FieldError>
      </div>
    </>
  );
}

// ── Step 2 — The Roots ──
function RootsStep({
  formData,
  setField,
  errors,
}: {
  formData: ProjectFormData;
  setField: (f: keyof ProjectFormData, v: any) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel required>Project type</FieldLabel>
          <Dropdown
            value={formData.projectType}
            onChange={(v) => setField('projectType', v)}
            options={PROJECT_TYPES}
            placeholder="Select…"
            hasError={!!errors.projectType}
          />
          <FieldError>{errors.projectType}</FieldError>
        </div>

        <div>
          <FieldLabel required>Stage</FieldLabel>
          <Dropdown
            value={formData.projectStage}
            onChange={(v) => setField('projectStage', v)}
            options={PROJECT_STAGES}
            placeholder="Select…"
            hasError={!!errors.projectStage}
          />
          <FieldError>{errors.projectStage}</FieldError>
        </div>

        <div>
          <FieldLabel required>Team size</FieldLabel>
          <input
            type="number"
            min={1}
            placeholder="How many of you?"
            value={formData.teamSize}
            onChange={(e) => setField('teamSize', e.target.value)}
            onFocus={focusOn}
            onBlur={focusOff}
            style={{
              ...inputBase,
              borderColor: errors.teamSize ? EARTH + '88' : HAIR_STRONG,
            }}
          />
          <FieldError>{errors.teamSize}</FieldError>
        </div>

        <div>
          <FieldLabel>Location</FieldLabel>
          <input
            type="text"
            placeholder="e.g. Global, Berlin, NYC"
            value={formData.location}
            onChange={(e) => setField('location', e.target.value)}
            onFocus={focusOn}
            onBlur={focusOff}
            style={inputBase}
          />
        </div>
      </div>

      <div>
        <FieldLabel required>Project image</FieldLabel>
        <FileDrop
          file={formData.projectImage}
          onFile={(f) => setField('projectImage', f)}
          accept="image/*"
          previewKind="image"
          empty={{
            primary: 'Click to upload',
            secondary: 'PNG, JPG, GIF up to 10MB',
          }}
        />
        <FieldError>{errors.projectImage}</FieldError>
      </div>
    </>
  );
}

// ── Step 3 — The Bloom ──
function BloomStep({
  formData,
  setField,
  errors,
  isCustom,
  setIsCustom,
}: {
  formData: ProjectFormData;
  setField: (f: keyof ProjectFormData, v: any) => void;
  errors: Record<string, string>;
  isCustom: boolean;
  setIsCustom: (b: boolean) => void;
}) {
  return (
    <>
      <div>
        <FieldLabel required>Token symbol</FieldLabel>
        <input
          type="text"
          placeholder="e.g. ALPHA"
          value={formData.tokenSymbol}
          onChange={(e) => setField('tokenSymbol', e.target.value.toUpperCase())}
          onFocus={focusOn}
          onBlur={focusOff}
          maxLength={10}
          style={{
            ...inputBase,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            borderColor: errors.tokenSymbol ? EARTH + '88' : HAIR_STRONG,
          }}
        />
        <FieldHint>3-10 uppercase letters or numbers</FieldHint>
        <FieldError>{errors.tokenSymbol}</FieldError>
      </div>

      <div>
        <FieldLabel required>Target pool</FieldLabel>
        <Dropdown
          value={isCustom ? 'custom' : formData.targetPool}
          onChange={(v) => {
            if (v === 'custom') {
              setIsCustom(true);
              setField('targetPool', '');
            } else {
              setIsCustom(false);
              setField('targetPool', v);
            }
          }}
          options={
            process.env.NODE_ENV === 'development'
              ? [...TARGET_POOLS, { value: 'custom', label: 'Custom amount', hint: 'dev only' }]
              : TARGET_POOLS
          }
          placeholder="Choose target pool size…"
          hasError={!!errors.targetPool}
        />
        {process.env.NODE_ENV === 'development' && isCustom && (
          <div className="mt-3">
            <input
              type="number"
              step="0.01"
              min="0.08"
              placeholder="Enter SOL amount (min 0.08)"
              onChange={(e) => {
                const sol = parseFloat(e.target.value);
                if (!isNaN(sol) && sol >= 0.08) {
                  setField('targetPool', String(Math.floor(sol * 1e9)));
                } else if (e.target.value === '') {
                  setField('targetPool', '');
                }
              }}
              onFocus={focusOn}
              onBlur={focusOff}
              style={{ ...inputBase, borderColor: '#d4a72c88' }}
            />
            {formData.targetPool && !isNaN(parseInt(formData.targetPool)) && (
              <FieldHint>
                Set to {(parseInt(formData.targetPool) / 1e9).toFixed(2)} SOL
              </FieldHint>
            )}
          </div>
        )}
        <FieldHint>More liquidity but needs more YES votes to launch.</FieldHint>
        <FieldError>{errors.targetPool}</FieldError>
      </div>

      <div>
        <FieldLabel required>Market duration</FieldLabel>
        <Dropdown
          value={formData.marketDuration}
          onChange={(v) => setField('marketDuration', v)}
          options={DURATIONS}
          placeholder="Choose duration…"
          hasError={!!errors.marketDuration}
        />
        <FieldHint>The voting period. YES costs 0.01 SOL minimum.</FieldHint>
        <FieldError>{errors.marketDuration}</FieldError>
      </div>

      {/* Creation fee callout */}
      <div
        className="p-4 mt-2"
        style={{ background: 'rgba(232,150,96,0.06)', border: `1px solid ${AMBER}33` }}
      >
        <p
          className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-1"
          style={{ color: AMBER }}
        >
          Cost to plant
        </p>
        <p
          style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.95rem' }}
        >
          0.015 SOL one-time fee. ~0.002 SOL more for transaction rent (refundable when the market closes).
        </p>
      </div>
    </>
  );
}

// ── Step 4 — The Voice ──
function VoiceStep({
  formData,
  setField,
  setSocialLink,
  errors,
  founderWallet,
}: {
  formData: ProjectFormData;
  setField: (f: keyof ProjectFormData, v: any) => void;
  setSocialLink: (p: keyof ProjectFormData['socialLinks'], v: string) => void;
  errors: Record<string, string>;
  founderWallet?: string;
}) {
  const linked = formData.linkedPapers;
  const excludeIds = useMemo(() => linked.map((l) => l.paper.id), [linked]);
  const ownLinked = useMemo(
    () => linked.filter((l) => l.paper.authorWallet === founderWallet),
    [linked, founderWallet],
  );
  const citedLinked = useMemo(
    () => linked.filter((l) => l.paper.authorWallet !== founderWallet),
    [linked, founderWallet],
  );

  const addPaper = (paper: PaperSearchResult, kind: 'own' | 'cited') => {
    // First own paper defaults to "thesis"; subsequent papers (own or
    // cited) start as 'foundation' for own and 'reference' for cited.
    let role: CitationRole;
    if (kind === 'own') {
      role = ownLinked.length === 0 ? 'thesis' : 'foundation';
    } else {
      role = 'reference';
    }
    setField('linkedPapers', [
      ...linked,
      { paper, role, citationNote: '' },
    ]);
  };
  const updateLinked = (id: string, patch: Partial<LinkedPaper>) => {
    setField(
      'linkedPapers',
      linked.map((l) =>
        l.paper.id === id ? { ...l, ...patch } : l,
      ),
    );
  };
  const removeLinked = (id: string) => {
    setField(
      'linkedPapers',
      linked.filter((l) => l.paper.id !== id),
    );
  };

  return (
    <>
      <div>
        <FieldLabel>Pitch video</FieldLabel>
        <FileDrop
          file={formData.pitchVideo}
          onFile={(f) => setField('pitchVideo', f)}
          accept="video/mp4,video/quicktime"
          previewKind="video"
          empty={{ primary: 'Click to upload MP4 or MOV', secondary: 'Up to 2 minutes, max 50MB' }}
        />
        <FieldError>{errors.pitchVideo}</FieldError>
      </div>

      <div>
        <FieldLabel>Project documentation</FieldLabel>
        <FileDrop
          file={formData.projectDocument}
          onFile={(f) => setField('projectDocument', f)}
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          previewKind="document"
          maxMB={10}
          empty={{ primary: 'Click to upload PDF or Word', secondary: 'Max 10MB' }}
        />
      </div>

      <div>
        <FieldLabel>Linked research papers</FieldLabel>
        <FieldHint>
          Your own papers that ground this project. The first becomes the
          project’s thesis; others sit as foundational reading.
        </FieldHint>
        <div className="mt-3 space-y-3">
          {ownLinked.length > 0 && (
            <div className="space-y-2">
              {ownLinked.map((l) => (
                <LinkedPaperRow
                  key={l.paper.id}
                  linked={l}
                  founderWallet={founderWallet}
                  onRoleChange={(role) =>
                    updateLinked(l.paper.id, { role })
                  }
                  onNoteChange={(note) =>
                    updateLinked(l.paper.id, { citationNote: note })
                  }
                  onRemove={() => removeLinked(l.paper.id)}
                />
              ))}
            </div>
          )}
          {founderWallet ? (
            <PaperSearchAutocomplete
              authorWallet={founderWallet}
              excludeIds={excludeIds}
              onSelect={(p) => addPaper(p, 'own')}
              placeholder="Search your papers by title…"
              emptyHint="No papers match. Publish one in the Research tab and come back."
            />
          ) : (
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: CREAM_FAINT }}
            >
              connect a wallet to link papers
            </p>
          )}
        </div>
      </div>

      <div>
        <FieldLabel>Cite work by other researchers</FieldLabel>
        <FieldHint>
          If your project builds on someone else’s research, cite them. Your
          citation is sent as a request — the cited researcher will need to
          accept it before it appears publicly on either page. (Limit 5 per
          day.)
        </FieldHint>
        <div className="mt-3 space-y-3">
          {citedLinked.length > 0 && (
            <div className="space-y-2">
              {citedLinked.map((l) => (
                <LinkedPaperRow
                  key={l.paper.id}
                  linked={l}
                  founderWallet={founderWallet}
                  onRoleChange={(role) =>
                    updateLinked(l.paper.id, { role })
                  }
                  onNoteChange={(note) =>
                    updateLinked(l.paper.id, { citationNote: note })
                  }
                  onRemove={() => removeLinked(l.paper.id)}
                />
              ))}
            </div>
          )}
          {founderWallet ? (
            <PaperSearchAutocomplete
              excludeAuthorWallet={founderWallet}
              excludeIds={excludeIds}
              onSelect={(p) => addPaper(p, 'cited')}
              placeholder="Search any researcher's paper by title…"
              emptyHint="No papers match. Try a different word."
            />
          ) : (
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: CREAM_FAINT }}
            >
              connect a wallet to cite work
            </p>
          )}
        </div>
      </div>

      <div>
        <FieldLabel>What this project offers</FieldLabel>
        <textarea
          placeholder="Unique value, features, why this matters…"
          value={formData.additionalNotes}
          onChange={(e) => setField('additionalNotes', e.target.value)}
          onFocus={focusOn}
          onBlur={focusOff}
          rows={4}
          style={{
            ...inputBase,
            resize: 'vertical',
            minHeight: '108px',
            fontFamily: 'var(--font-fraunces, serif)',
            lineHeight: 1.5,
          }}
        />
        <FieldHint>
          {formData.additionalNotes.length}/{config.ui.maxAdditionalNotesLength} characters
        </FieldHint>
        <FieldError>{errors.additionalNotes}</FieldError>
      </div>

      <div className="pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
        <FieldLabel>Social presence</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SocialInput
            placeholder="https://yourwebsite.com"
            value={formData.socialLinks.website}
            onChange={(v) => setSocialLink('website', v)}
            label="Website"
          />
          <SocialInput
            placeholder="https://x.com/yourproject"
            value={formData.socialLinks.twitter}
            onChange={(v) => setSocialLink('twitter', v)}
            label="X (Twitter)"
          />
          <SocialInput
            placeholder="https://github.com/yourproject"
            value={formData.socialLinks.github}
            onChange={(v) => setSocialLink('github', v)}
            label="GitHub"
          />
          <SocialInput
            placeholder="https://discord.gg/yourproject"
            value={formData.socialLinks.discord}
            onChange={(v) => setSocialLink('discord', v)}
            label="Discord"
          />
          <SocialInput
            placeholder="https://t.me/yourproject"
            value={formData.socialLinks.telegram}
            onChange={(v) => setSocialLink('telegram', v)}
            label="Telegram"
          />
          <SocialInput
            placeholder="https://linkedin.com/company/yourproject"
            value={formData.socialLinks.linkedin}
            onChange={(v) => setSocialLink('linkedin', v)}
            label="LinkedIn"
          />
        </div>
      </div>
    </>
  );
}

function LinkedPaperRow({
  linked,
  founderWallet,
  onRoleChange,
  onNoteChange,
  onRemove,
}: {
  linked: LinkedPaper;
  founderWallet?: string;
  onRoleChange: (role: CitationRole) => void;
  onNoteChange: (note: string) => void;
  onRemove: () => void;
}) {
  const isCrossAuthor =
    !!founderWallet && linked.paper.authorWallet !== founderWallet;
  const roles: Array<{ value: CitationRole; label: string }> = [
    { value: 'thesis', label: 'thesis' },
    { value: 'foundation', label: 'foundation' },
    { value: 'reference', label: 'reference' },
  ];
  return (
    <div
      className="p-3 sm:p-4"
      style={{
        background: isCrossAuthor
          ? 'rgba(232,150,96,0.05)'
          : 'rgba(63,122,66,0.05)',
        border: `1px solid ${isCrossAuthor ? AMBER + '44' : FOREST + '44'}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <p
              className="line-clamp-1"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1rem',
                fontWeight: 400,
              }}
            >
              {linked.paper.title}
            </p>
            <span
              className="mono uppercase tracking-[0.2em] text-[0.5rem] flex-shrink-0"
              style={{ color: AMBER }}
            >
              v{linked.paper.currentVersion}
            </span>
          </div>
          <p
            className="mono uppercase tracking-[0.22em] text-[0.55rem]"
            style={{ color: CREAM_FAINT }}
          >
            {linked.paper.authorName}
            {isCrossAuthor && (
              <>
                {' '}·{' '}
                <span style={{ color: AMBER }}>citation pending consent</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1 transition-colors"
          style={{ color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}` }}
          aria-label="Remove paper"
        >
          remove
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="mono uppercase tracking-[0.22em] text-[0.55rem] mr-1"
          style={{ color: CREAM_FAINT }}
        >
          role:
        </span>
        {roles.map((r) => {
          const active = r.value === linked.role;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onRoleChange(r.value)}
              className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2.5 py-1 transition-colors"
              style={{
                background: active ? FOREST : 'transparent',
                color: active ? '#fff' : CREAM_DIM,
                border: `1px solid ${active ? FOREST : HAIR_STRONG}`,
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        placeholder="Optional one-line note (e.g., builds on §3.2)"
        value={linked.citationNote}
        onChange={(e) => onNoteChange(e.target.value)}
        maxLength={280}
        className="w-full mt-3 px-3 py-2 transition-colors focus:outline-none"
        style={{
          background: 'transparent',
          border: `1px solid ${HAIR_STRONG}`,
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '0.9rem',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = AMBER)}
        onBlur={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
      />
    </div>
  );
}

function SocialInput({
  placeholder,
  value,
  onChange,
  label,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <p
        className="mono uppercase tracking-[0.2em] text-[0.55rem] mb-1.5"
        style={{ color: CREAM_FAINT }}
      >
        {label}
      </p>
      <input
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={focusOn}
        onBlur={focusOff}
        style={{ ...inputBase, padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
      />
    </div>
  );
}

// ── File drop zone ──
function FileDrop({
  file,
  onFile,
  accept,
  previewKind,
  maxMB = 50,
  empty,
}: {
  file?: File;
  onFile: (f: File | undefined) => void;
  accept: string;
  previewKind: 'image' | 'video' | 'document';
  maxMB?: number;
  empty: { primary: string; secondary: string };
}) {
  const id = useMemo(() => `file-${Math.random().toString(36).slice(2)}`, []);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const remove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFile(undefined);
  };

  const hasFile = !!file;
  return (
    <label
      htmlFor={id}
      className="block cursor-pointer transition-colors"
      style={{
        background: hasFile ? 'rgba(63,122,66,0.06)' : 'rgba(244,238,228,0.025)',
        border: `1px dashed ${hasFile ? FOREST + '88' : HAIR_STRONG}`,
        padding: '1.25rem',
        textAlign: 'center',
      }}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.size > maxMB * 1024 * 1024) {
              alert(`File must be ${maxMB}MB or less`);
              e.target.value = '';
              return;
            }
            onFile(f);
          }
        }}
        className="hidden"
      />
      {file ? (
        <div className="flex flex-col items-center">
          {previewKind === 'image' && previewUrl && (
            <div
              className="w-24 h-24 mb-3 overflow-hidden"
              style={{ border: `1px solid ${FOREST}55` }}
            >
              <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
            </div>
          )}
          {previewKind === 'video' && previewUrl && (
            <video
              src={previewUrl}
              controls
              muted
              className="w-full max-w-md max-h-48 mb-3"
              style={{ border: `1px solid ${FOREST}55` }}
            />
          )}
          {previewKind === 'document' && (
            <div
              className="w-16 h-20 mb-3 flex items-center justify-center"
              style={{ background: 'rgba(244,238,228,0.04)', border: `1px solid ${FOREST}55`, color: FOREST }}
            >
              <span
                className="mono uppercase tracking-[0.18em] text-[0.62rem]"
                style={{ color: FOREST }}
              >
                {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOC'}
              </span>
            </div>
          )}
          <p
            className="text-sm truncate max-w-full"
            style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)' }}
          >
            <Check className="w-3.5 h-3.5 inline mr-1.5 -translate-y-px" style={{ color: FOREST }} />
            {file.name}
          </p>
          <p
            className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-1"
            style={{ color: CREAM_FAINT }}
          >
            {(file.size / 1024 / 1024).toFixed(2)} MB · click to change
          </p>
          <button
            type="button"
            onClick={remove}
            className="mono uppercase tracking-[0.22em] text-[0.55rem] mt-2 inline-flex items-center gap-1 transition-colors"
            style={{ color: CREAM_FAINT }}
            onMouseEnter={(e) => (e.currentTarget.style.color = EARTH)}
            onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
          >
            <X className="w-3 h-3" /> remove
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center py-3">
          <LeafIcon className="w-7 h-7 mb-2" />
          <p
            className="text-sm"
            style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)' }}
          >
            {empty.primary}
          </p>
          <p
            className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-1"
            style={{ color: CREAM_FAINT }}
          >
            {empty.secondary}
          </p>
        </div>
      )}
    </label>
  );
}

// ── Step 5 — Plant it (review) ──
function ReviewStep({
  formData,
  walletBalance,
  isSubmitting,
  submissionStep,
  authenticated,
}: {
  formData: ProjectFormData;
  walletBalance: number | null;
  isSubmitting: boolean;
  submissionStep: SubmissionStep;
  authenticated: boolean;
}) {
  const targetSol = formData.targetPool ? (parseInt(formData.targetPool) / 1e9).toFixed(2) : '—';
  const duration = DURATIONS.find((d) => d.value === formData.marketDuration)?.label || '—';
  const stage = PROJECT_STAGES.find((s) => s.value === formData.projectStage)?.label || '—';

  return (
    <>
      {/* Hero strip — name + symbol + image */}
      <div
        className="p-5 sm:p-6 flex items-center gap-4"
        style={{ background: 'rgba(232,150,96,0.05)', border: `1px solid ${AMBER}44` }}
      >
        {formData.projectImage && (
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 overflow-hidden"
            style={{ border: `1px solid ${AMBER}66` }}
          >
            <img
              src={URL.createObjectURL(formData.projectImage)}
              alt={formData.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-1"
            style={{ color: AMBER }}
          >
            {formData.tokenSymbol || '—'}
          </p>
          <h3
            className="line-clamp-1"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '1.4rem',
              fontWeight: 400,
            }}
          >
            {formData.name || 'Untitled'}
          </h3>
          <p className="text-sm line-clamp-2 mt-1" style={{ color: CREAM_DIM }}>
            {formData.description || '—'}
          </p>
        </div>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px" style={{ background: HAIR_STRONG }}>
        <ReviewVital label="Stage" value={stage} />
        <ReviewVital label="Target" value={`${targetSol} SOL`} />
        <ReviewVital label="Voting" value={duration} />
        <ReviewVital label="Team" value={formData.teamSize || '—'} />
      </div>

      {/* Cost row */}
      <div
        className="p-4 flex flex-wrap items-center justify-between gap-3"
        style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR_STRONG}` }}
      >
        <div>
          <p
            className="mono uppercase tracking-[0.22em] text-[0.55rem]"
            style={{ color: CREAM_FAINT }}
          >
            Wallet balance
          </p>
          <p
            className="mono"
            style={{
              color:
                walletBalance === null
                  ? CREAM_DIM
                  : walletBalance < 0.02
                  ? EARTH
                  : FOREST,
              fontSize: '0.95rem',
              letterSpacing: '0.04em',
            }}
          >
            {walletBalance === null
              ? '— SOL'
              : `${walletBalance.toFixed(4)} SOL`}
          </p>
        </div>
        <div className="text-right">
          <p
            className="mono uppercase tracking-[0.22em] text-[0.55rem]"
            style={{ color: CREAM_FAINT }}
          >
            Cost to plant
          </p>
          <p
            className="mono"
            style={{ color: AMBER, fontSize: '0.95rem', letterSpacing: '0.04em' }}
          >
            ~0.017 SOL
          </p>
        </div>
      </div>

      {!authenticated && (
        <p
          className="text-center text-sm"
          style={{
            color: EARTH,
            fontFamily: 'var(--font-fraunces, serif)',
          }}
        >
          Connect a wallet from the top nav before planting.
        </p>
      )}

      {/* Live submission status */}
      {isSubmitting && submissionStep !== 'idle' && (
        <SubmissionRibbon step={submissionStep} />
      )}
    </>
  );
}

function ReviewVital({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-4 text-center" style={{ background: BG }}>
      <p
        className="mono uppercase tracking-[0.22em] text-[0.5rem] mb-1.5"
        style={{ color: CREAM_FAINT }}
      >
        {label}
      </p>
      <p
        style={{
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.1rem',
          fontWeight: 400,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SubmissionRibbon({ step }: { step: SubmissionStep }) {
  const stages: SubmissionStep[] = [
    'uploading',
    'preparing',
    'signing',
    'confirming',
    'completing',
  ];
  const labels: Record<SubmissionStep, string> = {
    idle: 'Idle',
    uploading: 'Sending to IPFS',
    preparing: 'Preparing transaction',
    signing: 'Sign in your wallet',
    confirming: 'Confirming on Solana',
    completing: 'Finishing up',
  };
  const idx = stages.indexOf(step);

  return (
    <div
      className="p-5"
      style={{
        background: 'rgba(232,150,96,0.06)',
        border: `1px solid ${AMBER}44`,
      }}
    >
      <p
        className="mono uppercase tracking-[0.22em] text-[0.6rem] mb-3"
        style={{ color: AMBER }}
      >
        Planting…
      </p>
      <div className="flex items-center gap-2">
        {stages.map((s, i) => {
          const isPast = i < idx;
          const isCurrent = i === idx;
          return (
            <React.Fragment key={s}>
              <span
                className="w-2.5 h-2.5"
                style={{
                  background: isPast ? FOREST : isCurrent ? AMBER : HAIR_STRONG,
                  animation: isCurrent ? 'pulseDot 1.2s ease-in-out infinite' : undefined,
                }}
              />
              {i < stages.length - 1 && (
                <span
                  className="h-px flex-1"
                  style={{ background: i < idx ? FOREST + '88' : HAIR_STRONG }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <p
        className="mt-3 text-sm"
        style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)' }}
      >
        {labels[step]}
        {step === 'signing' && (
          <span className="ml-1.5" style={{ color: CREAM_FAINT }}>
            — check your wallet popup.
          </span>
        )}
      </p>
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 0.5; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────── Celebration ───────────────────────
function PlantingCelebration({
  marketId,
  marketAddress,
  name,
  signature,
  onWander,
}: {
  marketId: string;
  marketAddress: string;
  name: string;
  signature: string;
  onWander: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: BG, color: CREAM }}
    >
      {/* Ambient warm glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            `radial-gradient(circle at 50% 60%, ${AMBER}22 0%, ${EARTH}08 35%, transparent 70%)`,
          animation: 'haloRise 2.2s ease-out 1.4s both',
        }}
      />

      {/* SVG planting scene */}
      <svg viewBox="0 0 400 540" className="w-[300px] sm:w-[380px] h-auto relative">
        <defs>
          <radialGradient id="bloomHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={AMBER} stopOpacity="0.55" />
            <stop offset="60%" stopColor={EARTH} stopOpacity="0.12" />
            <stop offset="100%" stopColor={EARTH} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soil — appears when seed lands */}
        <ellipse
          cx="200"
          cy="455"
          rx="80"
          ry="9"
          fill="rgba(122,68,40,0.45)"
          style={{ animation: 'soilAppear 0.6s ease-out 1.6s both', transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <ellipse
          cx="200"
          cy="453"
          rx="60"
          ry="5"
          fill="rgba(122,68,40,0.7)"
          style={{ animation: 'soilAppear 0.6s ease-out 1.7s both', transformBox: 'fill-box', transformOrigin: 'center' }}
        />

        {/* Stem — grows up from the soil */}
        <path
          d="M 200 455 Q 196 400 202 340 Q 208 280 200 220"
          stroke={CREAM}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
          style={{
            strokeDasharray: 270,
            strokeDashoffset: 270,
            animation: 'stemGrow 1.4s ease-out 2.1s forwards',
          }}
        />

        {/* Leaf — left */}
        <g transform="translate(196 350)" style={{ animation: 'leafUnfoldL 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 3.0s both', transformBox: 'fill-box', transformOrigin: 'center' }}>
          <path
            d="M 0 0 C -22 -8 -32 -22 -22 -36 C -10 -42 4 -32 0 0 Z"
            fill={FOREST}
            opacity="0.9"
          />
          <path d="M 0 0 L -18 -28" stroke="#1f3f21" strokeWidth="0.8" fill="none" />
        </g>
        {/* Leaf — right */}
        <g transform="translate(202 290)" style={{ animation: 'leafUnfoldR 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 3.3s both', transformBox: 'fill-box', transformOrigin: 'center' }}>
          <path
            d="M 0 0 C 22 -8 32 -22 22 -36 C 10 -42 -4 -32 0 0 Z"
            fill={FOREST}
            opacity="0.9"
          />
          <path d="M 0 0 L 18 -28" stroke="#1f3f21" strokeWidth="0.8" fill="none" />
        </g>

        {/* Bloom halo */}
        <circle
          cx="200"
          cy="220"
          r="58"
          fill="url(#bloomHalo)"
          style={{ animation: 'haloPulse 2.6s ease-in-out 4.0s infinite' }}
        />
        {/* Bloom petals */}
        <g
          transform="translate(200 220)"
          style={{ animation: 'bloomAppear 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 3.7s both', transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          <circle cx="0" cy="-9" r="7" fill={AMBER} opacity="0.92" />
          <circle cx="9" cy="-3" r="6" fill={PEACH} opacity="0.92" />
          <circle cx="-9" cy="-3" r="6" fill={PEACH} opacity="0.92" />
          <circle cx="6" cy="6" r="6" fill={EARTH} opacity="0.85" />
          <circle cx="-6" cy="6" r="6" fill={EARTH} opacity="0.85" />
          <circle cx="0" cy="0" r="3.5" fill={CREAM} />
        </g>

        {/* The seed itself — drops from above */}
        <circle
          cx="200"
          cy="-10"
          r="5"
          fill={AMBER}
          style={{ animation: 'seedDrop 1.4s cubic-bezier(0.5, 0, 0.95, 1) 0.4s forwards' }}
        />
      </svg>

      {/* Headline + copy + CTA */}
      <div className="relative text-center mt-6 sm:mt-2">
        <p
          className="mono uppercase tracking-[0.36em] text-[0.6rem] mb-3"
          style={{ color: AMBER, animation: 'fadeUp 0.7s ease-out 4.4s both' }}
        >
          The grove receives
        </p>
        <h1
          className="leading-[1.05] mb-3"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontWeight: 350,
            fontSize: 'clamp(2.2rem, 6vw, 4rem)',
            fontFeatureSettings: '"ss01"',
            animation: 'fadeUp 0.8s ease-out 4.6s both',
          }}
        >
          Planted.
        </h1>
        <p
          className="mx-auto max-w-md mb-2"
          style={{
            color: CREAM_DIM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
            animation: 'fadeUp 0.7s ease-out 4.9s both',
          }}
        >
          <span style={{ color: CREAM }}>{name}</span> is now growing in the grove.
        </p>
        <p
          className="mx-auto max-w-md mono uppercase tracking-[0.22em] text-[0.55rem] mb-7"
          style={{
            color: CREAM_FAINT,
            animation: 'fadeUp 0.7s ease-out 5.1s both',
          }}
        >
          The community will vote on whether it should launch.
        </p>

        <div
          className="flex flex-wrap items-center justify-center gap-3 mb-4"
          style={{ animation: 'fadeUp 0.7s ease-out 5.4s both' }}
        >
          <Link
            href={`/market/${marketId}`}
            className="mono uppercase tracking-[0.28em] text-[0.65rem] inline-block px-6 py-3 transition-colors"
            style={{ background: AMBER, color: BG }}
            onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
            onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
          >
            See your seedling
          </Link>
          <button
            type="button"
            onClick={onWander}
            className="mono uppercase tracking-[0.28em] text-[0.65rem] inline-block px-6 py-3 transition-colors"
            style={{ color: CREAM, border: `1px solid ${HAIR_STRONG}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = AMBER + '88';
              e.currentTarget.style.color = AMBER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = HAIR_STRONG;
              e.currentTarget.style.color = CREAM;
            }}
          >
            Wander the grove
          </button>
        </div>

        <p
          className="mono uppercase tracking-[0.2em] text-[0.5rem]"
          style={{
            color: CREAM_FAINT,
            animation: 'fadeUp 0.7s ease-out 5.7s both',
          }}
        >
          tx · {signature.slice(0, 8)}…{signature.slice(-6)}
          <span className="mx-2">·</span>
          market · {marketAddress.slice(0, 8)}…
        </p>
      </div>

      <style>{`
        @keyframes seedDrop {
          0% { cy: -10; opacity: 0; }
          15% { opacity: 1; }
          85% { cy: 450; opacity: 1; }
          100% { cy: 450; opacity: 0; }
        }
        @keyframes soilAppear {
          0% { transform: scaleX(0); opacity: 0; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes stemGrow {
          to { stroke-dashoffset: 0; }
        }
        @keyframes leafUnfoldL {
          0% { transform: scale(0) translateX(6px); opacity: 0; }
          100% { transform: scale(1) translateX(0); opacity: 1; }
        }
        @keyframes leafUnfoldR {
          0% { transform: scale(0) translateX(-6px); opacity: 0; }
          100% { transform: scale(1) translateX(0); opacity: 1; }
        }
        @keyframes bloomAppear {
          0% { transform: scale(0); opacity: 0; }
          80% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes haloPulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.35); opacity: 0.85; }
        }
        @keyframes haloRise {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes fadeUp {
          0% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
