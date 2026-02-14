'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { League, Round, Selection } from '@/../../shared/types';
import styles from './league.module.css';

interface RoundWithSelections extends Round {
  selection?: Selection;
}

export default function LeaguePage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.id as string | undefined;
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [rounds, setRounds] = useState<RoundWithSelections[]>([]);
  const [selectedRound, setSelectedRound] = useState<RoundWithSelections | null>(null);
  const [teams, setTeams] = useState<any[]>([]);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [submittingSelection, setSubmittingSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLeagueOwner, setIsLeagueOwner] = useState(false);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [updatingFixture, setUpdatingFixture] = useState<string | null>(null);
  const [fixturesError, setFixturesError] = useState<string | null>(null);

  useEffect(() => {
    console.log('useParams hook - params:', params, 'leagueId:', leagueId);
  }, [params, leagueId]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && leagueId) {
      loadLeagueData();
    } else if (!leagueId) {
      console.warn('LeagueId is undefined - params:', params);
      setError('Invalid league ID');
      setLoading(false);
    }
  }, [user, leagueId]);

  async function loadLeagueData() {
    try {
      setError(null);
      
      if (!leagueId) {
        setError('League ID is missing');
        setLoading(false);
        return;
      }
      
      console.log('Loading league data for ID:', leagueId);
      
      const leagueRef = doc(db, 'leagues', leagueId);
      const leagueDoc = await getDoc(leagueRef);
      console.log('League doc exists:', leagueDoc.exists(), 'Data:', leagueDoc.data());
      
      if (!leagueDoc.exists()) {
        setError(`League not found (ID: ${leagueId})`);
        setLoading(false);
        return;
      }
      const leagueData = {
        ...leagueDoc.data(),
        id: leagueId,
      } as League;
      console.log('Loaded league:', leagueData);
      setLeague(leagueData);
      
      // Check if user is the league owner
      setIsLeagueOwner(user.uid === leagueData.ownerId);

      // Load rounds
      const roundsQuery = query(
        collection(db, 'leagues', leagueId as string, 'rounds')
      );
      const roundsSnapshot = await getDocs(roundsQuery);
      const roundsData = roundsSnapshot.docs
        .map((d) => ({ ...d.data(), id: d.id } as Round))
        .sort((a, b) => a.number - b.number);

      // Load selections for each round
      const roundsWithSelections = await Promise.all(
        roundsData.map(async (round) => {
          const selectionQuery = query(
            collection(db, 'leagues', leagueId as string, 'rounds', round.id, 'selections'),
            where('userId', '==', user.uid)
          );
          const selectionSnapshot = await getDocs(selectionQuery);
          const selection = selectionSnapshot.docs[0]?.data() as Selection | undefined;
          return { ...round, selection };
        })
      );

      setRounds(roundsWithSelections);
      if (roundsWithSelections.length > 0) {
        setSelectedRound(roundsWithSelections[0]);
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading league:', err);
      setError(err.message || 'Failed to load league');
      setLoading(false);
    }
  }

  const fetchTeamsForRound = async () => {
    if (!leagueId || !selectedRound) {
      console.warn('fetchTeamsForRound: leagueId or selectedRound is undefined');
      return;
    }
    try {
      setLoadingTeams(true);
      console.log('Fetching teams for league:', leagueId, 'Round:', selectedRound.number);
      
      // Fetch teams directly from Firestore
      const teamsSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'teams')
      );
      const teamsData = teamsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Get previously selected teams from earlier rounds
      const previouslySelectedTeamIds = new Set<string>();
      rounds.forEach((round) => {
        // Exclude teams from all previous rounds
        if (round.selection?.selectedTeamId && round.number < selectedRound.number) {
          previouslySelectedTeamIds.add(round.selection.selectedTeamId);
          console.log(`Round ${round.number}: Previously selected ${round.selection.selectedTeamId}`);
        }
      });
      
      // Filter out previously selected teams
      const availableTeams = teamsData.filter(
        (team) => !previouslySelectedTeamIds.has(team.id)
      );
      
      console.log('Total teams available:', teamsData.length);
      console.log('Previously selected teams:', Array.from(previouslySelectedTeamIds));
      console.log('Available teams for selection:', availableTeams.length);
      setTeams(availableTeams);
      setSelectedTeamId('');
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleSubmitSelection = async () => {
    if (!selectedTeamId) {
      alert('Please select a team');
      return;
    }

    if (!selectedRound || !user) return;

    try {
      setSubmittingSelection(true);
      const selectedTeam = teams.find((t) => t.id === selectedTeamId);
      
      const response = await fetch(
        `/api/leagues/${leagueId}/rounds/${selectedRound.id}/selections`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            selectedTeamId,
            selectedTeamName: selectedTeam?.name,
          }),
        }
      );

      if (response.ok) {
        setSuccess('Selection submitted successfully!');
        setSelectedTeamId('');
        loadLeagueData();
      } else {
        const error = await response.text();
        alert(`Failed to submit selection: ${error}`);
      }
    } catch (err) {
      console.error('Failed to submit selection:', err);
      alert('Failed to submit selection');
    } finally {
      setSubmittingSelection(false);
    }
  };

  const loadFixturesForRound = async (roundId: string) => {
    if (!leagueId || !isLeagueOwner) return;
    
    try {
      setLoadingFixtures(true);
      setFixturesError(null);
      const fixturesQuery = query(
        collection(db, 'leagues', leagueId, 'rounds', roundId, 'fixtures')
      );
      const fixturesSnapshot = await getDocs(fixturesQuery);
      const fixturesData = fixturesSnapshot.docs.map((d) => ({ 
        ...d.data(), 
        id: d.id 
      }));
      setFixtures(fixturesData);
    } catch (err: any) {
      console.error('Failed to load fixtures:', err);
      setFixturesError(err.message || 'Failed to load fixtures. Please ensure the round has fixtures configured.');
      setFixtures([]);
    } finally {
      setLoadingFixtures(false);
    }
  };

  const handleUpdateFixtureScore = async (fixtureId: string, homeScore: number, awayScore: number) => {
    if (!leagueId || !selectedRound) return;

    try {
      setUpdatingFixture(fixtureId);
      setFixturesError(null);
      const fixtureRef = doc(
        db,
        'leagues',
        leagueId,
        'rounds',
        selectedRound.id,
        'fixtures',
        fixtureId
      );

      await updateDoc(fixtureRef, {
        homeScore,
        awayScore,
        status: 'FINISHED',
        updatedAt: new Date(),
      });

      setSuccess('Fixture result updated!');
      loadFixturesForRound(selectedRound.id);
    } catch (err: any) {
      console.error('Failed to update fixture:', err);
      setFixturesError(err.message || 'Failed to update fixture result');
    } finally {
      setUpdatingFixture(null);
    }
  };

  // Fetch teams when selectedRound changes
  useEffect(() => {
    if (selectedRound && selectedRound.status === 'OPEN' && leagueId) {
      fetchTeamsForRound();
    }
  }, [selectedRound, leagueId]);

  // Load fixtures for league owner
  useEffect(() => {
    if (selectedRound && isLeagueOwner && leagueId) {
      setFixturesError(null);
      loadFixturesForRound(selectedRound.id);
    }
  }, [selectedRound, isLeagueOwner, leagueId]);

  if (loading) {
    return <div className="loading">Loading league</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!league) {
    return <div className="alert alert-danger">League not found</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
            Back
          </button>
          <h1>{league.name}</h1>
          <p>{league.description}</p>
        </div>
        <div className={styles.leagueInfo} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span className="badge badge-primary">{league.status}</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
            {league.timeZone}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => router.push(`/league/${leagueId}/players`)}
              className="btn btn-secondary"
            >
              👥 View Players
            </button>
            {isLeagueOwner && (
              <button
                onClick={() => router.push(`/admin/league/${leagueId}`)}
                className="btn btn-secondary"
              >
                ⚙️ Manage League
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rounds Tabs */}
      <div className={styles.roundsTabs}>
        {rounds.map((round) => (
          <button
            key={round.id}
            onClick={() => setSelectedRound(round)}
            className={`${styles.roundTab} ${
              selectedRound?.id === round.id ? styles.active : ''
            }`}
          >
            <span className={styles.roundNumber}>Round {round.number}</span>
            <span className={styles.roundStatus}>
              {round.status === 'OPEN' && 'Open'}
              {round.status === 'LOCKED' && 'Locked'}
              {round.status === 'VALIDATED' && 'Validated'}
            </span>
            {round.selection && (
              <span className={styles.picked} title="Pick made">
                Joined
              </span>
            )}
          </button>
        ))}
      </div>

      {selectedRound && (
        <div className={styles.roundContent}>
          <div className={styles.roundHeader}>
            <h2>Round {selectedRound.number}</h2>
            <div className={styles.roundDates}>
              <div>
                <small>Opens:</small>
                <div>{new Date(selectedRound.startDateTime.toDate()).toLocaleString()}</div>
              </div>
              <div>
                <small>Locks:</small>
                <div>{new Date(selectedRound.lockDateTime.toDate()).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {selectedRound.selection ? (
            <div className={`card ${styles.selectionCard}`}>
              <h3>Your Selection</h3>
              <div className={styles.selectedTeam}>
                <div className={styles.teamName}>{selectedRound.selection.selectedTeamName}</div>
                <div className={styles.teamStatus}>
                  {selectedRound.selection.result ? (
                    <>
                      <span className={`badge badge-${
                        selectedRound.selection.result === 'WIN' ? 'success' : 'danger'
                      }`}>
                        {selectedRound.selection.result}
                      </span>
                    </>
                  ) : (
                    <span className="badge badge-primary">Pending</span>
                  )}
                </div>
              </div>
            </div>
          ) : selectedRound.status === 'OPEN' ? (
            <div className={`card ${styles.teamSelector}`}>
              <h3>Make Your Selection</h3>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                Choose a team to survive this round
              </p>

              {success && <div className="alert alert-success">{success}</div>}

              {/* Show previously selected teams */}
              {selectedRound && rounds
                .filter(r => r.selection?.selectedTeamId && r.number < selectedRound.number)
                .length > 0 && (
                <div style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '0.5rem',
                  fontSize: '0.9rem',
                  color: 'var(--text-light)'
                }}>
                  <strong style={{ color: 'var(--text)' }}>Previously selected:</strong> {rounds
                    .filter(r => r.selection?.selectedTeamId && r.number < selectedRound.number)
                    .map(r => r.selection?.selectedTeamName)
                    .join(', ')}
                </div>
              )}

              {loadingTeams ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-light)' }}>
                  Loading teams...
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      fontSize: '1rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                    disabled={submittingSelection}
                  >
                    <option value="">-- Select a team --</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSubmitSelection}
                    disabled={!selectedTeamId || submittingSelection}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: selectedTeamId ? 'var(--primary)' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      cursor: selectedTeamId ? 'pointer' : 'not-allowed',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTeamId) {
                        e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTeamId) {
                        e.currentTarget.style.backgroundColor = 'var(--primary)';
                      }
                    }}
                  >
                    {submittingSelection ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`alert alert-warning`}>
              No selection made for this round. Round is now closed.
            </div>
          )}

          {/* Manage Fixtures - League Owner Only */}
          {isLeagueOwner && (
            <div className={`card`} style={{ marginTop: '2rem', borderTop: '2px solid var(--secondary)' }}>
              <h3 style={{ color: 'var(--secondary)', marginBottom: '1.5rem' }}>📊 Manage Fixtures</h3>
              
              {fixturesError && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid var(--danger)',
                  borderRadius: '0.5rem',
                  color: 'var(--danger)',
                  marginBottom: '1rem'
                }}>
                  ⚠️ {fixturesError}
                </div>
              )}

              {loadingFixtures ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-light)' }}>
                  Loading fixtures...
                </div>
              ) : fixturesError ? (
                <div style={{ padding: '1rem', color: 'var(--text-light)', textAlign: 'center' }}>
                  Unable to load fixtures. Please try again or ensure the round is properly configured.
                </div>
              ) : fixtures.length === 0 ? (
                <div style={{ padding: '1rem', color: 'var(--text-light)', textAlign: 'center' }}>
                  No fixtures found for this round
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {fixtures.map((fixture) => (
                    <div
                      key={fixture.id}
                      style={{
                        padding: '1rem',
                        backgroundColor: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                      }}
                    >
                      <div style={{ marginBottom: '1rem' }}>
                        <strong style={{ fontSize: '1.1rem' }}>
                          {fixture.homeTeamName}
                        </strong>
                        <span style={{ margin: '0 1rem', color: 'var(--text-light)' }}>vs</span>
                        <strong style={{ fontSize: '1.1rem' }}>
                          {fixture.awayTeamName}
                        </strong>
                      </div>

                      {fixture.status === 'FINISHED' ? (
                        <div
                          style={{
                            padding: '1rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '0.5rem',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                            {fixture.homeScore} - {fixture.awayScore}
                          </div>
                          <small style={{ color: 'var(--text-light)' }}>Result Recorded</small>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <input
                            type="number"
                            placeholder="Home"
                            defaultValue={fixture.homeScore || 0}
                            id={`home-${fixture.id}`}
                            min="0"
                            style={{
                              width: '70px',
                              padding: '0.5rem',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--card-bg)',
                              color: 'var(--text)',
                            }}
                          />
                          <span style={{ color: 'var(--text-light)' }}>-</span>
                          <input
                            type="number"
                            placeholder="Away"
                            defaultValue={fixture.awayScore || 0}
                            id={`away-${fixture.id}`}
                            min="0"
                            style={{
                              width: '70px',
                              padding: '0.5rem',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--card-bg)',
                              color: 'var(--text)',
                            }}
                          />
                          <button
                            onClick={() => {
                              const homeScore = parseInt(
                                (document.getElementById(`home-${fixture.id}`) as HTMLInputElement)
                                  .value || '0'
                              );
                              const awayScore = parseInt(
                                (document.getElementById(`away-${fixture.id}`) as HTMLInputElement)
                                  .value || '0'
                              );
                              handleUpdateFixtureScore(fixture.id, homeScore, awayScore);
                            }}
                            disabled={updatingFixture === fixture.id}
                            className="btn btn-success"
                            style={{ marginLeft: 'auto' }}
                          >
                            {updatingFixture === fixture.id ? 'Updating...' : 'Record Result'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
