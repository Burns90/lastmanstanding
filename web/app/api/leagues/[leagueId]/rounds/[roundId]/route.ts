import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * GET /api/leagues/[leagueId]/rounds/[roundId]
 * Get a specific round with its fixtures
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

    // Get round details
    const roundDocRef = doc(db, 'leagues', leagueId, 'rounds', roundId);
    const roundDoc = await getDoc(roundDocRef);

    if (!roundDoc.exists()) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = {
      id: roundDoc.id,
      ...roundDoc.data(),
    } as any;

    // Get league to get competition code
    const leagueDocRef = doc(db, 'leagues', leagueId);
    const leagueDoc = await getDoc(leagueDocRef);

    if (!leagueDoc.exists()) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      );
    }

    const league = leagueDoc.data();

    // Fetch fixtures for this competition from the API
    let fixtures = [];
    try {
      const fixturesRes = await fetch(
        `${new URL(request.url).origin}/api/competitions/${league.competitionCode}/fixtures?limit=100`
      );
      if (fixturesRes.ok) {
        const fixturesData = await fixturesRes.json();
        
        // Filter fixtures that fall within this round's window
        const startTime = round.startDateTime.toDate();
        const lockTime = round.lockDateTime.toDate();
        
        fixtures = fixturesData.fixtures.filter((fixture: any) => {
          const fixtureTime = new Date(fixture.utcDate);
          return fixtureTime >= startTime && fixtureTime <= lockTime;
        });
      }
    } catch (error) {
      console.error('Error fetching fixtures:', error);
    }

    return NextResponse.json({
      success: true,
      leagueId,
      round,
      league: {
        id: leagueId,
        name: league.name,
        competitionCode: league.competitionCode,
        competitionName: league.competitionName,
      },
      fixtures,
      fixtureCount: fixtures.length,
    });
  } catch (error: any) {
    console.error('Get round error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch round' },
      { status: 500 }
    );
  }
}
