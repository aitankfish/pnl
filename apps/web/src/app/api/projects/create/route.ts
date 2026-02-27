/**
 * API endpoint for creating new projects and prediction markets
 */

import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import { ipfsUtils, ProjectMetadata } from '@/lib/ipfs';
import { createClientLogger } from '@/lib/logger';
import { connectToDatabase, Project } from '@/lib/mongodb';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    logger.info('🚀 API: Starting project creation request');
    
    // Handle both JSON and FormData
    let body;
    const contentType = request.headers.get('content-type');
    
    logger.info('📊 API: Content-Type:', contentType);
    
    if (contentType?.includes('multipart/form-data')) {
      logger.info('📊 API: Processing FormData');
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
      
      logger.info('📊 API: FormData entries:', Object.keys(body));
      
      // Handle file upload
      const imageFile = formData.get('projectImage') as File;
      if (imageFile && imageFile.size > 0) {
        body.projectImage = imageFile;
        logger.info('📊 API: Image file found, size:', imageFile.size);
      }

      // Handle document upload
      const documentFile = formData.get('projectDocument') as File;
      logger.info('📊 API: Document from FormData:', {
        exists: !!documentFile,
        type: typeof documentFile,
        isFile: documentFile instanceof File,
        size: documentFile?.size,
        name: documentFile?.name
      });
      if (documentFile && documentFile.size > 0) {
        body.projectDocument = documentFile;
        logger.info('📊 API: Document file found, size:', documentFile.size);
      }

      // Parse JSON fields
      if (body.socialLinks && typeof body.socialLinks === 'string') {
        logger.info('📊 API: Parsing socialLinks JSON');
        body.socialLinks = JSON.parse(body.socialLinks);
      }
    } else {
      logger.info('📊 API: Processing JSON');
      body = await request.json();
    }
    
    logger.info('📊 API: Request body processed successfully');
    logger.info('Creating new project', {
      projectName: body.name,
      tokenSymbol: body.tokenSymbol
    });

    // Validate required fields
    logger.info('📊 API: Validating required fields');
    const requiredFields = ['name', 'description', 'category', 'projectType', 'projectStage', 'teamSize', 'tokenSymbol', 'marketDuration'];
    for (const field of requiredFields) {
      if (!body[field]) {
        logger.error(`Missing required field: ${field}`);
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }
    logger.info('📊 API: All required fields validated successfully');

    // Check if metadata is already uploaded (from client-side)
    let metadataUri: string;
    let imageUri: string | undefined;
    let documentUri: string | undefined;

    if (body.metadataUri) {
      // Metadata already uploaded by client
      logger.info('Using pre-uploaded metadata URI');
      metadataUri = body.metadataUri;
      imageUri = body.imageUri;
      documentUri = body.documentUri;
    } else {
      // Upload image to IPFS if provided
      if (body.projectImage) {
        logger.info('Uploading project image to IPFS');
        imageUri = await ipfsUtils.uploadImage(body.projectImage);
      }

      // Upload document to IPFS if provided
      if (body.projectDocument) {
        logger.info('Uploading project document to IPFS');
        documentUri = await ipfsUtils.uploadDocument(body.projectDocument);
      }

      // Create project metadata
      const metadata: ProjectMetadata = {
        name: body.name,
        description: body.description,
        category: body.category,
        projectType: body.projectType,
        projectStage: body.projectStage,
        location: body.location || undefined,
        teamSize: parseInt(body.teamSize),
        tokenSymbol: body.tokenSymbol,
        marketDuration: parseInt(body.marketDuration),
        minimumStake: 0.05, // Fixed minimum stake equals YES vote cost
        socialLinks: {
          website: body.socialLinks?.website || undefined,
          github: body.socialLinks?.github || undefined,
          linkedin: body.socialLinks?.linkedin || undefined,
          twitter: body.socialLinks?.twitter || undefined,
          telegram: body.socialLinks?.telegram || undefined,
          discord: body.socialLinks?.discord || undefined,
        },
        videoUrl: body.videoUrl || undefined,
        additionalNotes: body.additionalNotes || undefined,
        image: imageUri,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Upload metadata to IPFS
      logger.info('Uploading project metadata to IPFS');
      metadataUri = await ipfsUtils.uploadProjectMetadata(metadata);
    }

    // Use the provided creator wallet address from the user's connected wallet
    let creatorWalletAddress: string;
    let creatorKeypair: Keypair;
    
    if (body.creatorWalletAddress) {
      creatorWalletAddress = body.creatorWalletAddress;
      logger.info('Using provided creator wallet address:', creatorWalletAddress);
      
      // Generate a temporary keypair for server-side transaction signing
      // In production, this should be handled client-side with wallet signing
      creatorKeypair = Keypair.generate();
      logger.warn('Note: Using generated keypair for server-side signing. In production, implement client-side wallet signing.');
    } else {
      // Fallback: generate a new keypair (old behavior)
      creatorKeypair = Keypair.generate();
      creatorWalletAddress = creatorKeypair.publicKey.toString();
      logger.info('Generated new wallet address:', creatorWalletAddress);
    }

        // This endpoint only handles IPFS uploads and project creation
        // Market creation will be handled separately after client-side signing
        logger.info('📊 API: Creating project and uploading to IPFS (market creation handled separately)');

    // Connect to MongoDB database
    logger.info('📊 API: Connecting to MongoDB database');
    await connectToDatabase();
    logger.info('📊 API: MongoDB connection successful');
    
    // Create project document matching the MongoDB schema
    logger.info('📊 API: Creating project document');
    const projectDoc = new Project({
      founderWallet: creatorWalletAddress,
      name: body.name,
      description: body.description,
      category: body.category,
      projectType: body.projectType,
      projectStage: body.projectStage,
      location: body.location,
      teamSize: parseInt(body.teamSize),
      tokenSymbol: body.tokenSymbol,
      socialLinks: body.socialLinks || {},
      projectImageUrl: imageUri,
      documentUrls: documentUri ? [documentUri] : [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    // Save project to MongoDB
    logger.info('📊 API: Saving project to MongoDB');
    const savedProject = await projectDoc.save();
    logger.info('📊 API: Project saved successfully:', savedProject._id);
    logger.info('Project saved to MongoDB', {
      projectId: savedProject._id,
      name: savedProject.name,
      founderWallet: savedProject.founderWallet
    });
    
    logger.info('Project created successfully', {
      projectId: savedProject._id,
      metadataUri,
      creatorWallet: creatorWalletAddress
    });

    return NextResponse.json({
      success: true,
      data: {
        projectId: savedProject._id,
        metadataUri,
        creatorWallet: creatorWalletAddress,
        projectData: {
          id: savedProject._id,
          name: savedProject.name,
          tokenSymbol: savedProject.tokenSymbol,
          category: savedProject.category,
          status: savedProject.status,
          createdAt: savedProject.createdAt
        }
      }
    });

  } catch (error) {
    logger.error('❌ API: Failed to create project:', error);
    logger.error('❌ API: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PLP Project Creation API',
    endpoints: {
      POST: 'Create a new project and prediction market',
      GET: 'Get API information'
    },
    requiredFields: [
      'name',
      'description', 
      'category',
      'projectType',
      'projectStage',
      'teamSize',
      'tokenSymbol',
      'marketDuration'
    ],
    optionalFields: [
      'location',
      'minimumStake',
      'socialLinks',
      'additionalNotes'
    ]
  });
}
