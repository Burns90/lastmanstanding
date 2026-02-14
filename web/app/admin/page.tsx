'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { League } from '@/../../shared/types';
import Link from 'next/link';
import styles from './leagues.module.css';

export default function AdminLeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        await loadLeagues(currentUser.uid);
      }
    });

    return unsubscribe;
  }, []);

  async function loadLeagues(userId: string) {
    try {
      const q = query(
        collection(db, 'leagues'),
        where('ownerId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const leaguesData = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      } as League));
      setLeagues(leaguesData);
    } catch (error) {
      console.error('Error loading leagues:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading leagues</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Leagues</h1>
          <p>Manage your leagues</p>
        </div>
        <Link href="/admin/create-league" className="btn btn-primary">
          + New League
        </Link>
      </div>

      {leagues.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-light)' }}>
            You don't have any leagues yet.
          </p>
          <Link
            href="/admin/create-league"
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
          >
            Create Your First League
          </Link>
        </div>
      ) : (
        <div className="grid grid-2">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/admin/league/${league.id}`}
              className="card"
              style={{ textDecoration: 'none' }}
            >
              <div className={styles.leagueCard}>
                <h3>{league.name}</h3>
                <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
                  {league.description || 'No description'}
                </p>
                {league.competitionName && (
                  <p
                    style={{
                      color: 'var(--secondary)',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Based on: {league.competitionName}
                  </p>
                )}
                <div className={styles.leagueMeta}>
                  <span className="badge badge-primary">
                    {league.status}
                  </span>
                  <span style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                    {league.timeZone}
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
