'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AVAILABLE_COMPETITIONS } from '@/lib/competitions';
import { useAuth } from '@/lib/useAuth';

export default function ManageTeamsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedCompetition, setSelectedCompetition] = useState<string>('PL');
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    tla: '',
    crest: '',
    address: '',
    website: '',
    founded: '',
  });

  // Fetch teams for selected competition
  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  }, [selectedCompetition, user]);

  const fetchTeams = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/teams?competitionCode=${selectedCompetition}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.status}`);
      }

      const data = await response.json();
      setTeams(data.teams || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name) {
      setError('Team name is required');
      return;
    }

    if (!user) {
      setError('Not authenticated');
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          competitionCode: selectedCompetition,
          ...formData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add team: ${response.status}`);
      }

      const newTeam = await response.json();
      setTeams([...teams, newTeam.team]);
      setFormData({
        name: '',
        shortName: '',
        tla: '',
        crest: '',
        address: '',
        website: '',
        founded: '',
      });
      alert('Team added successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    if (!user) {
      setError('Not authenticated');
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/teams', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          competitionCode: selectedCompetition,
          teamId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete team: ${response.status}`);
      }

      setTeams(teams.filter((t) => t.id !== teamId));
      alert('Team deleted successfully!');
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
    return <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>Please log in to manage teams.</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '1.5rem' }}>
        Back
      </button>
      <h1>Manage Teams</h1>
      
      <div style={{ 
        backgroundColor: '#e7f3ff', 
        border: '1px solid #b3d9ff', 
        borderRadius: '4px', 
        padding: '15px', 
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        <strong>ℹ️ Teams must be manually entered below.</strong> 
        <p style={{ marginTop: '10px', marginBottom: '0' }}>
          Teams are not automatically imported from external sources. You control exactly which teams are available for selection in your competition by adding them manually using the form below.
        </p>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <label>
          Select Competition:{' '}
          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            style={{ padding: '8px', fontSize: '16px' }}
          >
            {AVAILABLE_COMPETITIONS.map((comp) => (
              <option key={comp.code} value={comp.code}>
                {comp.name} ({comp.code})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
        <h2>Add a Team</h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          Enter the details of a team that will be available for selection in this competition.
        </p>
        <form onSubmit={handleAddTeam}>
          <div style={{ marginBottom: '15px' }}>
            <label>
              Team Name: <span style={{ color: 'red' }}>*</span>
              <br />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                required
              />
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              Short Name:
              <br />
              <input
                type="text"
                name="shortName"
                value={formData.shortName}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                maxLength={10}
                placeholder="e.g., MAN"
              />
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              TLA (3-letter code):
              <br />
              <input
                type="text"
                name="tla"
                value={formData.tla}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                maxLength={3}
                placeholder="e.g., MNC"
              />
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              Crest URL:
              <br />
              <input
                type="text"
                name="crest"
                value={formData.crest}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="https://..."
              />
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              Address:
              <br />
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="Team address"
              />
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              Website:
              <br />
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="https://..."
              />
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              Founded (Year):
              <br />
              <input
                type="number"
                name="founded"
                value={formData.founded}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="1993"
              />
            </label>
          </div>

          <button
            type="submit"
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
            Add Team
          </button>
        </form>
      </div>

      <div>
        <h2>Teams in {AVAILABLE_COMPETITIONS.find((c) => c.code === selectedCompetition)?.name}</h2>
        {loading ? (
          <p>Loading teams...</p>
        ) : teams.length === 0 ? (
          <p>No teams added yet for this competition. Add teams above.</p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #ddd',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Name</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Short Name</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>TLA</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team: any) => (
                <tr key={team.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{team.name}</td>
                  <td style={{ padding: '10px' }}>{team.shortName || '-'}</td>
                  <td style={{ padding: '10px' }}>{team.tla || '-'}</td>
                  <td style={{ padding: '10px' }}>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      style={{
                        padding: '5px 15px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
