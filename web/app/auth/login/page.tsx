'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import styles from './auth.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Check if user is already logged in via Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/dashboard');
      }
      setPageLoading(false);
    });

    return unsubscribe;
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let emailToUse = usernameOrEmail;

      // If input is a username (no @), look up the email
      if (!usernameOrEmail.includes('@')) {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ usernameOrEmail }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Username not found');
        }

        const data = await response.json();
        emailToUse = data.email;
      }

      // Sign in with Firebase Auth using the email and password
      await signInWithEmailAndPassword(auth, emailToUse, password);
      
      // Firebase auth state change will trigger redirect via useEffect
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Sign In</h1>
        <p>Welcome back to Last Man Standing</p>

        {pageLoading && <div className="loading">Loading...</div>}
        {!pageLoading && (
          <>
            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleLogin} className={styles.form}>
              <div className="form-group">
                <label htmlFor="usernameOrEmail">Username or Email</label>
                <input
                  id="usernameOrEmail"
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="Enter your username or email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className={styles.footer}>
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => router.push('/signup')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--secondary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    font: 'inherit',
                  }}
                >
                  Sign up here
                </button>
              </p>
              <p style={{ marginTop: '0.75rem' }}>
                <button
                  onClick={() => router.push('/auth/forgot-password')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--secondary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    font: 'inherit',
                    fontSize: '0.9rem',
                  }}
                >
                  Forgot your password?
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
