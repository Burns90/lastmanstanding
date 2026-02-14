import { NextRequest, NextResponse } from 'next/server';

/**
 * DEBUG ENDPOINT: Test football-data.org API connection and list available competitions
 * GET /api/debug/test-football-api
 */
export async function GET(_request: NextRequest) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey || apiKey === 'dummy_key_replace_with_real_key') {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 400 }
    );
  }

  try {
    // Test 1: Get all available competitions
    console.log('Testing: Fetch all competitions...');
    const competitionsRes = await fetch(
      'https://api.football-data.org/v4/competitions',
      {
        headers: {
          'X-Auth-Token': apiKey,
        },
      }
    );

    if (!competitionsRes.ok) {
      return NextResponse.json(
        {
          error: `Competitions endpoint failed: ${competitionsRes.status}`,
          message: await competitionsRes.text(),
        },
        { status: competitionsRes.status }
      );
    }

    const competitionsData = await competitionsRes.json();

    // Test 2: Try a specific competition (PL = 39)
    console.log('Testing: Fetch Premier League (ID 39) details...');
    const plRes = await fetch(
      'https://api.football-data.org/v4/competitions/39',
      {
        headers: {
          'X-Auth-Token': apiKey,
        },
      }
    );

    let plData = null;
    if (plRes.ok) {
      plData = await plRes.json();
    } else {
      console.warn(`PL request failed: ${plRes.status}`);
    }

    // Test 3: Try to get PL teams
    console.log('Testing: Fetch Premier League teams...');
    const teamsRes = await fetch(
      'https://api.football-data.org/v4/competitions/39/teams',
      {
        headers: {
          'X-Auth-Token': apiKey,
        },
      }
    );

    let teamsData = null;
    let teamsError = null;
    if (teamsRes.ok) {
      teamsData = await teamsRes.json();
    } else {
      teamsError = await teamsRes.text();
      console.error(`Teams request failed: ${teamsRes.status}`, teamsError);
    }

    return NextResponse.json({
      success: true,
      apiKeyConfigured: !!apiKey,
      tests: {
        competitions: {
          status: competitionsRes.status,
          count: competitionsData.competitions?.length || 0,
          competitions: competitionsData.competitions
            ?.slice(0, 20)
            ?.map((c: any) => ({
              id: c.id,
              name: c.name,
              code: c.code,
              type: c.type,
              currentSeason: c.currentSeason?.id,
            })),
        },
        premierLeague: {
          status: plRes.status,
          data: plData
            ? {
                id: plData.id,
                name: plData.name,
                code: plData.code,
                type: plData.type,
                currentSeason: plData.currentSeason,
              }
            : null,
        },
        premierLeagueTeams: {
          status: teamsRes.status,
          error: teamsError,
          teamCount: teamsData?.teams?.length || 0,
          teams: teamsData?.teams
            ?.slice(0, 5)
            ?.map((t: any) => ({
              id: t.id,
              name: t.name,
              shortName: t.shortName,
            })),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unknown error', stack: error.stack },
      { status: 500 }
    );
  }
}
