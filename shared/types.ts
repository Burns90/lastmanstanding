// ============================================================================
// FIRESTORE SCHEMA TYPES
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// Type alias for cleaner code
export type FirebaseTimestamp = Timestamp;

// ============================================================================
// USERS
// ============================================================================
export interface User {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  photoURL?: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

// ============================================================================
// LEAGUES
// ============================================================================
export interface League {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  status: LeagueStatus;
  timeZone: string; // e.g., "Europe/London"
  currentRoundId?: string;
  fixtureWindow?: FixtureWindowConfig;
  leagueCode: string; // Unique code to join league (e.g., "ABC123")
  blockInviteJoin?: boolean; // If true, players cannot join via invite code
  // Football competition info
  competitionId?: string; // External API ID (e.g., from football-data.org)
  competitionName?: string; // e.g., "Premier League", "World Cup 2026"
  competitionCode?: string; // e.g., "PL", "WC"
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export type LeagueStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";

export interface FixtureWindowConfig {
  // Admin configurable window for determining which fixtures apply to round
  startOffsetMinutes: number; // e.g., -24 hours before round lock
  endOffsetMinutes: number;   // e.g., at round lock
}

// ============================================================================
// ROUNDS
// ============================================================================
export interface Round {
  id: string;
  leagueId: string;
  number: number;
  status: RoundStatus;
  startDateTime: FirebaseTimestamp; // In league owner's timezone, stored as UTC
  lockDateTime: FirebaseTimestamp;  // In league owner's timezone, stored as UTC
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export type RoundStatus = "OPEN" | "LOCKED" | "VALIDATED";

// ============================================================================
// LEAGUE PARTICIPANTS
// ============================================================================
export interface LeagueParticipant {
  id: string;
  leagueId: string;
  userId: string;
  email?: string;
  displayName?: string;
  eliminated: boolean;
  eliminatedAtRound?: number;
  eliminatedReason?: EliminationReason;
  joinedAt: FirebaseTimestamp;
}

export type EliminationReason = "LOSS" | "NO_PICK" | "ADMIN";

// ============================================================================
// SELECTIONS (User picks per round)
// ============================================================================
export interface Selection {
  id: string;
  leagueId: string;
  roundId: string;
  userId: string;
  selectedTeamId: string;
  selectedTeamName: string;
  fixtureId: string;
  fixtureStartTime: FirebaseTimestamp;
  result?: SelectionResult;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export type SelectionResult = "WIN" | "LOSS" | "DRAW";

// ============================================================================
// TEAMS
// ============================================================================
export interface Team {
  id: string; // Local unique ID for this league
  externalId?: string; // football-data.org ID
  competitionCode: string; // e.g., "PL", "PD"
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
  address?: string;
  website?: string;
  founded?: number;
  manuallyAdded?: boolean; // If true, this was manually added by admin
  createdAt?: FirebaseTimestamp;
}

// ============================================================================
// ADMIN OVERRIDES
// ============================================================================
export interface AdminOverride {
  id: string;
  leagueId: string;
  roundId: string;
  selectionId: string;
  userId: string;
  originalResult?: SelectionResult;
  overrideResult: SelectionResult;
  reason: string;
  createdBy: string; // admin uid
  createdAt: FirebaseTimestamp;
}

// ============================================================================

// LEAGUE WINNERS
// ============================================================================
export interface LeagueWinner {
  id: string;
  leagueId: string;
  userId: string;
  createdAt: FirebaseTimestamp;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================
export interface Notification {
  id: string;
  leagueId: string;
  userId: string; // One record per user
  type: NotificationType;
  title: string;
  message: string;
  deepLink?: string;
  read: boolean;
  sentAt: FirebaseTimestamp;
}

export type NotificationType = 
  | "ROUND_OPENED"
  | "ROUND_LOCKED"
  | "ELIMINATED"
  | "LEAGUE_WINNER"
  | "ADMIN_MESSAGE";

// ============================================================================
// FOOTBALL DATA PROVIDER INTERFACE
// ============================================================================
export interface FootballDataProvider {
  getFixtures(leagueId: string, startUTC: Date, endUTC: Date): Promise<Fixture[]>;
  getFixtureById(externalFixtureId: string): Promise<Fixture | null>;
}

export interface Fixture {
  externalId: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  kickoffTime: Date;
  status: FixtureStatus;
  homeScore?: number;
  awayScore?: number;
}

export type FixtureStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED";
