import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  getDoc,
  doc,
} from 'firebase/firestore';

/**
 * GET /api/leagues/[leagueId]/rounds/[roundId]/selections
 * Get all selections for a round
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ leagueId: string; roundId: string }>;
  }
) {
  try {
    const { leagueId, roundId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const selectionsRef = collection(
      db,
      'leagues',
      leagueId,
      'rounds',
      roundId,
      'selections'
    );

    let q;
    if (userId) {
      q = query(selectionsRef, where('userId', '==', userId));
    } else {
      q = query(selectionsRef);
    }

    const snapshot = await getDocs(q);
    const selections = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      leagueId,
      roundId,
      selections,
      count: selections.length,
    });
  } catch (error: any) {
    console.error('Get selections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch selections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/rounds/[roundId]/selections
 * Create a new selection for current user
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ leagueId: string; roundId: string }>;
  }
) {
  try {
    const { leagueId, roundId } = await params;
    const body = await request.json();
    const { userId, selectedTeamId, selectedTeamName, fixtureId } = body;

    if (!userId || !selectedTeamId || !fixtureId) {
      return NextResponse.json(
        {
          error: 'userId, selectedTeamId, and fixtureId are required',
        },
        { status: 400 }
      );
    }

    // Check if user is still active (not eliminated)
    const participantDocRef = doc(db, 'leagues', leagueId, 'participants', userId);
    const participantDoc = await getDoc(participantDocRef);

    if (!participantDoc.exists()) {
      return NextResponse.json(
        { error: 'User is not a participant in this league' },
        { status: 403 }
      );
    }

    const participant = participantDoc.data();
    if (participant.eliminated) {
      return NextResponse.json(
        { error: 'User has been eliminated from this league' },
        { status: 403 }
      );
    }

    // Check if user already has a selection for this round
    const selectionsRef = collection(
      db,
      'leagues',
      leagueId,
      'rounds',
      roundId,
      'selections'
    );
    const existingQ = query(selectionsRef, where('userId', '==', userId));
    const existing = await getDocs(existingQ);

    if (!existing.empty) {
      return NextResponse.json(
        { error: 'User already has a selection for this round' },
        { status: 409 }
      );
    }

    // Create selection
    const newSelection = {
      userId,
      selectedTeamId,
      selectedTeamName: selectedTeamName || `Team ${selectedTeamId}`,
      fixtureId,
      result: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(selectionsRef, newSelection);

    return NextResponse.json(
      {
        success: true,
        selectionId: docRef.id,
        selection: { id: docRef.id, ...newSelection },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create selection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create selection' },
      { status: 500 }
    );
  }
}
