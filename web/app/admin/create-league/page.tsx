'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { Competition, Team } from '@/lib/competitions';
import { useRouter } from 'next/navigation';
import { getCompetitions } from '@/lib/firebaseOperations';
import styles from './create-league.module.css';

type FormStep = 'competition' | 'details' | 'review';

export default function CreateLeaguePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<FormStep>('competition');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [manualTeamForm, setManualTeamForm] = useState({
    name: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    timeZone: 'Europe/London',
    competitionId: '',
    competitionName: '',
    competitionCode: '',
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    loadCompetitions();
  }, []);

  async function loadCompetitions() {
    try {
      const data = await getCompetitions();
      setCompetitions(data);
    } catch (error) {
      console.error('Error loading competitions:', error);
      alert('Failed to load competitions');
    }
  }

  async function handleCompetitionSelect(competitionId: string) {
    const competition = competitions.find((c) => c.id === competitionId);
    if (!competition) return;

    setSelectedCompetition(competition);
    setSelectedTeams([]);
    setTeams([]);
    setFormData({
      ...formData,
      competitionId: competition.id,
      competitionName: competition.name,
      competitionCode: competition.code,
    });

    // Move to details step - users will add teams manually
    setCurrentStep('details');
  }

  function addManualTeam() {
    if (!manualTeamForm.name.trim()) {
      alert('Please enter a team name');
      return;
    }

    const teamName = manualTeamForm.name.trim();
    
    // Check if team already exists
    if (teams.find((t) => t.name === teamName)) {
      alert('This team name already exists');
      return;
    }

    const newTeam: Team = {
      id: teamName.toLowerCase().replace(/\s+/g, '-'),
      name: teamName,
      tla: '',
      crest: '',
      externalId: teamName.toLowerCase().replace(/\s+/g, '-'),
    };

    setTeams([...teams, newTeam]);
    setSelectedTeams([...selectedTeams, newTeam.id]);    setSelectedTeams([...selectedTeams, newTeam.id]);    setManualTeamForm({ name: '' });
  }

  function removeTeam(teamId: string) {
    setSelectedTeams(selectedTeams.filter((id) => id !== teamId));
  }

  const selectedTeamObjects = teams.filter((t) => selectedTeams.includes(t.id));

  async function handleCreateLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (selectedTeams.length === 0) {
      alert('Please add at least one team to the league.');
      return;
    }

    if (!formData.name.trim()) {
      alert('Please enter a league name');
      return;
    }

    const leagueCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'leagues'), {
        ...formData,
        leagueCode,
        ownerId: user.uid,
        status: 'ACTIVE',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      if (selectedTeamObjects.length > 0) {
        const teamsRef = collection(db, 'leagues', docRef.id, 'teams');
        for (const team of selectedTeamObjects) {
          await addDoc(teamsRef, {
            ...team,
            savedAt: Timestamp.now(),
          });
        }
      }

      router.push('/admin');
    } catch (error) {
      alert(`Error creating league: ${error}`);
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: '2rem' }}>
          Back
        </button>
        {/* Progress Indicator */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressStep}
            style={{ opacity: currentStep === 'competition' ? 1 : 0.5 }}
          >
            <span className={styles.stepNumber}>1</span>
            <span>Competition</span>
          </div>
          <div className={styles.progressLine}></div>
          <div
            className={styles.progressStep}
            style={{ opacity: currentStep === 'details' ? 1 : 0.5 }}
          >
            <span className={styles.stepNumber}>2</span>
            <span>Details</span>
          </div>
          <div className={styles.progressLine}></div>
          <div
            className={styles.progressStep}
            style={{ opacity: currentStep === 'review' ? 1 : 0.5 }}
          >
            <span className={styles.stepNumber}>3</span>
            <span>Review</span>
          </div>
        </div>

        {/* Step 1: Competition Selection */}
        {currentStep === 'competition' && (
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <h2>Select a Competition</h2>
              <p>Choose which football league you want to create predictions for</p>
            </div>

            <div className={styles.competitionGrid}>
              {competitions.map((comp) => (
                <button
                  key={comp.id}
                  className={`${styles.competitionCard} ${
                    selectedCompetition?.id === comp.id ? styles.selected : ''
                  }`}
                  onClick={() => handleCompetitionSelect(comp.id)}
                >
                  <div className={styles.competitionIcon}></div>
                  <h3>{comp.name}</h3>
                  <p>{comp.country}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: League Details */}
        {currentStep === 'details' && selectedCompetition && (
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <h2>League Details</h2>
              <p>Configure your {selectedCompetition.name} league</p>
            </div>

            <form className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="name">League Name *</label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g., My Premier League Predictions"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description">League Description</label>
                <textarea
                  id="description"
                  placeholder="Optional: Add any rules or notes for your league members"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                ></textarea>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="timeZone">Time Zone</label>
                <select
                  id="timeZone"
                  value={formData.timeZone}
                  onChange={(e) =>
                    setFormData({ ...formData, timeZone: e.target.value })
                  }
                >
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Europe/Berlin">Berlin (CET)</option>
                  <option value="America/New_York">New York (EST)</option>
                  <option value="America/Los_Angeles">Los Angeles (PST)</option>
                  <option value="Asia/Dubai">Dubai (GST)</option>
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                  <option value="Australia/Sydney">Sydney (AEDT)</option>
                </select>
              </div>

              <div className={styles.teamManager}>
                <div className={styles.teamManagerHeader}>
                  <strong>Teams for League</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className={styles.teamCount}>{selectedTeams.length} selected</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                      onClick={() => setShowTeamModal(true)}
                    >
                      Add Teams
                    </button>
                  </div>
                </div>



                {selectedTeams.length > 0 && (
                  <div className={styles.selectedTeamsSection}>
                    <h4>Selected Teams ({selectedTeams.length})</h4>
                    <div className={styles.selectedTeamsList}>
                      {selectedTeamObjects.map((team) => (
                        <div key={team.id} className={styles.selectedTeamItem}>
                          <div className={styles.teamInfo}>
                            <strong>{team.name}</strong>
                            {team.tla && <span className={styles.teamCode}>{team.tla}</span>}
                          </div>
                          <button
                            type="button"
                            className={styles.removeTeamBtn}
                            onClick={() => removeTeam(team.id)}
                            title="Remove team"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.backBtn}`}
                  onClick={() => setCurrentStep('competition')}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCurrentStep('review')}
                  disabled={!formData.name.trim()}
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 'review' && selectedCompetition && (
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <h2>Review Your League</h2>
              <p>Verify all the details before creating</p>
            </div>

            <div className={styles.reviewCard}>
              <div className={styles.reviewRow}>
                <strong>League Name:</strong>
                <span>{formData.name}</span>
              </div>
              <div className={styles.reviewRow}>
                <strong>Competition:</strong>
                <span>{selectedCompetition.name}</span>
              </div>
              {formData.description && (
                <div className={styles.reviewRow}>
                  <strong>Description:</strong>
                  <span>{formData.description}</span>
                </div>
              )}
              <div className={styles.reviewRow}>
                <strong>Time Zone:</strong>
                <span>{formData.timeZone}</span>
              </div>
              <div className={styles.reviewRow}>
                <strong>Selected Teams:</strong>
                <span>{selectedTeams.length} teams</span>
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={`btn btn-secondary ${styles.backBtn}`}
                onClick={() => setCurrentStep('details')}
                disabled={submitting}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary btn-success"
                onClick={handleCreateLeague}
                disabled={submitting}
              >
                {submitting ? 'Creating League...' : 'Create League'}
              </button>
            </div>
          </div>
        )}

        {/* Team Modal */}
        {showTeamModal && (
          <div className={styles.modalOverlay} onClick={() => setShowTeamModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Add Teams to League</h3>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setShowTeamModal(false)}
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                {selectedCompetition && (
                  <>
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ marginBottom: '1rem', color: 'var(--text)' }}>Add a Team Manually</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                        <input
                          type="text"
                          placeholder="Team Name (e.g., Manchester United)"
                          value={manualTeamForm.name}
                          onChange={(e) => setManualTeamForm({ ...manualTeamForm, name: e.target.value })}
                          style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-success"
                        onClick={addManualTeam}
                        style={{ width: '100%' }}
                      >
                        Add Team
                      </button>
                    </div>

                    {teams.length > 0 && (
                      <div>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text)' }}>Teams Added ({teams.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                          {teams.map((team) => (
                            <div
                              key={team.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem',
                                backgroundColor: 'var(--bg)',
                                border: '1px solid var(--border)',
                                borderRadius: '0.5rem',
                              }}
                            >
                                <strong style={{ color: 'var(--text)' }}>{team.name}</strong>
                              <button
                                type="button"
                                style={{
                                  background: 'var(--danger)',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease',
                                }}
                                onClick={() => setTeams(teams.filter((t) => t.id !== team.id))}
                                onMouseEnter={(e) => {
                                  (e.target as HTMLElement).style.opacity = '0.8';
                                }}
                                onMouseLeave={(e) => {
                                  (e.target as HTMLElement).style.opacity = '1';
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={styles.modalFooter}>
                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: 0 }}>
                  {teams.length} teams added
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowTeamModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
