import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';

/**
 * GET /api/leagues/[leagueId]/rounds
 * Get all rounds for a league
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;

    const roundsRef = collection(db, 'leagues', leagueId, 'rounds');
    const q = query(roundsRef, orderBy('number', 'asc'));
    const snapshot = await getDocs(q);

    const rounds = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      leagueId,
      rounds,
      count: rounds.length,
    });
  } catch (error: any) {
    console.error('Get rounds error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rounds' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/rounds
 * Create a new round for a league (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;
    const body = await request.json();
    const {
      number,
      startDateTime,
      lockDateTime,
    } = body;

    if (!number || !startDateTime || !lockDateTime) {
      return NextResponse.json(
        {
          error: 'number, startDateTime, and lockDateTime are required',
        },
        { status: 400 }
      );
    }

    // TODO: Add admin verification

    const roundsRef = collection(db, 'leagues', leagueId, 'rounds');
    const newRound = {
      number: parseInt(number),
      status: 'OPEN',
      startDateTime: Timestamp.fromDate(new Date(startDateTime)),
      lockDateTime: Timestamp.fromDate(new Date(lockDateTime)),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(roundsRef, newRound);

    return NextResponse.json(
      {
        success: true,
        roundId: docRef.id,
        round: { id: docRef.id, ...newRound },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create round error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create round' },
      { status: 500 }
    );
  }
}
