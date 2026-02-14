import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * GET /api/leagues/[leagueId]/participants/[userId]
 * Get a specific participant's data for a league
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueId: string; userId: string }> }
) {
  try {
    const { leagueId, userId } = await params;

    const participantDoc = await getDoc(
      doc(db, 'leagues', leagueId, 'participants', userId)
    );

    if (!participantDoc.exists()) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participant = {
      id: participantDoc.id,
      ...participantDoc.data(),
    };

    return NextResponse.json({ participant }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching participant:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch participant' },
      { status: 500 }
    );
  }
}
