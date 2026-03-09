/**
 * POST /api/projects/[id]/pitch-video — Upload or replace pitch video
 * DELETE /api/projects/[id]/pitch-video — Remove pitch video
 *
 * Both endpoints verify the caller is the project founder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ipfsUtils } from '@/lib/ipfs';
import { connectToDatabase, Project } from '@/lib/mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const projectId = params.id;

    const formData = await request.formData();
    const walletAddress = formData.get('walletAddress') as string;
    const videoFile = formData.get('pitchVideo') as File;

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'walletAddress is required' },
        { status: 400 },
      );
    }
    if (!videoFile || videoFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'pitchVideo file is required' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }

    if (project.founderWallet !== walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Only the project founder can update the pitch video' },
        { status: 403 },
      );
    }

    // Upload new video to IPFS
    const pitchVideoUrl = await ipfsUtils.uploadVideo(videoFile);

    // Update project in database
    project.pitchVideoUrl = pitchVideoUrl;
    project.updatedAt = new Date();
    await project.save();

    return NextResponse.json({
      success: true,
      data: { pitchVideoUrl },
    });
  } catch (error) {
    console.error('Failed to update pitch video:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update pitch video',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const projectId = params.id;
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'walletAddress is required' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }

    if (project.founderWallet !== walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Only the project founder can delete the pitch video' },
        { status: 403 },
      );
    }

    // Clear the pitch video URL
    project.pitchVideoUrl = undefined;
    project.updatedAt = new Date();
    await project.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete pitch video:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete pitch video',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
