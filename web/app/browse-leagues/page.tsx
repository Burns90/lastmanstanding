'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { League } from '@/../../shared/types';
import Link from 'next/link';
import styles from './browse-leagues.module.css';

export default function JoinLeaguePage() {
  const [user, setUser] = useState<any>(null);
  const [leagueCode, setLeagueCode] = useState('');
  const [foundLeague, setFoundLeague] = useState<League | null>(null);
  const [ownerName, setOwnerName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  async function handleSearchLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!leagueCode.trim()) {
      setError('Please enter a league code');
      return;
    }

    setLoading(true);
    setError('');
    setFoundLeague(null);
    setOwnerName('');

    try {
      // Search for league by code
      const q = query(
        collection(db, 'leagues'),
        where('leagueCode', '==', leagueCode.toUpperCase())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('League code not found. Please check and try again.');
        return;
      }

      const leagueDoc = snapshot.docs[0];
      const league = {
        ...leagueDoc.data(),
        id: leagueDoc.id,
      } as League;

      // Fetch owner's display name
      const ownerRef = doc(db, 'users', league.ownerId);
      const ownerSnap = await getDoc(ownerRef);
      const owner = ownerSnap.data();
      setOwnerName(owner?.displayName || 'Unknown');

      setFoundLeague(league);
    } catch (err: any) {
      setError(`Error searching for league: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinLeague() {
    if (!user || !foundLeague) return;

    // Check if invite code joining is blocked
    if (foundLeague.blockInviteJoin) {
      setError('This league has disabled joining via invite code. Please contact the league administrator.');
      return;
    }

    setJoining(true);
    try {
      console.log('Joining league:', foundLeague.id, 'Name:', foundLeague.name);
      
      // Add user as participant using userId as document ID (for Firestore rule checking)
      const participantRef = doc(db, 'leagues', foundLeague.id, 'participants', user.uid);
      await setDoc(participantRef, {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName,
        joinedAt: Timestamp.now(),
      });

      setJoined(true);
      setLeagueCode('');
      setFoundLeague(null);

      setTimeout(() => {
        console.log('Redirecting to league:', `/league/${foundLeague.id}`);
        window.location.href = `/league/${foundLeague.id}`;
      }, 1500);
    } catch (err: any) {
      setError(`Error joining league: ${err.message}`);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className={styles.container}>
      <Link href="/dashboard" className="btn btn-secondary" style={{ marginBottom: '2rem' }}>
        Back to Dashboard
      </Link>

      <div className={styles.header}>
        <div>
          <h1>Join a League</h1>
          <p>Enter a league code to join</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <form onSubmit={handleSearchLeague} style={{ marginBottom: '2rem' }}>
          <div className="form-group">
            <label htmlFor="leagueCode">League Code</label>
            <input
              id="leagueCode"
              type="text"
              value={leagueCode}
              onChange={(e) => setLeagueCode(e.target.value.toUpperCase())}
              placeholder="e.g., ABC123"
              disabled={loading}
            />
            <small style={{ color: 'var(--text-light)', marginTop: '0.5rem', display: 'block' }}>
              Ask the league owner for the 6-character code
            </small>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !leagueCode.trim()}
          >
            {loading ? 'Searching...' : 'Search League'}
          </button>
        </form>

        {error && (
          <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        {foundLeague && (
          <div style={{ backgroundColor: 'var(--bg-alt)', padding: '1.5rem', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '1rem' }}>{foundLeague.name}</h3>

            {foundLeague.description && (
              <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
                {foundLeague.description}
              </p>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-light)' }}>Owner:</span> {ownerName}
              </div>
              {foundLeague.competitionName && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-light)' }}>Competition:</span> {foundLeague.competitionName}
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-light)' }}>Time Zone:</span> {foundLeague.timeZone}
              </div>
            </div>

            {!joined ? (
              <button
                onClick={handleJoinLeague}
                className="btn btn-success"
                disabled={joining}
                style={{ width: '100%' }}
              >
                {joining ? 'Joining...' : 'Join League'}
              </button>
            ) : (
              <div style={{ color: 'var(--success)', textAlign: 'center', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>
                Successfully joined! Redirecting...
              </div>
            )}
          </div>
        )}

        {!foundLeague && !error && !joined && (
          <div style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
            Enter a league code above to get started
          </div>
        )}
      </div>
    </div>
  );
}
