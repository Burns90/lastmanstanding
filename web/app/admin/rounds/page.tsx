'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getLeagueRounds,
  lockRound,
  validateRound,
  getSelections,
  overrideSelectionResult,
  getOverrides,
} from '@/lib/services/leagueService';
import { Round, Selection, AdminOverride } from '@/../../shared/types';

export default function RoundsPage() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('leagueId') || '';
  
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [overrides, setOverrides] = useState<AdminOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRounds();
  }, [leagueId]);

  async function loadRounds() {
    try {
      if (!leagueId) return;
      const data = await getLeagueRounds(leagueId);
      setRounds(data.sort((a, b) => a.number - b.number));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function selectRound(round: Round) {
    setSelectedRound(round);
    try {
      const [selectionsData, overridesData] = await Promise.all([
        getSelections(leagueId, round.id),
        getOverrides(leagueId, round.id),
      ]);
      setSelections(selectionsData);
      setOverrides(overridesData);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleLockRound(roundId: string) {
    try {
      await lockRound(leagueId, roundId);
      await loadRounds();
      alert('Round locked successfully');
    } catch (err) {
      alert(`Error locking round: ${err}`);
    }
  }

  async function handleValidateRound(roundId: string) {
    try {
      await validateRound(leagueId, roundId);
      await loadRounds();
      await selectRound(rounds.find(r => r.id === roundId)!);
      alert('Round validated successfully');
    } catch (err) {
      alert(`Error validating round: ${err}`);
    }
  }

  async function handleOverrideResult(
    selectionId: string,
    result: 'WIN' | 'LOSS' | 'DRAW'
  ) {
    if (!selectedRound) return;
    try {
      const reason = prompt('Enter reason for override:');
      if (!reason) return;
      
      await overrideSelectionResult(
        leagueId,
        selectedRound.id,
        selectionId,
        result,
        reason
      );
      await selectRound(selectedRound);
      alert('Override applied successfully');
    } catch (err) {
      alert(`Error applying override: ${err}`);
    }
  }

  if (loading) return <div>Loading rounds...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Round Management</h1>
      {!leagueId && <p>Please select a league first</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Rounds List */}
        <div>
          <h2>Rounds</h2>
          <div style={{ border: '1px solid #ddd', borderRadius: '8px' }}>
            {rounds.map((round) => (
              <div
                key={round.id}
                onClick={() => selectRound(round)}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor:
                    selectedRound?.id === round.id ? '#f0f0f0' : 'white',
                }}
              >
                <div>
                  <strong>Round {round.number}</strong>
                  <span style={{ marginLeft: '10px', fontSize: '0.9em' }}>
                    Status: {round.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                  Lock: {new Date(round.lockDateTime.toDate()).toLocaleString()}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  {round.status === 'OPEN' && (
                    <button onClick={() => handleLockRound(round.id)}>
                      Lock Round
                    </button>
                  )}
                  {round.status === 'LOCKED' && (
                    <button onClick={() => handleValidateRound(round.id)}>
                      Validate Round
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selections & Overrides */}
        {selectedRound && (
          <div>
            <h2>Round {selectedRound.number} - Selections</h2>
            <div style={{ maxHeight: '600px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}>
              {selections.map((selection) => {
                const override = overrides.find(o => o.selectionId === selection.id);
                return (
                  <div key={selection.id} style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                    <div>
                      <strong>{selection.selectedTeamName}</strong>
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                      User: {selection.userId}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                      Result: {selection.result || 'Pending'}
                    </div>
                    {override && (
                      <div style={{ fontSize: '0.85em', color: '#f00', marginTop: '4px' }}>
                        Override: {override.overrideResult} ({override.reason})
                      </div>
                    )}
                    {selectedRound.status === 'VALIDATED' && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleOverrideResult(selection.id, 'WIN')}>
                          Override WIN
                        </button>
                        <button onClick={() => handleOverrideResult(selection.id, 'LOSS')}>
                          Override LOSS
                        </button>
                        <button onClick={() => handleOverrideResult(selection.id, 'DRAW')}>
                          Override DRAW
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
