import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { Team } from '@/../../shared/types';
import { verifyAdminToken } from '@/lib/adminAuth';

/**
 * POST: Add a new team to a competition
 * DELETE: Remove a team from a competition
 * GET: List all teams for a competition
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const isAdmin = await verifyAdminToken(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { competitionCode, name, shortName, tla, crest, address, website, founded } = body;

    if (!competitionCode || !name) {
      return NextResponse.json(
        { error: 'competitionCode and name are required' },
        { status: 400 }
      );
    }

    const teamsRef = collection(db, 'competitions', competitionCode, 'teams');
    const newTeam: Omit<Team, 'id'> = {
      competitionCode,
      name,
      shortName: shortName || null,
      tla: tla || null,
      crest: crest || null,
      address: address || null,
      website: website || null,
      founded: founded || null,
      manuallyAdded: true,
      createdAt: new Date() as any,
    };

    const docRef = await addDoc(teamsRef, newTeam);

    return NextResponse.json(
      {
        success: true,
        teamId: docRef.id,
        team: { id: docRef.id, ...newTeam },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Add team error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add team' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const isAdmin = await verifyAdminToken(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const competitionCode = searchParams.get('competitionCode');

    if (!competitionCode) {
      return NextResponse.json(
        { error: 'competitionCode query parameter required' },
        { status: 400 }
      );
    }

    const teamsRef = collection(db, 'competitions', competitionCode, 'teams');
    const snapshot = await getDocs(teamsRef);
    
    const teams = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      competitionCode,
      teams,
      count: teams.length,
    });
  } catch (error: any) {
    console.error('Get teams error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const isAdmin = await verifyAdminToken(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { competitionCode, teamId, leagueId } = body;

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId is required' },
        { status: 400 }
      );
    }

    if (leagueId) {
      // Delete from league teams
      const teamDocRef = doc(db, 'leagues', leagueId, 'teams', teamId);
      await deleteDoc(teamDocRef);
    } else if (competitionCode) {
      // Delete from competition teams (legacy)
      const teamDocRef = doc(db, 'competitions', competitionCode, 'teams', teamId);
      await deleteDoc(teamDocRef);
    } else {
      return NextResponse.json(
        { error: 'leagueId or competitionCode is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete team error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete team' },
      { status: 500 }
    );
  }
}
