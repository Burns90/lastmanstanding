'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { League, LeagueParticipant } from '@/../../shared/types';
import styles from '../league.module.css';

interface ParticipantWithUserInfo extends LeagueParticipant {
  displayName?: string;
  email?: string;
}

export default function PlayersPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.id as string | undefined;

  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);

      if (!leagueId) {
        setError('Invalid league ID');
        setLoading(false);
        return;
      }

      // Load league
      const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
      if (!leagueDoc.exists()) {
        setError('League not found');
        setLoading(false);
        return;
      }

      setLeague(leagueDoc.data() as League);

      // Load participants
      const participantsSnapshot = await getDocs(
        collection(db, 'leagues', leagueId, 'participants')
      );

      const participantsData = participantsSnapshot.docs.map(
        (d) => d.data() as ParticipantWithUserInfo
      );

      // Load user info for each participant
      const enrichedParticipants = await Promise.all(
        participantsData.map(async (participant) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', participant.userId));
            const userData = userDoc.data();
            return {
              ...participant,
              displayName: userData?.displayName || participant.displayName,
              email: userData?.email || participant.email,
            };
          } catch {
            return participant;
          }
        })
      );

      // Sort: active players first, then by elimination round
      const sorted = enrichedParticipants.sort((a, b) => {
        if (a.eliminated !== b.eliminated) {
          return a.eliminated ? 1 : -1;
        }
        if (a.eliminated && b.eliminated) {
          return (b.eliminatedAtRound || 0) - (a.eliminatedAtRound || 0);
        }
        return 0;
      });

      setParticipants(sorted);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading players</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
          Back
        </button>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className={styles.container}>
        <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
          Back
        </button>
        <div className="alert alert-danger">League not found</div>
      </div>
    );
  }

  const activePlayers = participants.filter((p) => !p.eliminated);
  const eliminatedPlayers = participants.filter((p) => p.eliminated);

  return (
    <div className={styles.container}>
      <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
        Back to League
      </button>

      <div className={styles.header}>
        <div>
          <h1>{league.name} - Players</h1>
          <p>All participants and their status</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Active Players</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
            {activePlayers.length}
          </p>
        </div>
        <div className="card">
          <h3>Eliminated</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--danger)' }}>
            {eliminatedPlayers.length}
          </p>
        </div>
      </div>

      {/* Active Players Table */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--success)' }}>
          ✓ Active Players ({activePlayers.length})
        </h2>

        {activePlayers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
            No active players
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderBottom: '2px solid var(--border)',
                }}>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--success)',
                    fontSize: '0.95rem',
                  }}>
                    Player Name
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: 'var(--text-light)',
                    fontSize: '0.95rem',
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {activePlayers.map((player) => (
                  <tr
                    key={player.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{
                      padding: '1rem',
                      color: 'var(--text)',
                      fontWeight: '500',
                    }}>
                      {player.displayName || player.email || player.userId}
                    </td>
                    <td style={{
                      padding: '1rem',
                      textAlign: 'center',
                    }}>
                      <span className="badge badge-success">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Eliminated Players Table */}
      {eliminatedPlayers.length > 0 && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--danger)' }}>
            🔴 Eliminated Players ({eliminatedPlayers.length})
          </h2>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderBottom: '2px solid var(--border)',
                }}>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--danger)',
                    fontSize: '0.95rem',
                  }}>
                    Player Name
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: 'var(--text-light)',
                    fontSize: '0.95rem',
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {eliminatedPlayers.map((player) => (
                  <tr
                    key={player.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: 0.8,
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{
                      padding: '1rem',
                      color: 'var(--text)',
                      fontWeight: '500',
                    }}>
                      {player.displayName || player.email || player.userId}
                    </td>
                    <td style={{
                      padding: '1rem',
                      textAlign: 'center',
                    }}>
                      <span className="badge badge-danger">Eliminated</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
