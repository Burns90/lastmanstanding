'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

export default function ManageRoundsPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const { user } = useAuth();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    number: '',
    startDateTime: '',
    lockDateTime: '',
  });

  useEffect(() => {
    if (user && leagueId) {
      fetchRounds();
    }
  }, [user, leagueId]);

  const fetchRounds = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/routes`);

      if (!response.ok) {
        throw new Error(`Failed to fetch rounds: ${response.status}`);
      }

      const data = await response.json();
      setRounds(data.rounds || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.number || !formData.startDateTime || !formData.lockDateTime) {
      setError('All fields are required');
      return;
    }

    if (!user) {
      setError('Not authenticated');
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/leagues/${leagueId}/routes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          number: formData.number,
          startDateTime: formData.startDateTime,
          lockDateTime: formData.lockDateTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create round: ${response.status}`);
      }

      const newRound = await response.json();
      setRounds([...rounds, newRound.round]);
      setFormData({
        number: '',
        startDateTime: '',
        lockDateTime: '',
      });
      setShowForm(false);
      alert('Round created successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!user) {
    return <div style={{ padding: '20px' }}>Please log in to manage rounds.</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Manage Rounds</h1>

      {error && (
        <div style={{ color: 'red', marginBottom: '20px', padding: '10px', backgroundColor: '#ffe0e0', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          {showForm ? 'Cancel' : 'Create New Round'}
        </button>
      </div>

      {showForm && (
        <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h2>Create Round</h2>
          <form onSubmit={handleCreateRound}>
            <div style={{ marginBottom: '15px' }}>
              <label>
                Round Number: <span style={{ color: 'red' }}>*</span>
                <br />
                <input
                  type="number"
                  name="number"
                  value={formData.number}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  required
                  min="1"
                  placeholder="e.g., 1"
                />
              </label>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label>
                Start Date/Time: <span style={{ color: 'red' }}>*</span>
                <br />
                <input
                  type="datetime-local"
                  name="startDateTime"
                  value={formData.startDateTime}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  required
                />
              </label>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label>
                Lock Date/Time: <span style={{ color: 'red' }}>*</span>
                <br />
                <input
                  type="datetime-local"
                  name="lockDateTime"
                  value={formData.lockDateTime}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  required
                />
                <small>Players can pick until this time</small>
              </label>
            </div>

            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Create Round
            </button>
          </form>
        </div>
      )}

      <div>
        <h2>All Rounds</h2>
        {loading ? (
          <p>Loading rounds...</p>
        ) : rounds.length === 0 ? (
          <p>No rounds created yet. Create one above to get started.</p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {rounds.map((round: any) => (
              <div
                key={round.id}
                style={{
                  border: '1px solid #ddd',
                  padding: '15px',
                  borderRadius: '8px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                <h3>Round {round.number}</h3>
                <p>
                  <strong>Status:</strong> {round.status}
                </p>
                <p>
                  <strong>Starts:</strong>{' '}
                  {new Date(round.startDateTime.seconds * 1000).toLocaleString()}
                </p>
                <p>
                  <strong>Locks:</strong>{' '}
                  {new Date(round.lockDateTime.seconds * 1000).toLocaleString()}
                </p>
                <a href={`/admin/league/${leagueId}/rounds/${round.id}`} style={{ color: '#007bff' }}>
                  View Details
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
