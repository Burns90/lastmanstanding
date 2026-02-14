import { NextRequest, NextResponse } from 'next/server';
import { AVAILABLE_COMPETITIONS } from '@/lib/competitions';

/**
 * GET /api/competitions/[competitionCode]/fixtures
 * Fetch upcoming fixtures for a competition from football-data.org
 * 
 * Query params:
 * - status: SCHEDULED, LIVE, FINISHED, CANCELLED (default: SCHEDULED,LIVE)
 * - limit: number of fixtures to return (default: 30, max: 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ competitionCode: string }> }
) {
  try {
    const { competitionCode } = await params;
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status') || 'SCHEDULED,LIVE';
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);

    // Find competition
    const competition = AVAILABLE_COMPETITIONS.find(
      (c) => c.code === competitionCode.toUpperCase()
    );

    if (!competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey || apiKey === 'dummy_key_replace_with_real_key') {
      // Return mock fixtures for demo
      return NextResponse.json({
        success: true,
        competition,
        fixtures: getMockFixtures(competitionCode),
        source: 'mock_data',
        note: 'Using mock fixtures. Configure FOOTBALL_DATA_API_KEY for real data.',
      });
    }

    try {
      // Fetch from football-data.org API
      const url = new URL(
        `https://api.football-data.org/v4/competitions/${competition.externalId}/matches`
      );
      url.searchParams.append('status', status);
      url.searchParams.append('limit', limit.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'X-Auth-Token': apiKey,
        },
      });

      if (!response.ok) {
        console.warn(
          `Football Data API returned ${response.status} for fixtures. Using mock data.`
        );
        // Fall back to mock data
        return NextResponse.json({
          success: true,
          competition,
          fixtures: getMockFixtures(competitionCode),
          source: 'mock_data',
          count: getMockFixtures(competitionCode).length,
        });
      }

      const data = await response.json();
      const fixtures = data.matches.map((match: any) => ({
        id: match.id.toString(),
        externalId: match.id.toString(),
        competitionCode,
        status: match.status,
        utcDate: match.utcDate,
        homeTeam: {
          id: match.homeTeam.id.toString(),
          name: match.homeTeam.name,
          shortName: match.homeTeam.shortName,
          crest: match.homeTeam.crest,
        },
        awayTeam: {
          id: match.awayTeam.id.toString(),
          name: match.awayTeam.name,
          shortName: match.awayTeam.shortName,
          crest: match.awayTeam.crest,
        },
        score: {
          fullTime: {
            home: match.score?.fullTime?.home,
            away: match.score?.fullTime?.away,
          },
          halfTime: {
            home: match.score?.halfTime?.home,
            away: match.score?.halfTime?.away,
          },
        },
      }));

      return NextResponse.json({
        success: true,
        competition,
        fixtures,
        source: 'live_api',
        count: fixtures.length,
      });
    } catch (error) {
      console.error(`Error fetching fixtures from API:`, error);
      // Fall back to mock
      return NextResponse.json({
        success: true,
        competition,
        fixtures: getMockFixtures(competitionCode),
        source: 'mock_data',
        count: getMockFixtures(competitionCode).length,
      });
    }
  } catch (error: any) {
    console.error('Get fixtures error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}

/**
 * Mock fixtures for testing/demo purposes
 */
function getMockFixtures(competitionCode: string): any[] {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 1); // Start tomorrow

  const mockFixtures: { [key: string]: any[] } = {
    PL: [
      createMockFixture(1, 'Arsenal', 'Manchester City', 0, new Date(baseDate)),
      createMockFixture(2, 'Liverpool', 'Chelsea', 1, new Date(baseDate.getTime() + 2 * 60 * 60 * 1000)),
      createMockFixture(3, 'Manchester United', 'Tottenham', 2, new Date(baseDate.getTime() + 4 * 60 * 60 * 1000)),
      createMockFixture(4, 'Newcastle', 'Brighton', 3, new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000)),
      createMockFixture(5, 'West Ham', 'Aston Villa', 4, new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000)),
    ],
    WC: [
      createMockFixture(101, 'Argentina', 'Brazil', 10, new Date(baseDate)),
      createMockFixture(102, 'France', 'Spain', 11, new Date(baseDate.getTime() + 3 * 60 * 60 * 1000)),
      createMockFixture(103, 'Germany', 'England', 12, new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000)),
    ],
    PD: [
      createMockFixture(201, 'Real Madrid', 'Barcelona', 20, new Date(baseDate)),
      createMockFixture(202, 'Atletico Madrid', 'Valencia', 21, new Date(baseDate.getTime() + 3 * 60 * 60 * 1000)),
      createMockFixture(203, 'Sevilla', 'Real Sociedad', 22, new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000)),
    ],
  };

  return mockFixtures[competitionCode] || [];
}

function createMockFixture(
  id: number,
  homeTeam: string,
  awayTeam: string,
  baseId: number,
  date: Date
): any {
  return {
    id: id.toString(),
    externalId: id.toString(),
    status: 'SCHEDULED',
    utcDate: date.toISOString(),
    homeTeam: {
      id: (baseId * 10 + 1).toString(),
      name: homeTeam,
      shortName: homeTeam.substring(0, 3).toUpperCase(),
      crest: `https://crests.football-data.org/${baseId * 10 + 1}.png`,
    },
    awayTeam: {
      id: (baseId * 10 + 2).toString(),
      name: awayTeam,
      shortName: awayTeam.substring(0, 3).toUpperCase(),
      crest: `https://crests.football-data.org/${baseId * 10 + 2}.png`,
    },
    score: {
      fullTime: { home: null, away: null },
      halfTime: { home: null, away: null },
    },
  };
}
