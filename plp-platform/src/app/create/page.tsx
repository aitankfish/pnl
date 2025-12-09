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
          <div className="mb-6 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Create New Project
            </h1>
            <p className="text-white/70">
              Fill in the details to launch your project prediction market
            </p>
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
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-white overflow-visible">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription className="text-white/70">
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

                {/* All project metadata in one row - 5 columns */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <div className="space-y-2">
                    <Label className="text-sm">Category *</Label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className={`h-10 w-full bg-white/10 border border-white/20 text-white text-sm rounded-md px-3 py-2 ${errors.category ? 'border-red-500' : ''}`}
                    >
                      <option value="" className="bg-slate-800">Select category</option>
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
                      <optgroup label="Traditional Markets" className="bg-slate-800">
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
                    {errors.category && <p className="text-sm text-red-400">{errors.category}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Type *</Label>
                    <select
                      value={formData.projectType}
                      onChange={(e) => handleInputChange('projectType', e.target.value)}
                      className={`h-10 w-full bg-white/10 border border-white/20 text-white text-sm rounded-md px-3 py-2 ${errors.projectType ? 'border-red-500' : ''}`}
                    >
                      <option value="" className="bg-slate-800">Select type</option>
                      <option value="protocol" className="bg-slate-800">Protocol</option>
                      <option value="application" className="bg-slate-800">Application</option>
                      <option value="platform" className="bg-slate-800">Platform</option>
                      <option value="service" className="bg-slate-800">Service</option>
                      <option value="tool" className="bg-slate-800">Tool</option>
                    </select>
                    {errors.projectType && <p className="text-sm text-red-400">{errors.projectType}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Stage *</Label>
                    <select
                      value={formData.projectStage}
                      onChange={(e) => handleInputChange('projectStage', e.target.value)}
                      className={`h-10 w-full bg-white/10 border border-white/20 text-white text-sm rounded-md px-3 py-2 ${errors.projectStage ? 'border-red-500' : ''}`}
                    >
                      <option value="" className="bg-slate-800">Select stage</option>
                      <option value="idea" className="bg-slate-800">Idea Stage</option>
                      <option value="prototype" className="bg-slate-800">Prototype</option>
                      <option value="mvp" className="bg-slate-800">MVP</option>
                      <option value="beta" className="bg-slate-800">Beta Testing</option>
                      <option value="launched" className="bg-slate-800">Launched</option>
                    </select>
                    {errors.projectStage && <p className="text-sm text-red-400">{errors.projectStage}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm">Location</Label>
                    <Input
                      id="location"
                      placeholder="Location"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="h-10 bg-white/10 border-white/20 text-white text-sm placeholder:text-white/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teamSize" className="text-sm">Team Size *</Label>
                    <Input
                      id="teamSize"
                      type="number"
                      min="1"
                      placeholder="Team size"
                      value={formData.teamSize}
                      onChange={(e) => handleInputChange('teamSize', e.target.value)}
                      className={`h-10 bg-white/10 border-white/20 text-white text-sm placeholder:text-white/50 ${errors.teamSize ? 'border-red-500' : ''}`}
                    />
                    {errors.teamSize && <p className="text-sm text-red-400">{errors.teamSize}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Information - Collapsible */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-white overflow-visible">
              <CardHeader className="cursor-pointer" onClick={() => setIsTokenSectionExpanded(!isTokenSectionExpanded)}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Token & Market Configuration
                      {(formData.tokenSymbol && formData.targetPool && formData.marketDuration) && (
                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </CardTitle>
                    <CardDescription className="text-white/70">
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
                    <Label htmlFor="projectImage">Project Image</Label>
                    <div className="relative flex flex-col items-center">
                      <Input
                        id="projectImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Store file for upload to IPFS
                            setFormData(prev => ({ ...prev, projectImage: file }));
                          }
                        }}
                        className="bg-white/10 border-white/20 text-white text-center file:mx-auto file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 file:cursor-pointer file:leading-none file:flex file:items-center file:justify-center cursor-pointer"
                      />
                      <p className="text-xs text-white/60 mt-2 text-center">
                        Upload a logo or image for your project (required)
                      </p>
                      {formData.projectImage && (
                        <p className="text-xs text-green-400 mt-2 text-center">
                          ✓ {formData.projectImage.name} selected
                        </p>
                      )}
                      {errors.projectImage && <p className="text-sm text-red-400 mt-1 text-center">{String(errors.projectImage)}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectDocument">Project Documentation</Label>
                    <div className="relative flex flex-col items-center">
                      <Input
                        id="projectDocument"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Validate file size (max 10MB)
                            if (file.size > 10 * 1024 * 1024) {
                              alert('Document must be less than 10MB');
                              e.target.value = '';
                              return;
                            }
                            // Store file for upload to IPFS
                            setFormData(prev => ({ ...prev, projectDocument: file }));
                          }
                        }}
                        className="bg-white/10 border-white/20 text-white text-center file:mx-auto file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-500 file:text-white hover:file:bg-teal-600 file:cursor-pointer file:leading-none file:flex file:items-center file:justify-center cursor-pointer"
                      />
                      <p className="text-xs text-white/60 mt-2 text-center">
                        Upload project documentation, whitepaper, or pitch deck (PDF or Word, max 10MB, optional)
                      </p>
                      {formData.projectDocument && (
                        <p className="text-xs text-green-400 mt-2 text-center">
                          ✓ {formData.projectDocument.name} selected
                        </p>
                      )}
                    </div>
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
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-white">
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
                <CardDescription className="text-white/70">
                  Add your project&apos;s social media presence (optional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://yourwebsite.com"
                      value={formData.socialLinks.website}
                      onChange={(e) => handleSocialLinkChange('website', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="github">GitHub</Label>
                    <Input
                      id="github"
                      type="url"
                      placeholder="https://github.com/yourproject"
                      value={formData.socialLinks.github}
                      onChange={(e) => handleSocialLinkChange('github', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      type="url"
                      placeholder="https://linkedin.com/company/yourproject"
                      value={formData.socialLinks.linkedin}
                      onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input
                      id="twitter"
                      type="url"
                      placeholder="https://twitter.com/yourproject"
                      value={formData.socialLinks.twitter}
                      onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram">Telegram</Label>
                    <Input
                      id="telegram"
                      type="url"
                      placeholder="https://t.me/yourproject"
                      value={formData.socialLinks.telegram}
                      onChange={(e) => handleSocialLinkChange('telegram', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord">Discord</Label>
                    <Input
                      id="discord"
                      type="url"
                      placeholder="https://discord.gg/yourproject"
                      value={formData.socialLinks.discord}
                      onChange={(e) => handleSocialLinkChange('discord', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What This Project Has to Offer */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-white">
              <CardHeader>
                <CardTitle>What This Project Has to Offer</CardTitle>
                <CardDescription className="text-white/70">
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

            {/* Submit Buttons */}
            <div className="flex justify-center space-x-4 pt-6">
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
              </form>
            </div>
          </div>
        </div>
      </div>
  );
}
