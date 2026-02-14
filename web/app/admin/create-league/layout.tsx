'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import styles from './create-league.module.css';

export default function CreateLeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser: any) => {
      if (!currentUser) {
        router.push('/login');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  if (loading) {
    return <div className={styles.loadingContainer}>Loading</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.layoutContainer}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backButton}>
          Back to Leagues
        </Link>
        <div className={styles.headerTitle}>
          <h1>Create New League</h1>
          <p>Set up your football prediction league</p>
        </div>
      </header>

      <main className={styles.mainContent}>{children}</main>

      <footer className={styles.footer}>
        <p>&copy; Last Man Standing • {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
