'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { League, LeagueParticipant } from '@/../../shared/types';
import Link from 'next/link';
import styles from './standings.module.css';

interface ParticipantWithUserInfo extends LeagueParticipant {
  userEmail?: string;
  userName?: string;
}

export default function StandingsPage() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('leagueId') || '';

  const [_user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithUserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (leagueId) {
      loadData();
    }
  }, [leagueId]);

  async function loadData() {
    try {
      // Load league
      const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
      if (!leagueDoc.exists()) {
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
              userEmail: userData?.email || participant.email || participant.userId,
              userName: userData?.displayName || participant.displayName,
            };
          } catch {
            return { 
              ...participant, 
              userEmail: participant.email || participant.userId,
              userName: participant.displayName,
            };
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
    } catch (error) {
      console.error('Error loading standings:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading standings</div>;
  }

  if (!league) {
    return (
      <div className={styles.container}>
        <Link href="/dashboard" className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
          Back to Leagues
        </Link>
        <div className="alert alert-danger">League not found</div>
      </div>
    );
  }

  const activePlayers = participants.filter((p) => !p.eliminated);
  const eliminatedPlayers = participants.filter((p) => p.eliminated);

  return (
    <div className={styles.container}>
      <Link href="/dashboard" className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
        Back to Leagues
      </Link>

      <div className={styles.header}>
        <div>
          <h1>{league.name} - Standings</h1>
          <p>Real-time player status and eliminations</p>
        </div>
      </div>

      <div className="grid grid-3">
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
        <div className="card">
          <h3>Total Participants</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {participants.length}
          </p>
        </div>
      </div>

      {/* Active Players */}
      <div>
        <h2 style={{ marginBottom: '1.5rem' }}>
          Active Players ({activePlayers.length})
        </h2>
        {activePlayers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-light)' }}>No active players</p>
          </div>
        ) : (
          <div className={styles.playersList}>
            {activePlayers.map((player, index) => (
              <div key={player.id} className={`card ${styles.playerCard} ${styles.active}`}>
                <div className={styles.playerHeader}>
                  <div className={styles.playerRank}>#{index + 1}</div>
                  <div className={styles.playerInfo}>
                    <h3>{player.userName || player.userEmail || player.userId}</h3>
                    <small>Joined: {new Date(player.joinedAt.toDate()).toLocaleDateString()}</small>
                  </div>
                  <span className="badge badge-success">Active</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Eliminated Players */}
      {eliminatedPlayers.length > 0 && (
        <div>
          <h2 style={{ marginBottom: '1.5rem' }}>
            🔴 Eliminated Players ({eliminatedPlayers.length})
          </h2>
          <div className={styles.playersList}>
            {eliminatedPlayers.map((player) => (
              <div key={player.id} className={`card ${styles.playerCard} ${styles.eliminated}`}>
                <div className={styles.playerHeader}>
                  <div className={styles.playerInfo}>
                    <h3>{player.userName || player.userEmail || player.userId}</h3>
                    <small>
                      {player.eliminatedReason === 'LOSS' &&
                        `Lost in Round ${player.eliminatedAtRound}`}
                      {player.eliminatedReason === 'NO_PICK' &&
                        `No pick in Round ${player.eliminatedAtRound}`}
                      {player.eliminatedReason === 'ADMIN' &&
                        `Eliminated in Round ${player.eliminatedAtRound}`}
                    </small>
                  </div>
                  <span
                    className={`badge badge-${
                      player.eliminatedReason === 'LOSS' ? 'danger' : 'warning'
                    }`}
                  >
                    {player.eliminatedReason === 'LOSS' && 'Lost'}
                    {player.eliminatedReason === 'NO_PICK' && '⏭️ No Pick'}
                    {player.eliminatedReason === 'ADMIN' && '👤 Manual'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
