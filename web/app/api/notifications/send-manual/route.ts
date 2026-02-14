import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isLeagueOwner } from '@/lib/firebase-server';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LeagueParticipant, Selection, Notification } from '@/../../shared/types';

/**
 * Send manual notification from admin to players
 * POST /api/notifications/send-manual
 * Body: { leagueId: string, audience: "ALL_PLAYERS" | "UNPICKED", roundId?: string, title: string, message: string }
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
    const { leagueId, audience, roundId, title, message } = await request.json();

    if (!leagueId || !audience || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['ALL_PLAYERS', 'UNPICKED'].includes(audience)) {
      return NextResponse.json(
        { error: 'Invalid audience. Must be ALL_PLAYERS or UNPICKED' },
        { status: 400 }
      );
    }

    if (audience === 'UNPICKED' && !roundId) {
      return NextResponse.json(
        { error: 'roundId is required when audience is UNPICKED' },
        { status: 400 }
      );
    }

    // Check admin permission
    const isOwner = await isLeagueOwner(leagueId, uid);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only league owner can send notifications' },
        { status: 403 }
      );
    }

    // Determine target users
    let targetUserIds: string[] = [];

    if (audience === 'ALL_PLAYERS') {
      const participantsQuery = query(
        collection(db, 'leagues', leagueId, 'participants')
      );
      const participantsSnap = await getDocs(participantsQuery);
      targetUserIds = participantsSnap.docs.map(
        (d) => (d.data() as LeagueParticipant).userId
      );
    } else if (audience === 'UNPICKED' && roundId) {
      // Get all active participants
      const participantsQuery = query(
        collection(db, 'leagues', leagueId, 'participants'),
        where('eliminated', '==', false)
      );
      const participantsSnap = await getDocs(participantsQuery);
      const participantIds = participantsSnap.docs.map(
        (d) => (d.data() as LeagueParticipant).userId
      );

      // Get users who already made selections
      const selectionsQuery = query(
        collection(db, 'leagues', leagueId, 'rounds', roundId, 'selections')
      );
      const selectionsSnap = await getDocs(selectionsQuery);
      const selectedUserIds = selectionsSnap.docs.map(
        (d) => (d.data() as Selection).userId
      );

      // Find users without selections
      targetUserIds = participantIds.filter(
        (id) => !selectedUserIds.includes(id)
      );
    }

    // Create notifications
    for (const userId of targetUserIds) {
      const notificationRef = doc(collection(db, 'notifications'));
      await setDoc(notificationRef, {
        id: notificationRef.id,
        leagueId,
        userId,
        type: 'ADMIN_MESSAGE',
        title,
        message,
        read: false,
        sentAt: Timestamp.now(),
      } as Notification);
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${targetUserIds.length} player(s)`,
      recipientCount: targetUserIds.length,
    });
  } catch (error: any) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
