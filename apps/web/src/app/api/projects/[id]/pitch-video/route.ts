/**
 * POST /api/projects/[id]/pitch-video — Upload or replace pitch video
 * DELETE /api/projects/[id]/pitch-video — Remove pitch video
 *
 * Videos are uploaded to Cloudflare Stream for adaptive bitrate CDN delivery.
 * The [id] param can be either a Project _id OR a PredictionMarket _id.
 * Both endpoints verify the caller is the project founder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadToStream, deleteFromStream, isStreamUrl, extractStreamUid } from '@/lib/cloudflare-stream';
import { connectToDatabase, Project, PredictionMarket } from '@/lib/mongodb';
import { verifyAuth } from '@/lib/auth/privy-server';

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

/**
 * Resolve the Project document from an id that could be either a Project _id
 * or a PredictionMarket _id (which is what the mobile app passes).
 */
async function resolveProject(id: string) {
  if (!isValidObjectId(id)) return null;

  // Try as Project _id first
  let project = await Project.findById(id);
  if (project) return project;

  // Fall back: treat id as a PredictionMarket _id and follow its projectId
  const market = await PredictionMarket.findById(id).select('projectId').lean();
  if (market && (market as any).projectId) {
    project = await Project.findById((market as any).projectId);
  }
  return project;
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id;

    // Verify founder via JWT auth
    const authUser = await verifyAuth(request);
    if (!authUser?.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    const walletAddress = authUser.walletAddress;

    const formData = await request.formData();
    const videoFile = formData.get('pitchVideo') as File;
    if (!videoFile || videoFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'pitchVideo file is required' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const project = await resolveProject(id);
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

    // Delete old video from Cloudflare Stream if replacing
    if (project.pitchVideoUrl && isStreamUrl(project.pitchVideoUrl)) {
      const oldUid = extractStreamUid(project.pitchVideoUrl);
      if (oldUid) {
        try {
          await deleteFromStream(oldUid);
        } catch (err) {
          console.warn('Failed to delete old Stream video (continuing):', err);
        }
      }
    }

    // Upload new video to Cloudflare Stream
    const { playbackUrl, uid } = await uploadToStream(videoFile);

    // Update project in database
    project.pitchVideoUrl = playbackUrl;
    project.pitchVideoStreamUid = uid;
    project.updatedAt = new Date();
    await project.save();

    return NextResponse.json({
      success: true,
      data: { pitchVideoUrl: playbackUrl },
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

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id;
    // Verify founder via JWT auth
    const authUser = await verifyAuth(request);
    if (!authUser?.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    const walletAddress = authUser.walletAddress;

    await connectToDatabase();

    const project = await resolveProject(id);
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

    // Delete from Cloudflare Stream
    if (project.pitchVideoUrl && isStreamUrl(project.pitchVideoUrl)) {
      const uid = extractStreamUid(project.pitchVideoUrl);
      if (uid) {
        try {
          await deleteFromStream(uid);
        } catch (err) {
          console.warn('Failed to delete Stream video (continuing):', err);
        }
      }
    }

    // Clear the pitch video URL
    project.pitchVideoUrl = undefined;
    project.pitchVideoStreamUid = undefined;
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
