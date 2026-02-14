import { NextRequest, NextResponse } from 'next/server';
import { AVAILABLE_COMPETITIONS } from '@/lib/competitions';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

/**
 * Generate static params for all competitions
 * Required for output: export with dynamic routes
 */
export async function generateStaticParams() {
  return AVAILABLE_COMPETITIONS.map((competition) => ({
    competitionCode: competition.code,
  }));
}

/**
 * Get all teams for a competition
 * Teams are manually managed by the league admin through the manage-teams page.
 * Tries: Manual teams in Firestore → Mock data
 * GET /api/competitions/[competitionCode]/teams
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ competitionCode: string }> }
) {
  try {
    const { competitionCode } = await params;

    // Find the competition
    const competition = AVAILABLE_COMPETITIONS.find(
      (c) => c.code === competitionCode.toUpperCase()
    );

    if (!competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    let teams: any[] = [];

    // Try to fetch manually added teams from Firestore
    try {
      const teamsRef = collection(db, 'competitions', competitionCode, 'teams');
      const snapshot = await getDocs(teamsRef);
      
      if (!snapshot.empty) {
        teams = snapshot.docs.map((doc) => ({
          id: doc.id,
          competitionCode,
          ...doc.data(),
        }));
        
        console.log(`Fetched ${teams.length} manually managed teams for ${competitionCode}`);
        
        return NextResponse.json({
          success: true,
          competition,
          teams,
          source: 'firestore_manual',
        });
      }
    } catch (error) {
      console.warn(`Failed to fetch manual teams from Firestore:`, error);
    }

    // No teams available - require admin to add teams manually
    return NextResponse.json({
      success: true,
      competition,
      teams: [],
      source: 'none',
      note: 'No teams configured for this competition. Add teams via the admin Manage Teams page.',
    });
  } catch (error: any) {
    console.error('Get teams error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

