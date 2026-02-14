'use client';

import { useState } from 'react';
import { sendManualNotification } from '@/lib/firebaseOperations';
import styles from './admin-notifications.module.css';

export default function AdminNotificationsPage() {
  const [leagueId, setLeagueId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [audience, setAudience] = useState<'ALL_PLAYERS' | 'UNPICKED'>('ALL_PLAYERS');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();

    if (!leagueId || !title || !message) {
      alert('Please fill in all required fields');
      return;
    }

    if (audience === 'UNPICKED' && !roundId) {
      alert('Please select a round for UNPICKED audience');
      return;
    }

    setLoading(true);
    setSuccess('');

    try {
      await sendManualNotification(
        leagueId,
        audience,
        title,
        message,
        audience === 'UNPICKED' ? roundId : undefined
      );
      setSuccess('Notification sent successfully!');
      setTitle('');
      setMessage('');
    } catch (error: any) {
      alert(`Error sending notification: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1>Send Notifications</h1>
      <p>Send custom notifications to league players</p>

      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSendNotification} className={styles.form}>
        <div className="form-group">
          <label htmlFor="leagueId">League ID</label>
          <input
            id="leagueId"
            type="text"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            placeholder="Enter league ID"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="audience">Audience</label>
          <select
            id="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as 'ALL_PLAYERS' | 'UNPICKED')}
          >
            <option value="ALL_PLAYERS">All Players</option>
            <option value="UNPICKED">Players Who Haven't Picked (Current Round)</option>
          </select>
        </div>

        {audience === 'UNPICKED' && (
          <div className="form-group">
            <label htmlFor="roundId">Round ID</label>
            <input
              id="roundId"
              type="text"
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              placeholder="Enter round ID"
              required={audience === 'UNPICKED'}
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="title">Notification Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Picks Close Soon"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your notification message"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Sending...' : 'Send Notification'}
        </button>
      </form>
    </div>
  );
}
