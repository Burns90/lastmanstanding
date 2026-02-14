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
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { League, Round, Selection, LeagueParticipant, Team } from '@/../../shared/types';
import {
  lockRound,
  validateRound,
  manuallyEliminateParticipant,
  overrideSelectionResult,
} from '@/lib/firebaseOperations';
import styles from './league.module.css';

export default function AdminLeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [participants, setParticipants] = useState<LeagueParticipant[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRound, setShowCreateRound] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [teamFormData, setTeamFormData] = useState({ name: '' });
  const [roundFormData, setRoundFormData] = useState({
    number: 1,
    startDateTime: '',
    lockDateTime: '',
  });
  const [blockInviteJoin, setBlockInviteJoin] = useState(false);
  const [isSavingToggle, setIsSavingToggle] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && leagueId) {
      loadData();
    }
  }, [user, leagueId]);

  async function loadData() {
    try {
      // Load league
      const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
      if (!leagueDoc.exists()) {
        router.push('/admin');
        return;
      }

      const leagueData = leagueDoc.data() as League;

      // Check ownership
      if (leagueData.ownerId !== user?.uid) {
        router.push('/admin');
        return;
      }

      setLeague(leagueData);
      setBlockInviteJoin(leagueData.blockInviteJoin || false);

      // Load rounds
      const roundsSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'rounds')
      );
      const roundsData = roundsSnapshot.docs
        .map((d) => ({ ...d.data(), id: d.id } as Round))
        .sort((a, b) => a.number - b.number);
      setRounds(roundsData);

      if (roundsData.length > 0) {
        setSelectedRound(roundsData[0]);
        await loadSelections(roundsData[0].id);
      }

      // Load participants
      const participantsSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'participants')
      );
      setParticipants(
        participantsSnapshot.docs.map((d) => d.data() as LeagueParticipant)
      );

      // Load teams
      console.log('Loading teams from:', `leagues/${leagueId}/teams`);
      const teamsSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'teams')
      );
      const teamsData = teamsSnapshot.docs.map((d) => {
        const data = { ...d.data(), id: d.id } as Team;
        console.log('Team found:', d.id, data);
        return data;
      });
      console.log('Total teams in league:', teamsData.length);
      setTeams(teamsData);

      setRoundFormData({
        ...roundFormData,
        number: roundsData.length + 1,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading league data');
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  }

  async function loadSelections(roundId: string) {
    try {
      const selectionsSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'rounds', roundId, 'selections')
      );
      setSelections(
        selectionsSnapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        } as Selection))
      );
    } catch (error) {
      console.error('Error loading selections:', error);
    }
  }

  async function handleToggleBlockInviteJoin(newValue: boolean) {
    setBlockInviteJoin(newValue);
    setIsSavingToggle(true);

    try {
      await setDoc(
        doc(db, 'leagues', leagueId),
        { blockInviteJoin: newValue },
        { merge: true }
      );
    } catch (error) {
      console.error('Error updating league setting:', error);
      alert('Error saving setting. Please try again.');
      setBlockInviteJoin(!newValue); // Revert on error
    } finally {
      setIsSavingToggle(false);
    }
  }

  async function handleCreateRound(e: React.FormEvent) {
    e.preventDefault();

    if (!roundFormData.startDateTime || !roundFormData.lockDateTime) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const startDate = new Date(roundFormData.startDateTime);
      const lockDate = new Date(roundFormData.lockDateTime);

      if (startDate >= lockDate) {
        alert('Start time must be before lock time');
        return;
      }

      await addDoc(
        collection(db, 'leagues', leagueId, 'rounds'),
        {
          number: roundFormData.number,
          status: 'OPEN',
          startDateTime: Timestamp.fromDate(startDate),
          lockDateTime: Timestamp.fromDate(lockDate),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      );

      setShowCreateRound(false);
      setRoundFormData({
        ...roundFormData,
        number: roundFormData.number + 1,
        startDateTime: '',
        lockDateTime: '',
      });

      await loadData();
      alert('Round created successfully');
    } catch (error) {
      alert(`Error creating round: ${error}`);
    }
  }

  async function handleLockRound() {
    if (!selectedRound) return;
    if (!confirm('Lock this round? Players will not be able to make selections.')) {
      return;
    }

    try {
      await lockRound(leagueId, selectedRound.id);
      await loadData();
      alert('Round locked successfully');
    } catch (error: any) {
      alert(`Error locking round: ${error.message}`);
    }
  }

  async function handleValidateRound() {
    if (!selectedRound) return;
    if (!confirm('Validate this round? This will apply fixture results and eliminate losers.')) {
      return;
    }

    try {
      await validateRound(leagueId, selectedRound.id);
      await loadData();
      alert('Round validated successfully');
    } catch (error: any) {
      alert(`Error validating round: ${error.message}`);
    }
  }

  async function handleEliminateParticipant(participantId: string) {
    const roundNum = selectedRound?.number || 1;

    if (
      !confirm(
        `Eliminate this participant starting from Round ${roundNum}?`
      )
    ) {
      return;
    }

    try {
      await manuallyEliminateParticipant(leagueId, participantId, roundNum);
      await loadData();
      alert('Participant eliminated successfully');
    } catch (error: any) {
      alert(`Error eliminating participant: ${error.message}`);
    }
  }



  async function handleOverrideSelection(
    selectionId: string,
    selection: Selection
  ) {
    if (!selectedRound) return;

    const result = prompt(
      `Override result for ${selection.selectedTeamName}?\n\nEnter: WIN, LOSS, or DRAW`,
      selection.result || 'WIN'
    );

    if (!result || !['WIN', 'LOSS', 'DRAW'].includes(result.toUpperCase())) {
      return;
    }

    const reason = prompt('Reason for override (optional):');

    try {
      await overrideSelectionResult(
        leagueId,
        selectedRound.id,
        selectionId,
        result.toUpperCase() as 'WIN' | 'LOSS' | 'DRAW',
        reason || 'Admin override'
      );
      await loadData();
      await loadSelections(selectedRound.id);
      alert('Override applied successfully');
    } catch (error) {
      alert(`Error applying override: ${error}`);
    }
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();

    if (!teamFormData.name.trim()) {
      alert('Please enter a team name');
      return;
    }

    const teamName = teamFormData.name.trim();

    // Check if team already exists
    if (teams.find((t) => t.name === teamName)) {
      alert('This team name already exists');
      return;
    }

    try {
      const teamId = teamName.toLowerCase().replace(/\s+/g, '-');
      const newTeam: Team = {
        id: teamId,
        name: teamName,
        competitionCode: league?.competitionCode || 'CUSTOM',
        tla: '',
        crest: '',
        externalId: teamId,
        manuallyAdded: true,
      };

      // Add team to Firestore
      console.log('Adding team to Firestore:', newTeam);
      console.log('Writing to path: leagues/' + leagueId + '/teams/' + teamId);
      await setDoc(doc(db, 'leagues', leagueId, 'teams', teamId), newTeam);
      console.log('Team written successfully');

      setTeams([...teams, newTeam]);
      setTeamFormData({ name: '' });
      setShowAddTeamModal(false);
      alert('Team added successfully');
    } catch (error) {
      console.error('Error adding team:', error);
      alert(`Error adding team: ${error}`);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!confirm('Are you sure you want to delete this team?')) {
      return;
    }

    try {
      // Delete team directly from Firestore
      console.log('Deleting team from path: leagues/' + leagueId + '/teams/' + teamId);
      await deleteDoc(doc(db, 'leagues', leagueId, 'teams', teamId));
      console.log('Team deleted successfully from Firestore');

      setTeams(teams.filter((t) => t.id !== teamId));
      alert('Team deleted successfully');
    } catch (error) {
      console.error('Error deleting team:', error);
      alert(`Error deleting team: ${error}`);
    }
  }

  if (loading) {
    return <div className="loading">Loading league</div>;
  }

  if (!league) {
    return <div className="alert alert-danger">League not found</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
            Back
          </button>
          <h1>{league.name}</h1>
          <p>{league.description}</p>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(0, 212, 255, 0.05) 100%)',
        border: '1.5px solid var(--border)',
        borderRadius: '0.75rem',
        padding: '2rem',
        marginBottom: '2rem',
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
            Invite Code
          </p>
          <h2 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text)', fontWeight: '700' }}>
            {league.leagueCode}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '1.25rem',
            borderRadius: '0.5rem',
            border: '2px solid var(--secondary)',
            fontFamily: 'monospace',
            fontSize: '2rem',
            fontWeight: '900',
            letterSpacing: '0.25em',
            color: 'var(--secondary)',
            textAlign: 'center',
          }}>
            {league.leagueCode}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(league.leagueCode);
              alert('League code copied to clipboard!');
            }}
            className="btn btn-primary"
            style={{
              whiteSpace: 'nowrap',
              height: 'fit-content',
              fontWeight: '700',
            }}
          >
            Copy Code
          </button>
        </div>

        <p style={{ margin: '1.5rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-light)', lineHeight: '1.6' }}>
          Share this code with players so they can join the league from the <strong style={{ color: 'var(--text)' }}>Browse Leagues</strong> page.
        </p>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 127, 80, 0.1) 0%, rgba(255, 127, 80, 0.05) 100%)',
        border: '1.5px solid var(--border)',
        borderRadius: '0.75rem',
        padding: '2rem',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Block Invite Code Joining</h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-light)' }}>
              When enabled, players cannot join this league using the invite code. Only you can add players to the league.
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: isSavingToggle ? 'not-allowed' : 'pointer',
              opacity: isSavingToggle ? 0.6 : 1,
            }}>
              <input
                type="checkbox"
                checked={blockInviteJoin}
                onChange={(e) => handleToggleBlockInviteJoin(e.target.checked)}
                disabled={isSavingToggle}
                style={{
                  width: '24px',
                  height: '24px',
                  cursor: isSavingToggle ? 'not-allowed' : 'pointer',
                }}
              />
              <span style={{ marginLeft: '0.75rem', fontWeight: '500' }}>
                {blockInviteJoin ? 'Blocked' : 'Allowed'}
              </span>
            </label>
            {isSavingToggle && <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Saving...</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Status</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{league.status}</p>
        </div>
        <div className="card">
          <h3>Timezone</h3>
          <p style={{ fontSize: '1.1rem' }}>{league.timeZone}</p>
        </div>
        <div className="card">
          <h3>Participants</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{participants.length}</p>
        </div>
      </div>

      {/* Participants Section */}
      <div>
        <div className={styles.sectionHeader}>
          <h2>Players</h2>
          <button
            onClick={() => router.push(`/league/${leagueId}/players`)}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            👥 View Players Table
          </button>
        </div>
        <div className={styles.participantsList}>
          {participants.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h4 style={{ marginBottom: '0.25rem', fontSize: '1rem' }}>{p.displayName || p.email || p.userId}</h4>
                <small style={{ color: 'var(--text-light)' }}>
                  {p.eliminated ? (
                    <>Eliminated Round {p.eliminatedAtRound} ({p.eliminatedReason})</>
                  ) : (
                    <>Active</>
                  )}
                </small>
              </div>
              {!p.eliminated && (
                <button
                  onClick={() => handleEliminateParticipant(p.id)}
                  className="btn btn-danger"
                  style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                >
                  Eliminate
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Teams Section */}
      <div>
        <div className={styles.sectionHeader}>
          <h2>Teams</h2>
          <button
            onClick={() => setShowAddTeamModal(!showAddTeamModal)}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            {showAddTeamModal ? '✕' : '+ Add Team'}
          </button>
        </div>

        {showAddTeamModal && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3>Add Team</h3>
            <form onSubmit={handleAddTeam}>
              <div className="form-group">
                <label htmlFor="teamName">Team Name</label>
                <input
                  id="teamName"
                  type="text"
                  placeholder="e.g., Manchester United"
                  value={teamFormData.name}
                  onChange={(e) => setTeamFormData({ name: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-success">
                Add Team
              </button>
            </form>
          </div>
        )}

        {teams.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
            No teams added yet. Click "Add Team" to get started.
          </div>
        ) : (
          <div className={styles.participantsList}>
            {teams.map((team) => (
              <div key={team.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ marginBottom: '0.25rem', fontSize: '1rem' }}>{team.name}</h4>
                </div>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="btn btn-danger"
                  style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
      <div>
        <div className={styles.sectionHeader}>
          <h2>Rounds</h2>
          <button
            onClick={() => setShowCreateRound(!showCreateRound)}
            className="btn btn-primary"
          >
            {showCreateRound ? '✕' : '+ Create Round'}
          </button>
        </div>

        {showCreateRound && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3>Create New Round</h3>
            <form onSubmit={handleCreateRound} className={styles.form}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label htmlFor="number">Round Number</label>
                  <input
                    id="number"
                    type="number"
                    value={roundFormData.number}
                    onChange={(e) =>
                      setRoundFormData({
                        ...roundFormData,
                        number: parseInt(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label htmlFor="startDateTime">Start Time (Local)</label>
                  <input
                    id="startDateTime"
                    type="datetime-local"
                    value={roundFormData.startDateTime}
                    onChange={(e) =>
                      setRoundFormData({
                        ...roundFormData,
                        startDateTime: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lockDateTime">Lock Time (Local)</label>
                  <input
                    id="lockDateTime"
                    type="datetime-local"
                    value={roundFormData.lockDateTime}
                    onChange={(e) =>
                      setRoundFormData({
                        ...roundFormData,
                        lockDateTime: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-success">
                Create Round
              </button>
            </form>
          </div>
        )}

        <div className={styles.roundsList}>
          {rounds.map((round) => (
            <div
              key={round.id}
              className={`card ${styles.roundCard} ${
                selectedRound?.id === round.id ? styles.active : ''
              }`}
            >
              <div className={styles.roundCardHeader}>
                <h3 style={{ cursor: 'pointer', flex: 1 }} onClick={() => {
                  setSelectedRound(round);
                  loadSelections(round.id);
                }}>Round {round.number}</h3>
                <span className="badge badge-primary">{round.status}</span>
              </div>
              <div className={styles.roundCardTimes}>
                <small>Opens: {new Date(round.startDateTime.toDate()).toLocaleString()}</small>
                <small>Locks: {new Date(round.lockDateTime.toDate()).toLocaleString()}</small>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href={`/admin/league/${leagueId}/rounds/${round.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                  Manage Fixtures
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selections Section */}
      {selectedRound && (
        <div>
          <div className={styles.sectionHeader}>
            <h2>Round {selectedRound.number} - Selections & Overrides</h2>
            <div className={styles.roundActions}>
              {selectedRound.status === 'OPEN' && (
                <button onClick={handleLockRound} className="btn btn-warning">
                  Lock Round
                </button>
              )}
              {selectedRound.status === 'LOCKED' && (
                <button onClick={handleValidateRound} className="btn btn-success">
                  Validate Round
                </button>
              )}
            </div>
          </div>

          <div className={styles.selectionsTable}>
            <div className={styles.tableHeader}>
              <div>Player</div>
              <div>Team Selected</div>
              <div>Result</div>
              <div>Actions</div>
            </div>

            {selections.length === 0 ? (
              <div className={styles.tableEmpty}>
                No selections made for this round yet.
              </div>
            ) : (
              selections.map((selection) => (
                <div key={selection.id} className={styles.tableRow}>
                  <div>{selection.userId}</div>
                  <div>
                    <strong>{selection.selectedTeamName}</strong>
                  </div>
                  <div>
                    {selection.result ? (
                      <span
                        className={`badge badge-${
                          selection.result === 'WIN' ? 'success' : 'danger'
                        }`}
                      >
                        {selection.result}
                      </span>
                    ) : (
                      <span className="badge badge-primary">Pending</span>
                    )}
                  </div>
                  <div>
                    {selectedRound.status === 'VALIDATED' && (
                      <button
                        onClick={() => handleOverrideSelection(selection.id, selection)}
                        className="btn btn-sm"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        Override
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
