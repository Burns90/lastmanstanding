'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendForgotPasswordEmail } from '@/lib/firebaseOperations';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendForgotPasswordEmail(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>Check Your Email</h1>
          <p>Password reset instructions sent</p>

          <div className="alert alert-success" style={{ marginBottom: '2rem' }}>
            We've sent a password reset link to <strong>{email}</strong>. 
            Please check your email and follow the instructions to reset your password.
          </div>

          <button
            onClick={() => router.push('/login')}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Reset Password</h1>
        <p>Enter your email to receive a password reset link</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
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
              Back to Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
