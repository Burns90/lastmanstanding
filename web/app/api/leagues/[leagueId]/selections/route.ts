import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

/**
 * GET /api/leagues/[leagueId]/selections
 * Get all selections for a league, optionally filtered by userId
 * This gets selections across ALL rounds for comparison
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Get all rounds for the league
    const roundsRef = collection(db, 'leagues', leagueId, 'rounds');
    const roundsSnapshot = await getDocs(roundsRef);

    let allSelections: any[] = [];

    // Get selections from each round
    for (const roundDoc of roundsSnapshot.docs) {
      const selectionsRef = collection(
        db,
        'leagues',
        leagueId,
        'rounds',
        roundDoc.id,
        'selections'
      );

      let q;
      if (userId) {
        q = query(selectionsRef, where('userId', '==', userId));
      } else {
        q = query(selectionsRef);
      }

      const selectionsSnapshot = await getDocs(q);
      const selections = selectionsSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        roundId: roundDoc.id,
        roundNumber: roundDoc.data().number,
      }));

      allSelections = [...allSelections, ...selections];
    }

    return NextResponse.json({ selections: allSelections }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching selections:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch selections' },
      { status: 500 }
    );
  }
}
