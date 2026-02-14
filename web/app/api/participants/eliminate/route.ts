import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isLeagueOwner } from '@/lib/firebase-server';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LeagueParticipant, Notification } from '@/../../shared/types';

/**
 * Manually eliminate a participant
 * POST /api/participants/eliminate
 * Body: { leagueId: string, participantId: string, roundNumber: number }
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
    const { leagueId, participantId, roundNumber } = await request.json();

    if (!leagueId || !participantId || roundNumber === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check admin permission
    const isOwner = await isLeagueOwner(leagueId, uid);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only league owner can eliminate players' },
        { status: 403 }
      );
    }

    // Get participant
    const participantRef = doc(
      db,
      'leagues',
      leagueId,
      'participants',
      participantId
    );
    const participantSnap = await getDoc(participantRef);

    if (!participantSnap.exists()) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participantData = participantSnap.data() as LeagueParticipant;

    // Update participant
    await updateDoc(participantRef, {
      eliminated: true,
      eliminatedAtRound: roundNumber,
      eliminatedReason: 'ADMIN',
    });

    // Send notification
    const notificationRef = doc(collection(db, 'notifications'));
    await setDoc(notificationRef, {
      id: notificationRef.id,
      leagueId,
      userId: participantData.userId,
      type: 'ELIMINATED',
      title: "You've been eliminated",
      message: `You were manually eliminated by the league admin in Round ${roundNumber}.`,
      read: false,
      sentAt: Timestamp.now(),
    } as Notification);

    return NextResponse.json({
      success: true,
      message: 'Player eliminated successfully',
    });
  } catch (error: any) {
    console.error('Eliminate participant error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to eliminate participant' },
      { status: 500 }
    );
  }
}
