// Mock Football API Provider
// In production, replace with real API (e.g., api-football.com, football-data.org, etc.)

import { Fixture } from "@/../../shared/types";

export interface FootballDataProvider {
  getFixtures(startDate: Date, endDate: Date): Promise<Fixture[]>;
  getFixtureById(externalId: string): Promise<Fixture | null>;
  updateFixtureScore(externalId: string): Promise<Fixture | null>;
}

// Mock implementation - returns sample fixtures
class MockFootballProvider implements FootballDataProvider {
  private fixtures: Map<string, Fixture> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 7); // Start from a week ago

    const teams = [
      { id: "1", name: "Manchester United" },
      { id: "2", name: "Liverpool" },
      { id: "3", name: "Manchester City" },
      { id: "4", name: "Chelsea" },
      { id: "5", name: "Arsenal" },
      { id: "6", name: "Tottenham" },
    ];

    let fixtureId = 1;

    // Generate mock fixtures for the next 30 days
    for (let day = 0; day < 30; day += 3) {
      const kickoffTime = new Date(baseDate);
      kickoffTime.setDate(kickoffTime.getDate() + day);
      kickoffTime.setHours(15, 0, 0, 0);

      for (let i = 0; i < 3; i++) {
        const homeIdx = (i * 2) % teams.length;
        const awayIdx = (i * 2 + 1) % teams.length;

        const fixture: Fixture = {
          externalId: `fixture-${fixtureId}`,
          homeTeamId: teams[homeIdx].id,
          homeTeamName: teams[homeIdx].name,
          awayTeamId: teams[awayIdx].id,
          awayTeamName: teams[awayIdx].name,
          kickoffTime: new Date(kickoffTime),
          status: kickoffTime < new Date() ? "FINISHED" : "SCHEDULED",
          homeScore: kickoffTime < new Date() ? Math.floor(Math.random() * 5) : undefined,
          awayScore: kickoffTime < new Date() ? Math.floor(Math.random() * 5) : undefined,
        };

        this.fixtures.set(`fixture-${fixtureId}`, fixture);
        fixtureId++;
      }
    }
  }

  async getFixtures(startDate: Date, endDate: Date): Promise<Fixture[]> {
    return Array.from(this.fixtures.values()).filter(
      (f) => f.kickoffTime >= startDate && f.kickoffTime <= endDate
    );
  }

  async getFixtureById(externalId: string): Promise<Fixture | null> {
    return this.fixtures.get(externalId) || null;
  }

  async updateFixtureScore(externalId: string): Promise<Fixture | null> {
    const fixture = this.fixtures.get(externalId);
    if (!fixture) return null;

    // Mock: if fixture is finished, generate random scores if not set
    if (fixture.status === "FINISHED" && !fixture.homeScore) {
      fixture.homeScore = Math.floor(Math.random() * 5);
      fixture.awayScore = Math.floor(Math.random() * 5);
    }

    return fixture;
  }
}

export const footballProvider = new MockFootballProvider();
