import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isLeagueOwner, recalculateEliminationsForUser } from '@/lib/firebase-server';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Selection, Round, AdminOverride } from '@/../../shared/types';

/**
 * Override a selection result (before or after validation)
 * POST /api/selections/override
 * Body: { leagueId: string, roundId: string, selectionId: string, overrideResult: "WIN" | "LOSS" | "DRAW", reason: string }
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
    const { leagueId, roundId, selectionId, overrideResult, reason } =
      await request.json();

    if (!leagueId || !roundId || !selectionId || !overrideResult || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate overrideResult
    if (!['WIN', 'LOSS', 'DRAW'].includes(overrideResult)) {
      return NextResponse.json(
        { error: 'Invalid overrideResult. Must be WIN, LOSS, or DRAW' },
        { status: 400 }
      );
    }

    // Check admin permission
    const isOwner = await isLeagueOwner(leagueId, uid);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only league owner can override results' },
        { status: 403 }
      );
    }

    // Get selection
    const selectionRef = doc(
      db,
      'leagues',
      leagueId,
      'rounds',
      roundId,
      'selections',
      selectionId
    );
    const selectionSnap = await getDoc(selectionRef);
    if (!selectionSnap.exists()) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }
    const selection = selectionSnap.data() as Selection;

    // Create override record
    const overrideRef = doc(collection(db, 'leagues', leagueId, 'rounds', roundId, 'adminOverrides'));
    await setDoc(overrideRef, {
      id: overrideRef.id,
      leagueId,
      roundId,
      selectionId,
      userId: selection.userId,
      originalResult: selection.result,
      overrideResult,
      reason,
      createdBy: uid,
      createdAt: Timestamp.now(),
    } as AdminOverride);

    // Get round to check status
    const roundRef = doc(db, 'leagues', leagueId, 'rounds', roundId);
    const roundSnap = await getDoc(roundRef);
    if (!roundSnap.exists()) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    const roundData = roundSnap.data() as Round;

    // If round is already validated, recalculate eliminations
    if (roundData.status === 'VALIDATED') {
      await recalculateEliminationsForUser(leagueId, selection.userId);
    }

    return NextResponse.json({
      success: true,
      message: 'Result override applied',
      overrideId: overrideRef.id,
    });
  } catch (error: any) {
    console.error('Override selection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to override selection' },
      { status: 500 }
    );
  }
}
