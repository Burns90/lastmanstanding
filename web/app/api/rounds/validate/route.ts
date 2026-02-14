import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isLeagueOwner, validateRoundResults } from '@/lib/firebase-server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Round } from '@/../../shared/types';

/**
 * Validate a round: apply fixture results
 * POST /api/rounds/validate
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
        { error: 'Only league owner can validate rounds' },
        { status: 403 }
      );
    }

    // Verify round exists and is locked
    const roundRef = doc(db, 'leagues', leagueId, 'rounds', roundId);
    const roundSnap = await getDoc(roundRef);
    if (!roundSnap.exists()) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    const roundData = roundSnap.data() as Round;
    if (roundData.status !== 'LOCKED') {
      return NextResponse.json(
        { error: 'Round must be locked before validation' },
        { status: 400 }
      );
    }

    // Validate round results
    const { eliminatedCount, processedSelections } = await validateRoundResults(
      leagueId,
      roundId
    );

    return NextResponse.json({
      success: true,
      message: 'Round validated successfully',
      processedSelections,
      eliminatedCount,
    });
  } catch (error: any) {
    console.error('Validate round error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate round' },
      { status: 500 }
    );
  }
}
