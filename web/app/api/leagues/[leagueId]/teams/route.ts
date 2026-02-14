import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

/**
 * GET /api/leagues/[leagueId]/teams
 * Get all teams saved for a league
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;
    console.log(`[Teams API] Fetching teams for league: ${leagueId}`);

    const teamsRef = collection(db, 'leagues', leagueId, 'teams');
    const snapshot = await getDocs(teamsRef);

    console.log(`[Teams API] Found ${snapshot.docs.length} teams`);

    const teams = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ teams }, { status: 200 });
  } catch (error: any) {
    console.error('[Teams API] Error fetching league teams:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}
