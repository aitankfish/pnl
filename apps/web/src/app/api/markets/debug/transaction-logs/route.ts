/**
 * Debug API to fetch transaction logs for a specific signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSolanaConnection } from '@/lib/solana';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signature } = body;

    if (!signature) {
      return NextResponse.json(
        { success: false, error: 'Missing signature' },
        { status: 400 }
      );
    }

    const connection = await getSolanaConnection();
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: tx.meta?.logMessages || [],
        err: tx.meta?.err,
        preBalances: tx.meta?.preBalances,
        postBalances: tx.meta?.postBalances,
        accountKeys: tx.transaction.message.getAccountKeys().staticAccountKeys.map(k => k.toBase58()),
      },
    });

  } catch (error) {
    console.error('Failed to fetch transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
