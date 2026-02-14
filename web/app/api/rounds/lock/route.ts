import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isLeagueOwner, eliminateNoPicks } from '@/lib/firebase-server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Round } from '@/../../shared/types';

/**
 * Lock a round: no more picks allowed
 * POST /api/rounds/lock
 * Body: { leagueId: string, roundId: string }
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
    const { leagueId, roundId } = await request.json();

    if (!leagueId || !roundId) {
      return NextResponse.json(
        { error: 'Missing leagueId or roundId' },
        { status: 400 }
      );
    }

    // Check admin permission
    const isOwner = await isLeagueOwner(leagueId, uid);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only league owner can lock rounds' },
        { status: 403 }
      );
    }

    // Verify round exists
    const roundRef = doc(db, 'leagues', leagueId, 'rounds', roundId);
    const roundSnap = await getDoc(roundRef);
    if (!roundSnap.exists()) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    const roundData = roundSnap.data() as Round;
    if (roundData.status !== 'OPEN') {
      return NextResponse.json(
        { error: `Round status must be OPEN, currently ${roundData.status}` },
        { status: 400 }
      );
    }

    // Lock the round
    await updateDoc(roundRef, {
      status: 'LOCKED',
      updatedAt: new Date(),
    });

    // Auto-eliminate no-picks
    const { eliminatedCount } = await eliminateNoPicks(leagueId, roundId);

    return NextResponse.json({
      success: true,
      message: `Round locked successfully. ${eliminatedCount} player(s) eliminated for no pick.`,
      eliminatedCount,
    });
  } catch (error: any) {
    console.error('Lock round error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to lock round' },
      { status: 500 }
    );
  }
}
