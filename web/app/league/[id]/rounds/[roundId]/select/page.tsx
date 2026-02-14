'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

interface Fixture {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  kickoffTime: Date | string;
  status: string;
  homeScore?: number;
  awayScore?: number;
}

interface Round {
  id: string;
  number: number;
  status: string;
  startDateTime: { seconds: number };
  lockDateTime: { seconds: number };
}

export default function MakeSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  const roundId = params.roundId as string;
  const { user } = useAuth();

  const [round, setRound] = useState<Round | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user && leagueId && roundId) {
      fetchRoundAndFixtures();
    }
  }, [user, leagueId, roundId]);

  const fetchRoundAndFixtures = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch round data
      const roundResponse = await fetch(`/api/leagues/${leagueId}/rounds/${roundId}`);
      if (!roundResponse.ok) {
        throw new Error(`Failed to fetch round: ${roundResponse.status}`);
      }
      const roundData = await roundResponse.json();
      setRound(roundData.round);

      // Fetch fixtures for this round
      const fixturesResponse = await fetch(
        `/api/leagues/${leagueId}/rounds/${roundId}/fixtures`
      );
      if (!fixturesResponse.ok) {
        throw new Error('Failed to fetch fixtures');
      }
      const fixturesData = await fixturesResponse.json();
      setFixtures((fixturesData.fixtures || []).map((f: any) => ({
        id: f.id,
        homeTeamId: f.homeTeamId,
        homeTeamName: f.homeTeamName,
        awayTeamId: f.awayTeamId,
        awayTeamName: f.awayTeamName,
        kickoffTime: f.kickoffTime,
        status: f.status,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
      })));

      // Check if player is eliminated
      if (user?.uid) {
        const participantResponse = await fetch(
          `/api/leagues/${leagueId}/participants/${user.uid}`
        );
        if (participantResponse.ok) {
          const participantData = await participantResponse.json();
          if (participantData.participant.eliminated) {
            setError(`You were eliminated in Round ${participantData.participant.eliminatedAtRound}`);
            return;
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSelection = async () => {
    if (!selectedFixture || !selectedTeamId) {
      setError('Please select a fixture and a team');
      return;
    }

    if (!user) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const selectedTeamName =
        selectedTeamId === selectedFixture.homeTeamId
          ? selectedFixture.homeTeamName
          : selectedFixture.awayTeamName;

      const response = await fetch(
        `/api/leagues/${leagueId}/rounds/${roundId}/selections`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.uid,
            selectedTeamId,
            selectedTeamName,
            fixtureId: selectedFixture.id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to submit selection: ${response.status}`);
      }

      setSuccess('Selection submitted successfully!');
      setSelectedFixture(null);
      setSelectedTeamId(null);

      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = `/league/${leagueId}`;
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-5 text-slate-300">Please log in to make a selection.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => router.back()} className="mb-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg">
            Back
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">Make Your Selection</h1>
          <p className="text-slate-300">
            {round ? `Round ${round.number}` : 'Loading...'}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Select a fixture and the team you think will win
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-600 rounded-lg text-green-200">
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-300">Loading fixtures...</p>
          </div>
        ) : error && error.includes('eliminated') ? (
          <div className="card p-8 text-center bg-red-900/20 border border-red-600 rounded-lg">
            <p className="text-white text-lg font-bold mb-4">Game Over</p>
            <p className="text-red-200 mb-6">{error}</p>
            <button
              onClick={() => (window.location.href = `/league/${leagueId}`)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg"
            >
              Back to League
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Fixtures List */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Select a Fixture</h2>
              {fixtures.length === 0 ? (
                <p className="text-slate-300 text-center py-8">
                  No fixtures available for this round
                </p>
              ) : (
                <div className="grid gap-4">
                  {fixtures.map((fixture) => (
                    <div
                      key={fixture.id}
                      onClick={() => {
                        setSelectedFixture(fixture);
                        setSelectedTeamId(null);
                      }}
                      className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedFixture?.id === fixture.id
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="grid grid-cols-3 gap-4 items-center">
                        {/* Home Team */}
                        <div className="text-center">
                          <p className="text-white font-bold text-lg">
                            {fixture.homeTeamName}
                          </p>
                          <p className="text-slate-400 text-sm">Home</p>
                        </div>

                        {/* vs */}
                        <div className="text-center">
                          <p className="text-slate-400 font-bold">vs</p>
                          <p className="text-slate-500 text-sm">
                            {new Date(fixture.kickoffTime).toLocaleTimeString()}
                          </p>
                        </div>

                        {/* Away Team */}
                        <div className="text-center">
                          <p className="text-white font-bold text-lg">
                            {fixture.awayTeamName}
                          </p>
                          <p className="text-slate-400 text-sm">Away</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Team Selection for Selected Fixture */}
            {selectedFixture && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  Pick Your Team: {selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {/* Home Team Option */}
                  <div
                    onClick={() => setSelectedTeamId(selectedFixture.homeTeamId)}
                    className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTeamId === selectedFixture.homeTeamId
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                    }`}
                  >
                    <p className="text-white font-bold text-center text-xl">
                      {selectedFixture.homeTeamName}
                    </p>
                    <p className="text-slate-400 text-center text-sm mt-2">
                      I think they will win
                    </p>
                    {selectedTeamId === selectedFixture.homeTeamId && (
                      <div className="text-center mt-3 text-green-400 text-sm font-bold">
                        Selected
                      </div>
                    )}
                  </div>

                  {/* Away Team Option */}
                  <div
                    onClick={() => setSelectedTeamId(selectedFixture.awayTeamId)}
                    className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTeamId === selectedFixture.awayTeamId
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                    }`}
                  >
                    <p className="text-white font-bold text-center text-xl">
                      {selectedFixture.awayTeamName}
                    </p>
                    <p className="text-slate-400 text-center text-sm mt-2">
                      I think they will win
                    </p>
                    {selectedTeamId === selectedFixture.awayTeamId && (
                      <div className="text-center mt-3 text-green-400 text-sm font-bold">
                        Selected
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Selection Summary */}
            {selectedFixture && selectedTeamId && (
              <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
                <p className="text-slate-300">
                  Your Prediction: <span className="text-white font-bold">
                    {selectedTeamId === selectedFixture.homeTeamId
                      ? selectedFixture.homeTeamName
                      : selectedFixture.awayTeamName}{' '}
                    to win
                  </span>
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleSubmitSelection}
                disabled={!selectedFixture || !selectedTeamId || loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                {loading ? 'Submitting...' : 'Submit Selection'}
              </button>
              <button
                onClick={() => (window.location.href = `/league/${leagueId}`)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

