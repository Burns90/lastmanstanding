'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import styles from '../../league.module.css';

export default function AdminRoundDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  const roundId = params.roundId as string;

  const [user, setUser] = useState<any>(null);
  const [round, setRound] = useState<any>(null);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [selections, setSelections] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFixtureForm, setShowFixtureForm] = useState(false);
  const [fixtureFormData, setFixtureFormData] = useState({
    homeTeamId: '',
    homeTeamName: '',
    awayTeamId: '',
    awayTeamName: '',
    kickoffTime: '',
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && leagueId && roundId) {
      loadData();
    }
  }, [user, leagueId, roundId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        console.warn('User not authenticated yet');
        return;
      }

      console.log('Loading data for league:', leagueId, 'round:', roundId);

      // Load round
      const roundRef = doc(db, 'leagues', leagueId, 'rounds', roundId);
      const roundSnap = await getDoc(roundRef);
      if (!roundSnap.exists()) {
        setError('Round not found');
        return;
      }
      setRound({ ...roundSnap.data(), id: roundSnap.id });

      // Load fixtures
      const fixturesSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'rounds', roundId, 'fixtures')
      );
      const fixturesData = fixturesSnapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          homeTeamId: data.homeTeamId,
          homeTeamName: data.homeTeamName,
          awayTeamId: data.awayTeamId,
          awayTeamName: data.awayTeamName,
          kickoffTime: data.kickoffTime,
          status: data.status,
          homeScore: data.homeScore,
          awayScore: data.awayScore,
        };
      });
      setFixtures(
        fixturesData.sort(
          (a: any, b: any) =>
            new Date(a.kickoffTime).getTime() -
            new Date(b.kickoffTime).getTime()
        )
      );

      // Load selections
      const selectionsSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'rounds', roundId, 'selections')
      );
      const selectionsData = selectionsSnapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          selectedTeamId: data.selectedTeamId,
          selectedTeamName: data.selectedTeamName,
          fixtureId: data.fixtureId,
          result: data.result,
        };
      });
      setSelections(selectionsData);

      // Load teams
      console.log('Attempting to load teams from:', `leagues/${leagueId}/teams`);
      const teamsSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'teams')
      );
      const teamsData = teamsSnapshot.docs.map((d) => {
        const teamData = d.data();
        console.log('Team loaded:', d.id, teamData);
        return {
          ...teamData,
          id: d.id,
        };
      });
      console.log('Total teams loaded:', teamsData.length, teamsData);
      setTeams(teamsData);

      if (teamsData.length === 0) {
        console.warn('No teams found in league. Make sure teams were added to:', `leagues/${leagueId}/teams`);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      console.error('Error details:', {
        code: (err as any)?.code,
        message: (err as any)?.message,
        userUID: user?.uid,
        leagueId,
        roundId,
      });
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFixture(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (
      !fixtureFormData.homeTeamId ||
      !fixtureFormData.awayTeamId ||
      !fixtureFormData.kickoffTime
    ) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      console.log('Creating fixture with data:', fixtureFormData);
      
      // Create fixture directly in Firestore (client has auth context)
      const fixtureRef = await addDoc(
        collection(db, 'leagues', leagueId, 'rounds', roundId, 'fixtures'),
        {
          homeTeamId: fixtureFormData.homeTeamId,
          homeTeamName: fixtureFormData.homeTeamName,
          awayTeamId: fixtureFormData.awayTeamId,
          awayTeamName: fixtureFormData.awayTeamName,
          kickoffTime: new Date(fixtureFormData.kickoffTime),
          status: 'SCHEDULED',
          homeScore: null,
          awayScore: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      );

      console.log('Fixture created successfully:', fixtureRef.id);

      setFixtureFormData({
        homeTeamId: '',
        homeTeamName: '',
        awayTeamId: '',
        awayTeamName: '',
        kickoffTime: '',
      });
      setShowFixtureForm(false);
      await loadData();
      alert('Fixture created successfully!');
    } catch (err) {
      console.error('Error creating fixture:', err);
      setError(String(err));
      alert(`Error creating fixture: ${String(err)}`);
    }
  }

  async function handleUpdateFixtureScore(
    fixtureId: string,
    homeScore: number,
    awayScore: number
  ) {
    try {
      const token = await user?.getIdToken();
      const response = await fetch(
        `/api/leagues/${leagueId}/rounds/${roundId}/fixtures`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fixtureId,
            homeScore,
            awayScore,
            status: 'FINISHED',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update fixture score');
      }

      await loadData();
      alert('Fixture score updated!');
    } catch (err) {
      alert(`Error: ${String(err)}`);
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
            Back
          </button>
          <h1>Loading round details...</h1>
        </div>
        <div style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>
          <p>Loading...</p>
          <p style={{fontSize: '0.85rem', marginTop: '1rem'}}>User UID: {user?.uid || 'Not authenticated'}</p>
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
            Back
          </button>
          <h1>Round not found</h1>
        </div>
        <button onClick={loadData} className="btn btn-primary">
          Try Reloading
        </button>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
            Back
          </button>
          <h1>Round {round.number} - Fixture Management</h1>
          <p>
            Status: <strong>{round.status}</strong>
          </p>
          <p>
            Lock Time:{' '}
            {formatDate(
              round.lockDateTime.toDate?.()
                ? round.lockDateTime
                : round.lockDateTime
            )}
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: 'var(--danger)',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Fixture Management Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2>Fixtures for This Round</h2>
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button
              onClick={loadData}
              className="btn btn-secondary"
              style={{padding: '0.5rem 1rem', fontSize: '0.85rem'}}
            >
              🔄 Refresh
            </button>
            {round.status !== 'VALIDATED' && (
              <button
                className="btn btn-primary"
                onClick={() => setShowFixtureForm(!showFixtureForm)}
              >
                {showFixtureForm ? '✕ Cancel' : '+ Add Fixture'}
              </button>
            )}
          </div>
        </div>

        {showFixtureForm && round.status !== 'VALIDATED' && (
          <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
            <h3>Add New Fixture</h3>
            {teams.length === 0 && (
              <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(255, 56, 56, 0.1)', borderRadius: '0.25rem' }}>
                ⚠️ No teams added to this league yet. Go back and add teams first.
              </div>
            )}
            <form onSubmit={handleAddFixture}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label>Home Team *</label>
                  <select
                    value={fixtureFormData.homeTeamId}
                    onChange={(e) => {
                      const selectedTeam = teams.find((t) => t.id === e.target.value);
                      setFixtureFormData({
                        ...fixtureFormData,
                        homeTeamId: e.target.value,
                        homeTeamName: selectedTeam?.name || '',
                      });
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.25rem',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text)',
                      fontSize: '1rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select home team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Away Team *</label>
                  <select
                    value={fixtureFormData.awayTeamId}
                    onChange={(e) => {
                      const selectedTeam = teams.find((t) => t.id === e.target.value);
                      setFixtureFormData({
                        ...fixtureFormData,
                        awayTeamId: e.target.value,
                        awayTeamName: selectedTeam?.name || '',
                      });
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.25rem',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text)',
                      fontSize: '1rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select away team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Kickoff Time *</label>
                  <input
                    type="datetime-local"
                    value={fixtureFormData.kickoffTime}
                    onChange={(e) =>
                      setFixtureFormData({
                        ...fixtureFormData,
                        kickoffTime: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <button type="submit" className="btn btn-success">
                  Create Fixture
                </button>
              </div>
            </form>
          </div>
        )}

        {fixtures.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--text-light)',
              border: '2px dashed var(--border)',
              borderRadius: '0.5rem',
            }}
          >
            <p>No fixtures created yet for this round</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Add fixtures above to set up the games for this week
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {fixtures.map((fixture) => (
              <div
                key={fixture.id}
                className={styles.card}
                style={{
                  padding: '1.5rem',
                  borderLeft: `4px solid ${
                    fixture.status === 'FINISHED'
                      ? 'var(--success)'
                      : 'var(--secondary)'
                  }`,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '2rem',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  {/* Home Team */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                      Home
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                      {fixture.homeTeamName || `Team ${fixture.homeTeamId}`}
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'center' }}>
                    {fixture.status === 'FINISHED' ? (
                      <>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                          Score
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0.5rem 0' }}>
                          {fixture.homeScore ?? '-'} - {fixture.awayScore ?? '-'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: 'var(--success)',
                            fontWeight: '600',
                          }}
                        >
                          Finished
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                          Kickoff
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                          {formatDate(
                            fixture.kickoffTime.toDate?.()
                              ? fixture.kickoffTime
                              : fixture.kickoffTime
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: 'var(--secondary)',
                            fontWeight: '600',
                            marginTop: '0.5rem',
                          }}
                        >
                          Scheduled
                        </div>
                      </>
                    )}
                  </div>

                  {/* Away Team */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                      Away
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                      {fixture.awayTeamName || `Team ${fixture.awayTeamId}`}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {fixture.status !== 'FINISHED' && round.status !== 'VALIDATED' && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '0.75rem',
                        marginBottom: '1rem',
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                          Home Score
                        </label>
                        <input
                          type="number"
                          id={`home-score-${fixture.id}`}
                          placeholder="0"
                          min="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: '0.85rem',
                            display: 'block',
                            marginBottom: '0.5rem',
                          }}
                        >
                          Away Score
                        </label>
                        <input
                          type="number"
                          id={`away-score-${fixture.id}`}
                          placeholder="0"
                          min="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <button
                        className="btn btn-success"
                        onClick={() => {
                          const homeScoreEl = document.getElementById(
                            `home-score-${fixture.id}`
                          ) as HTMLInputElement;
                          const awayScoreEl = document.getElementById(
                            `away-score-${fixture.id}`
                          ) as HTMLInputElement;
                          const homeScore = parseInt(homeScoreEl.value) || 0;
                          const awayScore = parseInt(awayScoreEl.value) || 0;
                          handleUpdateFixtureScore(fixture.id, homeScore, awayScore);
                        }}
                        style={{ alignSelf: 'flex-end' }}
                      >
                        Mark Complete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player Selections */}
      <div>
        <h2>Player Selections for This Round</h2>
        {selections.length === 0 ? (
          <p style={{ color: 'var(--text-light)' }}>No selections yet</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      color: 'var(--text-light)',
                    }}
                  >
                    User ID
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      color: 'var(--text-light)',
                    }}
                  >
                    Selected Team
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      color: 'var(--text-light)',
                    }}
                  >
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {selections.map((selection) => (
                  <tr
                    key={selection.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-light)',
                      }}
                    >
                      {selection.userId.substring(0, 8)}...
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                      {selection.selectedTeamName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          backgroundColor:
                            selection.result === 'WIN'
                              ? 'rgba(0, 217, 126, 0.2)'
                              : selection.result === 'LOSS'
                                ? 'rgba(255, 56, 56, 0.2)'
                                : 'rgba(0, 0, 0, 0.2)',
                          color:
                            selection.result === 'WIN'
                              ? 'var(--success)'
                              : selection.result === 'LOSS'
                                ? 'var(--danger)'
                                : 'var(--text-light)',
                        }}
                      >
                        {selection.result || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
