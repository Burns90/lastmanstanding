'use client';

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { isUsernameAvailable } from '@/lib/auth-helpers';
import styles from '../auth.module.css';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Check username availability
  async function handleUsernameChange(value: string) {
    setUsername(value);
    setUsernameError('');

    if (!value.trim()) {
      return;
    }

    if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setUsernameError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    setCheckingUsername(true);
    try {
      const available = await isUsernameAvailable(value);
      if (!available) {
        setUsernameError('Username is already taken');
      }
    } catch (err) {
      console.error('Error checking username:', err);
    } finally {
      setCheckingUsername(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate username
    if (!username.trim()) {
      setError('Please enter a username');
      setLoading(false);
      return;
    }

    if (usernameError) {
      setError(usernameError);
      setLoading(false);
      return;
    }

    try {
      // Double-check username availability before signup
      const available = await isUsernameAvailable(username);
      if (!available) {
        setError('Username is already taken. Please choose another.');
        setLoading(false);
        return;
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(result.user, {
        displayName,
      });

      // Create user document in Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email,
        username: username.toLowerCase(),
        displayName,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Create Account</h1>
        <p>Join Last Man Standing</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSignup} className={styles.form}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="e.g., john_doe"
              required
              minLength={3}
              maxLength={20}
            />
            {usernameError && (
              <small style={{ color: 'var(--danger)' }}>{usernameError}</small>
            )}
            {checkingUsername && (
              <small style={{ color: 'var(--text-light)' }}>Checking availability...</small>
            )}
            {!usernameError && !checkingUsername && username && (
              <small style={{ color: 'var(--success)' }}>Username available</small>
            )}
            <small style={{ color: 'var(--text-light)' }}>
              3-20 characters, letters, numbers, underscores, and hyphens only
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Full Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              minLength={6}
            />
            <small style={{ color: 'var(--text-light)' }}>
              Minimum 6 characters
            </small>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || !!usernameError || !username}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Already have an account?{' '}
            <button
              onClick={() => router.push('/login')}
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
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
