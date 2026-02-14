import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isLeagueOwner, recalculateEliminationsForUser } from '@/lib/firebase-server';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AdminOverride } from '@/../../shared/types';

/**
 * Reverse/delete an override
 * POST /api/selections/reverse-override
 * Body: { leagueId: string, roundId: string, overrideId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { uid } = authResult;

    // Parse request body
    const { leagueId, roundId, overrideId } = await request.json();

    if (!leagueId || !roundId || !overrideId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check admin permission
    const isOwner = await isLeagueOwner(leagueId, uid);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only league owner can reverse overrides' },
        { status: 403 }
      );
    }

    // Get override to find user
    const overrideRef = doc(
      db,
      'leagues',
      leagueId,
      'rounds',
      roundId,
      'adminOverrides',
      overrideId
    );
    const overrideSnap = await getDoc(overrideRef);
    if (!overrideSnap.exists()) {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }

    const override = overrideSnap.data() as AdminOverride;

    // Delete override
    await deleteDoc(overrideRef);

    // Recalculate eliminations for the user
    await recalculateEliminationsForUser(leagueId, override.userId);

    return NextResponse.json({
      success: true,
      message: 'Override reversed successfully',
    });
  } catch (error: any) {
    console.error('Reverse override error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reverse override' },
      { status: 500 }
    );
  }
}
