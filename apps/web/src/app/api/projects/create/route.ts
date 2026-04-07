/**
 * API endpoint for creating new projects and prediction markets
 */

import { NextRequest, NextResponse } from 'next/server';
import { ipfsUtils, ProjectMetadata } from '@/lib/ipfs';
import { uploadToStream } from '@/lib/cloudflare-stream';
import { createClientLogger } from '@/lib/logger';
import { connectToDatabase, Project } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';

const logger = createClientLogger();

export const POST = withAuth(async (request, authUser) => {
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

      // Handle gallery image uploads (up to 3 extra images for Meme projects)
      const galleryImageFiles: File[] = [];
      for (let i = 0; i < 3; i++) {
        const gf = formData.get(`galleryImage${i}`) as File;
        if (gf && gf.size > 0) galleryImageFiles.push(gf);
      }
      if (galleryImageFiles.length > 0) {
        body.galleryImageFiles = galleryImageFiles;
        logger.info('API: Gallery image files found, count:', galleryImageFiles.length);
      }

      // Handle pitch video upload
      const pitchVideoFile = formData.get('pitchVideo') as File;
      if (pitchVideoFile && pitchVideoFile.size > 0) {
        body.pitchVideo = pitchVideoFile;
        logger.info('API: Pitch video file found, size:', pitchVideoFile.size);
      }

      // Handle pre-uploaded pitchVideoUrl
      const pitchVideoUrl = formData.get('pitchVideoUrl') as string;
      if (pitchVideoUrl) {
        body.pitchVideoUrl = pitchVideoUrl;
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
    let pitchVideoUri: string | undefined;
    let galleryImageUris: string[] = [];

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

      // Upload gallery images to IPFS if provided
      if (body.galleryImageFiles && body.galleryImageFiles.length > 0) {
        logger.info('Uploading gallery images to IPFS', { count: body.galleryImageFiles.length });
        galleryImageUris = await Promise.all(
          body.galleryImageFiles.map((file: File) => ipfsUtils.uploadImage(file))
        );
      }

      // Upload pitch video to Cloudflare Stream (CDN with adaptive bitrate)
      if (body.pitchVideo) {
        logger.info('Uploading pitch video to Cloudflare Stream');
        const { playbackUrl } = await uploadToStream(body.pitchVideo);
        pitchVideoUri = playbackUrl;
      } else if (body.pitchVideoUrl) {
        // Use pre-uploaded video URL
        pitchVideoUri = body.pitchVideoUrl;
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
        pitchVideoUrl: pitchVideoUri || undefined,
        additionalNotes: body.additionalNotes || undefined,
        image: imageUri,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Upload metadata to IPFS
      logger.info('Uploading project metadata to IPFS');
      metadataUri = await ipfsUtils.uploadProjectMetadata(metadata);
    }

    // Use the authenticated user's wallet address
    const creatorWalletAddress = authUser.walletAddress;
    logger.info('Using authenticated creator wallet address:', creatorWalletAddress);

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
      galleryImageUrls: galleryImageUris,
      pitchVideoUrl: pitchVideoUri,
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
});

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
