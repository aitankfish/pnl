'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { config } from '@/lib/config';
import { createClientLogger } from '@/lib/logger';
import { useWallet } from '@/hooks/useWallet';
import { useWallets, useSignAndSendTransaction, useStandardWallets } from '@privy-io/react-auth/solana';
import { ipfsUtils, ProjectMetadata } from '@/lib/ipfs';
import { getSolanaConnection } from '@/lib/solana';
import bs58 from 'bs58';
import { useToast } from '@/lib/hooks/useToast';
import { isDevnet } from '@/lib/environment';
import { SOLANA_NETWORK } from '@/config/solana';

const logger = createClientLogger();

// Form data interface
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
  additionalNotes: string;
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
  socialLinks: {
    website: '',
    github: '',
    linkedin: '',
    twitter: '',
    telegram: '',
    discord: '',
  },
  additionalNotes: '',
};

export default function CreatePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<ProjectFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isTokenSectionExpanded, setIsTokenSectionExpanded] = useState(true);
  const [isCustomPoolAmount, setIsCustomPoolAmount] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);

  // Get connected wallet and user from Privy
  const { primaryWallet, user, authenticated } = useWallet();
  const { wallets } = useWallets();
  const { standardWallets } = useStandardWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  // Fix hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check wallet balance when wallet connects
  useEffect(() => {
    const checkBalance = async () => {
      if (!primaryWallet?.address || !authenticated) {
        setWalletBalance(null);
        return;
      }

      setIsCheckingBalance(true);
      try {
        const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
        const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
        const rpcEndpoint = network === 'mainnet-beta'
          ? process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC
          : process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC;

        const connection = new Connection(rpcEndpoint!, 'confirmed');
        const publicKey = new PublicKey(primaryWallet.address);
        const balance = await connection.getBalance(publicKey);
        const balanceInSOL = balance / LAMPORTS_PER_SOL;

        setWalletBalance(balanceInSOL);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setWalletBalance(null);
      } finally {
        setIsCheckingBalance(false);
      }
    };

    checkBalance();
  }, [primaryWallet, authenticated]);

  // Calculate form completion percentage
  const requiredFields = ['name', 'description', 'category', 'projectType', 'projectStage', 'teamSize', 'tokenSymbol', 'targetPool', 'marketDuration', 'projectImage'];
  const completedFields = requiredFields.filter(field => formData[field as keyof ProjectFormData]).length;
  const completionPercentage = (completedFields / requiredFields.length) * 100;

  const validateForm = (): boolean => {
    const newErrors: Partial<ProjectFormData> = {};

    if (!formData.name.trim()) newErrors.name = 'Project name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (formData.description.length > config.ui.maxDescriptionLength) {
      newErrors.description = `Description must be less than ${config.ui.maxDescriptionLength} characters`;
    }
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.projectType) newErrors.projectType = 'Project type is required';
    if (!formData.projectStage) newErrors.projectStage = 'Project stage is required';
    if (!formData.teamSize || parseInt(formData.teamSize) < 1) {
      newErrors.teamSize = 'Team size must be at least 1';
    }
    if (!formData.tokenSymbol.trim()) newErrors.tokenSymbol = 'Token symbol is required';
    if (formData.tokenSymbol.length < 3 || formData.tokenSymbol.length > 10) {
      newErrors.tokenSymbol = 'Token symbol must be 3-10 characters';
    }
    if (!/^[A-Z0-9]+$/.test(formData.tokenSymbol)) {
      newErrors.tokenSymbol = 'Token symbol must contain only uppercase letters and numbers';
    }
    if (!formData.targetPool) newErrors.targetPool = 'Target pool is required';
    if (!formData.marketDuration) newErrors.marketDuration = 'Market duration is required';
    if (!formData.projectImage) (newErrors as any).projectImage = 'Project image is required';
    if (formData.additionalNotes.length > config.ui.maxAdditionalNotesLength) {
      newErrors.additionalNotes = `Additional notes must be less than ${config.ui.maxAdditionalNotesLength} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSocialLinkChange = (platform: keyof ProjectFormData['socialLinks'], value: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [platform]: value }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if wallet is connected
    if (!primaryWallet) {
      showToast({
        title: 'Wallet Required',
        message: 'Please connect your wallet to create a project.',
        type: 'error'
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Upload project image to IPFS if provided
      let imageUri: string | undefined;
      if (formData.projectImage) {
        logger.info('Uploading project image to IPFS');
        imageUri = await ipfsUtils.uploadImage(formData.projectImage);
      }

      // Step 1.5: Upload project document to IPFS if provided
      let documentUri: string | undefined;
      if (formData.projectDocument) {
        logger.info('Uploading project document to IPFS');
        documentUri = await ipfsUtils.uploadDocument(formData.projectDocument);
      }

      // Step 2: Create project metadata
      const metadata: ProjectMetadata = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        projectType: formData.projectType,
        projectStage: formData.projectStage,
        location: formData.location || undefined,
        teamSize: parseInt(formData.teamSize),
        tokenSymbol: formData.tokenSymbol,
        marketDuration: parseInt(formData.marketDuration),
        minimumStake: 0.05, // Fixed minimum stake equals YES vote cost
        socialLinks: {
          website: formData.socialLinks.website || undefined,
          github: formData.socialLinks.github || undefined,
          linkedin: formData.socialLinks.linkedin || undefined,
          twitter: formData.socialLinks.twitter || undefined,
          telegram: formData.socialLinks.telegram || undefined,
          discord: formData.socialLinks.discord || undefined,
        },
        additionalNotes: formData.additionalNotes || undefined,
        image: imageUri,
        documents: documentUri ? [documentUri] : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Step 3: Upload metadata to IPFS
      logger.info('Uploading project metadata to IPFS');
      const metadataUri = await ipfsUtils.uploadProjectMetadata(metadata);

      // Step 4: Create prediction market via server-side API
      logger.info('Creating prediction market via server-side API');
      
      // Prepare form data for server-side processing
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'socialLinks') {
          submitData.append('socialLinks', JSON.stringify(value));
        } else if (key === 'projectImage' && value instanceof File) {
          submitData.append('projectImage', value);
        } else if (key === 'projectDocument' && value instanceof File) {
          // Skip projectDocument here - it's already uploaded to IPFS
          // and documentUri is added separately below
        } else if (value !== undefined && value !== null && value !== '') {
          submitData.append(key, value.toString());
        }
      });
      
      // Add the metadata URI, document URI, and creator wallet address
      submitData.append('metadataUri', metadataUri);
      if (documentUri) {
        submitData.append('documentUri', documentUri);
      }
      submitData.append('creatorWalletAddress', primaryWallet.address);
      
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        body: submitData,
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create prediction market');
      }
      
      const marketResult = result.data;

      logger.info('Project created successfully', {
        projectName: formData.name,
        marketAddress: marketResult.marketAddress,
        transactionSignature: marketResult.signature,
        metadataUri,
        imageUri
      });
      
      // Show success message with project details
      let successMessage = `Project "${formData.name}" created successfully!\n\n` +
            `Market Address: ${marketResult.marketAddress}\n` +
            `Transaction: ${marketResult.signature}\n` +
            `Metadata: ${metadataUri}\n\n`;
      
      if (imageUri) {
        successMessage += `✅ Project image uploaded to IPFS\n`;
      }
      
      successMessage += `\nYour prediction market is now live! Community members can vote on whether your project should launch a token.`;
      
      alert(successMessage);
      
      // Reset form
      setFormData(initialFormData);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create project', { error: errorMessage });
      alert(`Failed to create project: ${errorMessage}\n\nPlease try again or contact support if the issue persists.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent hydration issues by not rendering until mounted
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white/70">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center relative">
            {/* Decorative background glow */}
            <div className="absolute inset-0 -top-20 flex justify-center pointer-events-none">
              <div className="w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
              <div className="w-72 h-72 bg-blue-500/20 rounded-full blur-3xl -ml-32"></div>
            </div>

            <div className="relative">
              <h1 className="text-4xl md:text-5xl font-bold mb-3">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Create New Project
                </span>
              </h1>
              <p className="text-lg text-white/70 max-w-xl mx-auto">
                Launch your prediction market and let the community decide
              </p>

              {/* Quick stats */}
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2 text-white/50">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>0.015 SOL to create</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>1-30 day markets</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Community validated</span>
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout: Progress Sidebar + Form */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Vertical Progress */}
            <div className="lg:w-64 flex-shrink-0">
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-white lg:sticky lg:top-24">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Form Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Circular Progress with Gradient */}
                  <div className="flex flex-col items-center py-4">
                    <div className="relative w-32 h-32">
                      <svg className="w-32 h-32 transform -rotate-90">
                        {/* Background Circle */}
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-white/10"
                        />
                        {/* Gradient Definition */}
                        <defs>
                          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#22d3ee" />
                            <stop offset="50%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                        </defs>
                        {/* Progress Circle with Gradient */}
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="url(#progressGradient)"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          strokeDashoffset={`${2 * Math.PI * 56 * (1 - completionPercentage / 100)}`}
                          className="transition-all duration-500"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                          {Math.round(completionPercentage)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-white/50 mt-3 text-center">
                      {completedFields} of {requiredFields.length} fields completed
                    </p>
                  </div>

                  {/* Form Sections Checklist - Enhanced */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Sections</p>
                    <div className="space-y-2 text-sm">
                      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all ${formData.name && formData.description ? 'bg-green-500/10' : 'bg-white/5'}`}>
                        {formData.name && formData.description ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-white/30"></div>
                        )}
                        <span className={formData.name && formData.description ? 'text-green-400 font-medium' : 'text-white/50'}>Basic Info</span>
                      </div>
                      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all ${formData.category && formData.projectType && formData.projectStage ? 'bg-green-500/10' : 'bg-white/5'}`}>
                        {formData.category && formData.projectType && formData.projectStage ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-white/30"></div>
                        )}
                        <span className={formData.category && formData.projectType && formData.projectStage ? 'text-green-400 font-medium' : 'text-white/50'}>Project Details</span>
                      </div>
                      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all ${formData.tokenSymbol && formData.targetPool && formData.marketDuration ? 'bg-green-500/10' : 'bg-white/5'}`}>
                        {formData.tokenSymbol && formData.targetPool && formData.marketDuration ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-white/30"></div>
                        )}
                        <span className={formData.tokenSymbol && formData.targetPool && formData.marketDuration ? 'text-green-400 font-medium' : 'text-white/50'}>Market Settings</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Content - Form */}
            <div className="flex-1 min-w-0">
              <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border-white/20 text-white overflow-visible hover:border-blue-500/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  Basic Information
                </CardTitle>
                <CardDescription className="text-white/70 ml-12">
                  Tell us about your project
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-visible">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter your project name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 ${errors.name ? 'border-red-500' : ''}`}
                  />
                  <p className="text-xs text-white/60">
                    Token names are limited to 32 bytes for Pump.fun token launch
                    {formData.name.length > 0 && (() => {
                      const byteLength = new TextEncoder().encode(formData.name).length;
                      const color = byteLength > 32 ? 'text-yellow-400' : 'text-white/60';
                      return <span className={color}> ({byteLength}/32 bytes{byteLength > 32 ? ' - will be truncated' : ''})</span>;
                    })()}
                  </p>
                  {errors.name && <p className="text-sm text-red-400">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your project"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className={`min-h-24 bg-white/10 border-white/20 text-white placeholder:text-white/50 ${errors.description ? 'border-red-500' : ''}`}
                  />
                  <p className="text-xs text-white/60">
                    {formData.description.length}/{config.ui.maxDescriptionLength} characters
                  </p>
                  {errors.description && <p className="text-sm text-red-400">{errors.description}</p>}
                </div>

                {/* Project metadata grid - responsive 2/3 columns */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Category *
                    </Label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className={`h-10 w-full bg-white/10 border border-white/20 text-white text-sm rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.category ? 'border-red-500' : ''}`}
                    >
                      <option value="" className="bg-slate-800">Select</option>
                      <optgroup label="Web3 & Crypto" className="bg-slate-800">
                        <option value="defi" className="bg-slate-800">DeFi</option>
                        <option value="nft" className="bg-slate-800">NFT</option>
                        <option value="gaming" className="bg-slate-800">Gaming</option>
                        <option value="dao" className="bg-slate-800">DAO</option>
                        <option value="ai" className="bg-slate-800">AI/ML</option>
                        <option value="infrastructure" className="bg-slate-800">Infrastructure</option>
                        <option value="social" className="bg-slate-800">Social</option>
                        <option value="meme" className="bg-slate-800">Meme</option>
                        <option value="creator" className="bg-slate-800">Creator</option>
                      </optgroup>
                      <optgroup label="Traditional" className="bg-slate-800">
                        <option value="healthcare" className="bg-slate-800">Healthcare</option>
                        <option value="science" className="bg-slate-800">Science</option>
                        <option value="education" className="bg-slate-800">Education</option>
                        <option value="finance" className="bg-slate-800">Finance</option>
                        <option value="commerce" className="bg-slate-800">Commerce</option>
                        <option value="realestate" className="bg-slate-800">Real Estate</option>
                        <option value="energy" className="bg-slate-800">Energy</option>
                        <option value="media" className="bg-slate-800">Media</option>
                        <option value="manufacturing" className="bg-slate-800">Manufacturing</option>
                        <option value="mobility" className="bg-slate-800">Mobility</option>
                      </optgroup>
                      <option value="other" className="bg-slate-800">Other</option>
                    </select>
                    {errors.category && <p className="text-xs text-red-400 mt-1">{errors.category}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Type *
                    </Label>
                    <select
                      value={formData.projectType}
                      onChange={(e) => handleInputChange('projectType', e.target.value)}
                      className={`h-10 w-full bg-white/10 border border-white/20 text-white text-sm rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500/50 transition-all ${errors.projectType ? 'border-red-500' : ''}`}
                    >
                      <option value="" className="bg-slate-800">Select</option>
                      <option value="protocol" className="bg-slate-800">Protocol</option>
                      <option value="application" className="bg-slate-800">Application</option>
                      <option value="platform" className="bg-slate-800">Platform</option>
                      <option value="service" className="bg-slate-800">Service</option>
                      <option value="tool" className="bg-slate-800">Tool</option>
                    </select>
                    {errors.projectType && <p className="text-xs text-red-400 mt-1">{errors.projectType}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Stage *
                    </Label>
                    <select
                      value={formData.projectStage}
                      onChange={(e) => handleInputChange('projectStage', e.target.value)}
                      className={`h-10 w-full bg-white/10 border border-white/20 text-white text-sm rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500/50 transition-all ${errors.projectStage ? 'border-red-500' : ''}`}
                    >
                      <option value="" className="bg-slate-800">Select</option>
                      <option value="idea" className="bg-slate-800">Idea</option>
                      <option value="prototype" className="bg-slate-800">Prototype</option>
                      <option value="mvp" className="bg-slate-800">MVP</option>
                      <option value="beta" className="bg-slate-800">Beta</option>
                      <option value="launched" className="bg-slate-800">Launched</option>
                    </select>
                    {errors.projectStage && <p className="text-xs text-red-400 mt-1">{errors.projectStage}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Location
                    </Label>
                    <Input
                      id="location"
                      placeholder="e.g., Global"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="h-10 bg-white/10 border-white/20 text-white text-sm placeholder:text-white/50 focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teamSize" className="text-sm flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Team *
                    </Label>
                    <Input
                      id="teamSize"
                      type="number"
                      min="1"
                      placeholder="Size"
                      value={formData.teamSize}
                      onChange={(e) => handleInputChange('teamSize', e.target.value)}
                      className={`h-10 bg-white/10 border-white/20 text-white text-sm placeholder:text-white/50 focus:ring-2 focus:ring-amber-500/50 transition-all ${errors.teamSize ? 'border-red-500' : ''}`}
                    />
                    {errors.teamSize && <p className="text-xs text-red-400 mt-1">{errors.teamSize}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Information - Collapsible */}
            <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border-white/20 text-white overflow-visible hover:border-purple-500/30 transition-colors">
              <CardHeader className="cursor-pointer" onClick={() => setIsTokenSectionExpanded(!isTokenSectionExpanded)}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      Token & Market Configuration
                      {(formData.tokenSymbol && formData.targetPool && formData.marketDuration) && (
                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </CardTitle>
                    <CardDescription className="text-white/70 ml-12">
                      Token details and market settings
                    </CardDescription>
                  </div>
                  <svg
                    className={`w-5 h-5 text-white/70 transition-transform ${isTokenSectionExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </CardHeader>
              {isTokenSectionExpanded && (
              <CardContent className="space-y-4 overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tokenSymbol">Token Symbol *</Label>
                    <Input
                      id="tokenSymbol"
                      placeholder="e.g., PROJ"
                      value={formData.tokenSymbol}
                      onChange={(e) => handleInputChange('tokenSymbol', e.target.value.toUpperCase())}
                      className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 ${errors.tokenSymbol ? 'border-red-500' : ''}`}
                      maxLength={10}
                    />
                    {errors.tokenSymbol && <p className="text-sm text-red-400">{errors.tokenSymbol}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectImage">Project Image *</Label>
                    <label
                      htmlFor="projectImage"
                      className={`
                        relative flex flex-col items-center justify-center p-6
                        border-2 border-dashed rounded-xl cursor-pointer
                        transition-all duration-200 group
                        ${formData.projectImage
                          ? 'border-green-500/50 bg-green-500/5'
                          : 'border-white/20 bg-white/5 hover:border-blue-500/50 hover:bg-blue-500/5'
                        }
                      `}
                    >
                      <input
                        id="projectImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFormData(prev => ({ ...prev, projectImage: file }));
                          }
                        }}
                        className="hidden"
                      />
                      {formData.projectImage ? (
                        <>
                          <div className="p-3 bg-green-500/20 rounded-full mb-2">
                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-sm text-green-400 font-medium">{formData.projectImage.name}</p>
                          <p className="text-xs text-white/50 mt-1">Click to change</p>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-blue-500/20 rounded-full mb-2 group-hover:bg-blue-500/30 transition-colors">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-sm text-white/70 group-hover:text-white transition-colors">Click to upload image</p>
                          <p className="text-xs text-white/40 mt-1">PNG, JPG, GIF up to 10MB</p>
                        </>
                      )}
                    </label>
                    {errors.projectImage && <p className="text-sm text-red-400 mt-1 text-center">{String(errors.projectImage)}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectDocument">Project Documentation</Label>
                    <label
                      htmlFor="projectDocument"
                      className={`
                        relative flex flex-col items-center justify-center p-6
                        border-2 border-dashed rounded-xl cursor-pointer
                        transition-all duration-200 group
                        ${formData.projectDocument
                          ? 'border-green-500/50 bg-green-500/5'
                          : 'border-white/20 bg-white/5 hover:border-teal-500/50 hover:bg-teal-500/5'
                        }
                      `}
                    >
                      <input
                        id="projectDocument"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              alert('Document must be less than 10MB');
                              e.target.value = '';
                              return;
                            }
                            setFormData(prev => ({ ...prev, projectDocument: file }));
                          }
                        }}
                        className="hidden"
                      />
                      {formData.projectDocument ? (
                        <>
                          <div className="p-3 bg-green-500/20 rounded-full mb-2">
                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-sm text-green-400 font-medium">{formData.projectDocument.name}</p>
                          <p className="text-xs text-white/50 mt-1">Click to change</p>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-teal-500/20 rounded-full mb-2 group-hover:bg-teal-500/30 transition-colors">
                            <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-sm text-white/70 group-hover:text-white transition-colors">Click to upload document</p>
                          <p className="text-xs text-white/40 mt-1">PDF or Word, max 10MB (optional)</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* Creation Fee Info */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-400 mb-1">Market Creation Fee</h4>
                      <p className="text-sm text-white/70">
                        Creating a prediction market costs <span className="font-semibold text-white">0.015 SOL</span>.
                        This one-time fee covers on-chain storage and helps prevent spam.
                      </p>
                      <p className="text-xs text-white/50 mt-2">
                        You&apos;ll also need ~0.002 SOL for transaction rent (refundable when market closes).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Target Pool Size & Market Duration - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetPool">
                      Target Pool Size *
                      <span className="ml-2 text-xs text-white/60">(SOL to collect)</span>
                    </Label>
                    <select
                      id="targetPool"
                      value={isCustomPoolAmount ? 'custom' : formData.targetPool}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'custom') {
                          setIsCustomPoolAmount(true);
                          handleInputChange('targetPool', '');
                        } else {
                          setIsCustomPoolAmount(false);
                          handleInputChange('targetPool', value);
                        }
                      }}
                      className={`w-full bg-white/10 border border-white/20 text-white rounded-md px-3 py-2 ${errors.targetPool ? 'border-red-500' : ''}`}
                    >
                      <option value="" className="bg-slate-800">Choose target pool size...</option>
                      <option value="5000000000" className="bg-slate-800">5 SOL (Small Project)</option>
                      <option value="10000000000" className="bg-slate-800">10 SOL (Medium Project)</option>
                      <option value="15000000000" className="bg-slate-800">15 SOL (Large Project)</option>
                      <option value="custom" className="bg-slate-800">Custom Amount</option>
                    </select>

                    {/* Custom amount input */}
                    {isCustomPoolAmount && (
                      <div className="mt-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.08"
                          placeholder="Enter SOL amount (min 0.08)"
                          onChange={(e) => {
                            const sol = parseFloat(e.target.value);
                            if (!isNaN(sol) && sol >= 0.08) {
                              handleInputChange('targetPool', String(Math.floor(sol * 1e9)));
                            } else if (e.target.value === '') {
                              handleInputChange('targetPool', '');
                            }
                          }}
                          className="w-full bg-white/5 border border-yellow-500/50 text-white rounded-md px-3 py-2 placeholder-white/30"
                        />
                        {formData.targetPool && formData.targetPool !== '' && !isNaN(parseInt(formData.targetPool)) && (
                          <p className="text-xs text-green-400 mt-1">
                            ✓ Set to {(parseInt(formData.targetPool) / 1e9).toFixed(2)} SOL ({formData.targetPool} lamports)
                          </p>
                        )}
                        <p className="text-xs text-yellow-400 mt-1">⚠️ Dev Mode: Custom pool amount</p>
                      </div>
                    )}

                    {errors.targetPool && <p className="text-sm text-red-400">{errors.targetPool}</p>}
                    <p className="text-xs text-white/60">
                      More liquidity but needs more YES votes
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Market Duration *</Label>
                    <select
                      value={formData.marketDuration}
                      onChange={(e) => handleInputChange('marketDuration', e.target.value)}
                      className={`w-full bg-white/10 border border-white/20 text-white rounded-md px-3 py-2 ${errors.marketDuration ? 'border-red-500' : ''}`}
                    >
                      <option value="" className="bg-slate-800">Choose market duration...</option>
                      <option value="1" className="bg-slate-800">1 Day</option>
                      <option value="3" className="bg-slate-800">3 Days</option>
                      <option value="7" className="bg-slate-800">1 Week</option>
                      <option value="14" className="bg-slate-800">2 Weeks</option>
                      <option value="30" className="bg-slate-800">1 Month</option>
                    </select>
                    {errors.marketDuration && <p className="text-sm text-red-400">{errors.marketDuration}</p>}
                    <p className="text-xs text-white/60">
                      Voting period. <span className="text-blue-400">YES: 0.01 SOL min, NO: dynamic</span>
                    </p>
                  </div>
                </div>
              </CardContent>
              )}
            </Card>

            {/* Social Media Links */}
            <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border-white/20 text-white hover:border-cyan-500/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  Social Media Links
                </CardTitle>
                <CardDescription className="text-white/70 ml-12">
                  Add your project&apos;s social media presence (optional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="website" className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Website
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://yourwebsite.com"
                      value={formData.socialLinks.website}
                      onChange={(e) => handleSocialLinkChange('website', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="github" className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                      GitHub
                    </Label>
                    <Input
                      id="github"
                      type="url"
                      placeholder="https://github.com/yourproject"
                      value={formData.socialLinks.github}
                      onChange={(e) => handleSocialLinkChange('github', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter" className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      X (Twitter)
                    </Label>
                    <Input
                      id="twitter"
                      type="url"
                      placeholder="https://x.com/yourproject"
                      value={formData.socialLinks.twitter}
                      onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord" className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                      </svg>
                      Discord
                    </Label>
                    <Input
                      id="discord"
                      type="url"
                      placeholder="https://discord.gg/yourproject"
                      value={formData.socialLinks.discord}
                      onChange={(e) => handleSocialLinkChange('discord', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram" className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.36 8.629-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                      Telegram
                    </Label>
                    <Input
                      id="telegram"
                      type="url"
                      placeholder="https://t.me/yourproject"
                      value={formData.socialLinks.telegram}
                      onChange={(e) => handleSocialLinkChange('telegram', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin" className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </Label>
                    <Input
                      id="linkedin"
                      type="url"
                      placeholder="https://linkedin.com/company/yourproject"
                      value={formData.socialLinks.linkedin}
                      onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What This Project Has to Offer */}
            <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border-white/20 text-white hover:border-emerald-500/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  What This Project Has to Offer
                </CardTitle>
                <CardDescription className="text-white/70 ml-12">
                  Describe the unique value, features, or benefits your project brings to users (optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Textarea
                    placeholder="e.g., Revolutionary DeFi features, unique tokenomics, innovative use cases, competitive advantages..."
                    value={formData.additionalNotes}
                    onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                    className="min-h-24 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                  <p className="text-xs text-white/60">
                    {formData.additionalNotes.length}/{config.ui.maxAdditionalNotesLength} characters
                  </p>
                  {errors.additionalNotes && <p className="text-sm text-red-400">{errors.additionalNotes}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Submit Area with Summary */}
            <div className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 backdrop-blur-xl rounded-xl border border-white/20 p-6">
              {/* Summary Row */}
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-6 pb-6 border-b border-white/10">
                {/* Wallet Balance */}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="text-sm">
                    <p className="text-white/50">Balance</p>
                    <p className="font-semibold text-white">
                      {isCheckingBalance ? (
                        <span className="text-white/50">Loading...</span>
                      ) : walletBalance !== null ? (
                        <span className={walletBalance < 0.02 ? 'text-red-400' : 'text-green-400'}>
                          {walletBalance.toFixed(4)} SOL
                        </span>
                      ) : (
                        <span className="text-white/50">Connect wallet</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Creation Fee */}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-sm">
                    <p className="text-white/50">Creation Fee</p>
                    <p className="font-semibold text-white">0.015 SOL</p>
                  </div>
                </div>

                {/* Target Pool */}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="text-sm">
                    <p className="text-white/50">Target Pool</p>
                    <p className="font-semibold text-white">
                      {formData.targetPool ? `${(parseInt(formData.targetPool) / 1e9).toFixed(0)} SOL` : '-'}
                    </p>
                  </div>
                </div>

                {/* Completion */}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-sm">
                    <p className="text-white/50">Form</p>
                    <p className="font-semibold text-white">{Math.round(completionPercentage)}% complete</p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
              {/* Direct Submit Button - Bypass Form */}
              <Button
                type="button"
                disabled={isSubmitting || !isMounted}
                onClick={async (e) => {
                  // Add immediate visual feedback with null check
                  if (e.currentTarget) {
                    e.currentTarget.style.transform = 'scale(0.95)';
                    e.currentTarget.style.transition = 'transform 0.1s ease';
                    
                    setTimeout(() => {
                      if (e.currentTarget) {
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }, 100);
                  }
                  
                  console.log('🚀 DIRECT BUTTON CLICKED!');

                  // Check if wallet is connected
                  if (!primaryWallet) {
                    alert('Please connect your wallet to create a project. You need SOL to pay for transaction fees.');
                    return;
                  }

                  // Check if user has enough SOL BEFORE proceeding
                  const requiredSOL = 0.02; // 0.015 SOL creation fee + buffer for tx fees
                  if (walletBalance !== null && walletBalance < requiredSOL) {
                    showToast({
                      type: 'error',
                      title: '⚠️ Insufficient SOL Balance',
                      message: `You need at least ${requiredSOL} SOL to create a market.`,
                      details: [
                        `💰 Required: ${requiredSOL} SOL (0.015 SOL creation fee + transaction fees)`,
                        `💳 Current Balance: ${walletBalance.toFixed(4)} SOL`,
                        `📥 Click your wallet button to deposit SOL`,
                      ],
                      duration: 8000,
                    });
                    return;
                  }

                  console.log('Form data:', formData);
                  console.log('Primary wallet:', primaryWallet);

                  setIsSubmitting(true);
                  
                  try {
                    // Step 1: Prepare project data for server-side IPFS upload and transaction creation
                    console.log('Preparing project data for server-side processing');
                    
                    // Create FormData to send to the API (which will handle IPFS uploads)
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
                    
                    // Add image file if provided
                    if (formData.projectImage) {
                      apiFormData.append('projectImage', formData.projectImage);
                    }

                    // Add document file if provided
                    if (formData.projectDocument) {
                      apiFormData.append('projectDocument', formData.projectDocument);
                    }

                    // Step 2: Send data to server for IPFS upload and metadata creation
                    console.log('Sending project data to server for IPFS upload and metadata creation');
                    
                    const projectResponse = await fetch('/api/projects/create', {
                      method: 'POST',
                      body: apiFormData,
                    });
                    
                    const projectResult = await projectResponse.json();
                    
                    if (!projectResult.success) {
                      throw new Error(projectResult.error || 'Failed to create project');
                    }
                    
                    console.log('Project created and metadata uploaded to IPFS:', projectResult.data);

                    // Step 3: Prepare transaction for client-side signing
                    console.log('Preparing transaction for client-side wallet signing');

                    const transactionResponse = await fetch('/api/markets/prepare-transaction', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
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
                      throw new Error(transactionResult.error || 'Failed to prepare transaction');
                    }
                    
        console.log('Transaction prepared, now signing with user wallet...');
        
        // Step 4.5: Check Privy authentication state
        console.log('🔍 Privy Authentication Debug:');
        console.log('User object:', user);
        console.log('Authenticated:', authenticated);
        console.log('Primary wallet:', primaryWallet);
        console.log('Wallet address:', primaryWallet?.address);
        console.log('Wallet authenticated:', primaryWallet?.isAuthenticated);

        // Check if user is authenticated
        if (!authenticated || !primaryWallet) {
          console.log('❌ User not authenticated or wallet not connected');
          alert('Please connect your wallet first.');
          setIsSubmitting(false);
          return;
        }

        console.log('✅ User is authenticated, proceeding with transaction signing...');
        
        // Step 4.6: Sign transaction with Privy wallet
        console.log('🔐 Signing transaction with Privy wallet...');

                    let signature;

                    try {
                        // Get serialized transaction from API response
                        const rawTx = transactionResult.data.serializedTransaction;
                        console.log('📊 Serialized transaction length:', rawTx?.length);

                        // Validate that we have transaction data
                        if (!rawTx) {
                            throw new Error('No serializedTransaction provided by server');
                        }

                        // Convert to Buffer for signAndSendTransaction
                        const txBuffer = Buffer.from(rawTx, 'base64');

                        console.log('🔄 Transaction ready for signing and sending');

                        // Get Solana wallet - try external wallets first, then embedded wallets
                        let solanaWallet;
                        if (wallets && wallets.length > 0) {
                          console.log('Using connected external Solana wallet');
                          solanaWallet = wallets[0];
                        } else if (standardWallets && standardWallets.length > 0) {
                          console.log('Using embedded Solana wallet');
                          const privyWallet = standardWallets.find((w: any) => w.isPrivyWallet || w.name === 'Privy');
                          if (!privyWallet) {
                            throw new Error('No Privy wallet found');
                          }
                          solanaWallet = privyWallet;
                        } else {
                          throw new Error('No Solana wallet found');
                        }

                        // Use signAndSendTransaction - works for both external and embedded wallets
                        console.log('✍️📤 Signing and sending transaction with Privy...');
                        const result = await signAndSendTransaction({
                          transaction: txBuffer,
                          wallet: solanaWallet as any,
                          chain: isDevnet() ? 'solana:devnet' : 'solana:mainnet',
                        });

                        // Extract signature from result and convert to base58
                        signature = bs58.encode(result.signature);
                        console.log('✅ Transaction signed and sent:', signature);

                        // Wait for confirmation
                        console.log('⏳ Waiting for transaction confirmation...');
                        const connection = await getSolanaConnection();
                        await connection.confirmTransaction(signature, 'confirmed');
                        console.log('✅ Transaction confirmed on blockchain!');

                    } catch (signerError: unknown) {
                        const errorMessage = signerError instanceof Error ? signerError.message : 'Unknown error';
                        console.log('❌ Transaction failed:', errorMessage);
                        console.error('Full error object:', signerError);

                        // Try to extract more details from the error
                        if (signerError && typeof signerError === 'object') {
                          console.error('Error details:', JSON.stringify(signerError, null, 2));
                        }

                        // Show error to user
                        alert(`Failed to sign/send transaction: ${errorMessage}`);
                        setIsSubmitting(false);
                        return;
                    }

                    console.log('✅ Transaction flow completed!');
                    console.log('✅ Transaction signature:', signature);
                    
                    // Step 4: Complete market creation in database
                    console.log('Completing market creation in database...');
                    
                    const completeMarketResponse = await fetch('/api/markets/complete', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        projectId: projectResult.data.projectId,
                        marketAddress: transactionResult.data.marketPda,
                        signature,
                        ipfsCid: transactionResult.data.ipfsCid,
                        targetPool: formData.targetPool,
                        expiryTime: transactionResult.data.expiryTime,
                      }),
                    });
                    
                    const completeMarketResult = await completeMarketResponse.json();
                    
                    if (!completeMarketResult.success) {
                      throw new Error(completeMarketResult.error || 'Failed to complete market creation');
                    }
                    
                    console.log('✅ Market creation completed:', completeMarketResult.data);
                    
                    // Project and market creation is now complete!
                    
                    console.log('✅ Project and market creation completed successfully!', {
                      projectName: formData.name,
                      marketAddress: transactionResult.data.marketPda,
                      transactionSignature: signature
                    });

                    // Show success toast and redirect
                    showToast({
                      type: 'success',
                      title: `🎉 Project "${formData.name}" and prediction market created successfully!`,
                      message: 'Your prediction market is now live! Community members can vote on whether your project should launch a token.',
                      details: [
                        `🎯 Market Address: ${transactionResult.data.marketPda}`,
                        `🔗 Transaction: ${signature}`,
                        `💰 Target Pool: ${parseInt(formData.targetPool) / 1e9} SOL`,
                        `⏰ Expires: ${new Date(transactionResult.data.expiryTime * 1000).toLocaleString()}`,
                      ],
                      duration: 5000,
                    });

                    // Reset form
                    setFormData(initialFormData);

                    // Redirect to browse page after 2 seconds
                    setTimeout(() => {
                      router.push('/browse');
                    }, 2000);
                    
                  } catch (error) {
                    console.error('Failed to create project', error);
                    showToast({
                      type: 'error',
                      title: 'Failed to create project',
                      message: error instanceof Error ? error.message : 'Unknown error',
                      details: ['Please try again or contact support if the issue persists.'],
                      duration: 5000,
                    });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className={`
                  relative overflow-hidden
                  bg-gradient-to-r from-purple-500 to-pink-500 
                  hover:from-purple-600 hover:to-pink-600 
                  active:from-purple-700 active:to-pink-700
                  text-white px-8 py-3
                  font-semibold text-lg
                  rounded-lg
                  shadow-lg hover:shadow-xl
                  transition-all duration-200 ease-in-out
                  transform hover:scale-105 active:scale-95
                  ${isSubmitting ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                  ${!isMounted ? 'opacity-50' : ''}
                `}
              >
                <span className="relative z-10 flex items-center space-x-2">
                  {isSubmitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  )}
                  <span>
                    {!isMounted ? 'Loading...' : (isSubmitting ? 'Launching Market...' : 'Launch Prediction Market')}
                  </span>
                </span>
                
                {/* Animated background effect */}
                {isSubmitting && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 animate-pulse"></div>
                )}
              </Button>
              </div>
            </div>
              </form>
            </div>
          </div>
        </div>
      </div>
  );
}
