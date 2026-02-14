import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isLeagueOwner } from '@/lib/firebase-server';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * GET /api/leagues/[leagueId]/rounds/[roundId]/fixtures
 * Get all fixtures for a round
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { leagueId: string; roundId: string } }
) {
  try {
    const { leagueId, roundId } = params;

    if (!leagueId || !roundId) {
      return NextResponse.json(
        { error: 'Missing leagueId or roundId' },
        { status: 400 }
      );
    }

    // Get all fixtures for this round
    const fixturesSnapshot = await getDocs(
      collection(db, 'leagues', leagueId, 'rounds', roundId, 'fixtures')
    );

    const fixtures = fixturesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        homeTeamId: data.homeTeamId,
        homeTeamName: data.homeTeamName,
        awayTeamId: data.awayTeamId,
        awayTeamName: data.awayTeamName,
        kickoffTime: data.kickoffTime,
        status: data.status || 'SCHEDULED',
        homeScore: data.homeScore || null,
        awayScore: data.awayScore || null,
      };
    });

    return NextResponse.json({
      fixtures: fixtures.sort((a, b) => 
        new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()
      ),
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/rounds/[roundId]/fixtures
 * Create a new fixture for a round
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { leagueId: string; roundId: string } }
) {
  try {
    // Verify authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { uid } = authResult;

    const { leagueId, roundId } = params;

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
        { error: 'Only league owner can create fixtures' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      homeTeamId,
      homeTeamName,
      awayTeamId,
      awayTeamName,
      kickoffTime,
    } = body;

    if (!homeTeamId || !awayTeamId || !kickoffTime) {
      return NextResponse.json(
        { error: 'Missing required fixture fields' },
        { status: 400 }
      );
    }

    // Verify round exists and is OPEN or LOCKED
    const roundRef = doc(db, 'leagues', leagueId, 'rounds', roundId);
    const roundSnap = await getDoc(roundRef);
    if (!roundSnap.exists()) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    const roundData = roundSnap.data();
    if (roundData.status === 'VALIDATED') {
      return NextResponse.json(
        { error: 'Cannot add fixtures to validated round' },
        { status: 400 }
      );
    }

    // Create fixture
    const fixtureRef = await addDoc(
      collection(db, 'leagues', leagueId, 'rounds', roundId, 'fixtures'),
      {
        homeTeamId,
        homeTeamName,
        awayTeamId,
        awayTeamName,
        kickoffTime: new Date(kickoffTime),
        status: 'SCHEDULED',
        homeScore: null,
        awayScore: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
    );

    return NextResponse.json({
      fixture: {
        id: fixtureRef.id,
        homeTeamId,
        homeTeamName,
        awayTeamId,
        awayTeamName,
        kickoffTime,
        status: 'SCHEDULED',
        homeScore: null,
        awayScore: null,
      },
    });
  } catch (error) {
    console.error('Error creating fixture:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create fixture: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/leagues/[leagueId]/rounds/[roundId]/fixtures
 * Update fixture results (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { leagueId: string; roundId: string } }
) {
  try {
    // Verify authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { uid } = authResult;

    const { leagueId, roundId } = params;

    // Check admin permission
    const isOwner = await isLeagueOwner(leagueId, uid);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only league owner can update fixtures' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fixtureId, homeScore, awayScore, status } = body;

    if (!fixtureId) {
      return NextResponse.json(
        { error: 'Missing fixtureId' },
        { status: 400 }
      );
    }

    const fixtureRef = doc(
      db,
      'leagues',
      leagueId,
      'rounds',
      roundId,
      'fixtures',
      fixtureId
    );

    const updates: any = {
      updatedAt: Timestamp.now(),
    };

    if (homeScore !== undefined) {
      updates.homeScore = homeScore;
    }
    if (awayScore !== undefined) {
      updates.awayScore = awayScore;
    }
    if (status) {
      updates.status = status;
    }

    await updateDoc(fixtureRef, updates);

    return NextResponse.json({
      success: true,
      message: 'Fixture updated successfully',
    });
  } catch (error) {
    console.error('Error updating fixture:', error);
    return NextResponse.json(
      { error: 'Failed to update fixture' },
      { status: 500 }
    );
  }
}
