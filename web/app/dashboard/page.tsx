'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { League } from '@/../../shared/types';
import { useNotifications } from '@/context/NotificationContext';
import Link from 'next/link';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const { unreadCount } = useNotifications();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadLeagues(currentUser.uid);
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function loadLeagues(userId: string) {
    try {
      // Get leagues where user is owner
      const ownerQuery = query(
        collection(db, 'leagues'),
        where('ownerId', '==', userId)
      );
      const ownerSnapshot = await getDocs(ownerQuery);
      const ownedLeagues = ownerSnapshot.docs.map((doc) => ({ 
        ...doc.data(),
        id: doc.id,
      } as League));

      // Get leagues where user is a participant
      // We need to find all leagues and check if user has a participant document
      const allLeaguesQuery = collection(db, 'leagues');
      const allLeaguesSnapshot = await getDocs(allLeaguesQuery);
      
      const participatingLeagues: League[] = [];
      for (const leagueDoc of allLeaguesSnapshot.docs) {
        const participantRef = query(
          collection(db, 'leagues', leagueDoc.id, 'participants'),
          where('userId', '==', userId)
        );
        const participantSnapshot = await getDocs(participantRef);
        if (!participantSnapshot.empty) {
          participatingLeagues.push({
            ...leagueDoc.data(),
            id: leagueDoc.id,
          } as League);
        }
      }

      // Combine owned and participating leagues, avoiding duplicates
      const leagueMap = new Map<string, League>();
      ownedLeagues.forEach(league => leagueMap.set(league.id, league));
      participatingLeagues.forEach(league => leagueMap.set(league.id, league));
      
      setLeagues(Array.from(leagueMap.values()));
    } catch (error) {
      console.error('Error loading leagues:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1>Last Man Standing</h1>
          <p>Football Prediction League</p>
          <div className={styles.heroButtons}>
            <Link href="/login" className="btn btn-primary">
              Sign In
            </Link>
            <Link href="/signup" className="btn btn-outline">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading leagues</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Welcome, {user.displayName || user.email}!</h1>
          <p>Your active leagues and selections</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/notifications" className={styles.notificationBell}>
            Notifications
            {unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount}</span>
            )}
          </Link>
          <Link href="/browse-leagues" className="btn btn-outline">
            � Join League
          </Link>
          <Link href="/admin" className="btn btn-outline">
            ➕ New League
          </Link>
          <button onClick={() => auth.signOut()} className="btn btn-secondary">
            Sign Out
          </button>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className={styles.emptyState}>
            You haven't joined any leagues yet.
          </p>
          <Link href="/browse-leagues" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Browse Leagues
          </Link>
        </div>
      ) : (
        <div className="grid grid-2">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/league/${league.id}`}
              className="card"
              style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
            >
              <div className={styles.leagueCard}>
                <h3>{league.name}</h3>
                <p style={{ color: 'var(--text-light)', marginBottom: '1rem', flex: '1 1 auto' }}>
                  {league.description || ''}
                </p>
                <div className={styles.leagueMeta}>
                  <span className="badge badge-primary">
                    {league.status}
                  </span>
                  <span style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                    Timezone: {league.timeZone}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
