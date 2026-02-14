/**
 * Football competitions available for selection
 * Curated list of major leagues and tournaments that update yearly
 * IDs are from football-data.org v4 API
 */

export const AVAILABLE_COMPETITIONS = [
  {
    id: 'PL',
    name: 'Premier League',
    code: 'PL',
    country: 'England',
    type: 'league',
    externalId: '2021', // football-data.org v4 ID
  },
  {
    id: 'PD',
    name: 'La Liga',
    code: 'PD',
    country: 'Spain',
    type: 'league',
    externalId: '2014',
  },
  {
    id: 'SA',
    name: 'Serie A',
    code: 'SA',
    country: 'Italy',
    type: 'league',
    externalId: '2019',
  },
  {
    id: 'BL1',
    name: 'Bundesliga',
    code: 'BL1',
    country: 'Germany',
    type: 'league',
    externalId: '2002',
  },
  {
    id: 'FL1',
    name: 'Ligue 1',
    code: 'FL1',
    country: 'France',
    type: 'league',
    externalId: '2015',
  },
  {
    id: 'PPL',
    name: 'Primeira Liga',
    code: 'PPL',
    country: 'Portugal',
    type: 'league',
    externalId: '2017',
  },
  {
    id: 'CL',
    name: 'UEFA Champions League',
    code: 'CL',
    country: 'Europe',
    type: 'tournament',
    externalId: '2001',
  },
  {
    id: 'ELC',
    name: 'Championship',
    code: 'ELC',
    country: 'England',
    type: 'league',
    externalId: '2016',
  },
  {
    id: 'WC',
    name: 'FIFA World Cup',
    code: 'WC',
    country: 'World',
    type: 'tournament',
    externalId: '2000',
  },
  {
    id: 'EC',
    name: 'European Championship',
    code: 'EC',
    country: 'Europe',
    type: 'tournament',
    externalId: '2018',
  },
  {
    id: 'CLI',
    name: 'Copa Libertadores',
    code: 'CLI',
    country: 'South America',
    type: 'tournament',
    externalId: '2152',
  },
  {
    id: 'BSA',
    name: 'Campeonato Brasileiro Série A',
    code: 'BSA',
    country: 'Brazil',
    type: 'league',
    externalId: '2013',
  },
  {
    id: 'DED',
    name: 'Eredivisie',
    code: 'DED',
    country: 'Netherlands',
    type: 'league',
    externalId: '2003',
  },
];

export interface Competition {
  id: string;
  name: string;
  code: string;
  country: string;
  type: 'league' | 'tournament';
  externalId: string;
}

export interface Team {
  id: string;
  externalId: string;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
  address?: string;
  website?: string;
  founded?: number;
}
