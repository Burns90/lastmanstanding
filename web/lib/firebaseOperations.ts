/**
 * Client-side Firebase operations
 * Replaces API routes with direct calls to Firestore and Cloud Functions
 */

import {
  httpsCallable,
} from "firebase/functions";
import {
  query,
  collection,
  where,
  getDocs,
  limit,
  doc,
  setDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { functions, db, auth } from "./firebase";

// ============================================================================
// CLOUD FUNCTIONS WRAPPERS
// ============================================================================

export async function lockRound(leagueId: string, roundId: string) {
  const lockRoundFn = httpsCallable(functions, "lockRound");
  return lockRoundFn({ leagueId, roundId });
}

export async function validateRound(leagueId: string, roundId: string) {
  const validateRoundFn = httpsCallable(functions, "validateRound");
  return validateRoundFn({ leagueId, roundId });
}

export async function manuallyEliminateParticipant(
  leagueId: string,
  participantId: string,
  roundNumber: number
) {
  const eliminateFn = httpsCallable(functions, "manuallyEliminateParticipant");
  return eliminateFn({ leagueId, participantId, roundNumber });
}

export async function overrideSelectionResult(
  leagueId: string,
  roundId: string,
  selectionId: string,
  overrideResult: "WIN" | "LOSS" | "DRAW",
  reason: string
) {
  const overrideFn = httpsCallable(functions, "overrideSelectionResult");
  return overrideFn({
    leagueId,
    roundId,
    selectionId,
    overrideResult,
    reason,
  });
}

export async function reverseOverride(
  leagueId: string,
  roundId: string,
  overrideId: string
) {
  const reverseFn = httpsCallable(functions, "reverseOverride");
  return reverseFn({ leagueId, roundId, overrideId });
}

export async function sendManualNotification(
  leagueId: string,
  audience: "ALL_PLAYERS" | "UNPICKED",
  title: string,
  message: string,
  roundId?: string
) {
  const notifyFn = httpsCallable(functions, "sendManualNotification");
  return notifyFn({ leagueId, audience, roundId, title, message });
}

// ============================================================================
// FIRESTORE OPERATIONS (replacing API routes)
// ============================================================================

/**
 * Look up email by username for login
 */
export async function lookupUsernameForLogin(
  usernameOrEmail: string
): Promise<string> {
  if (usernameOrEmail.includes("@")) {
    // It's already an email
    return usernameOrEmail;
  }

  // Look up username in Firestore
  const q = query(
    collection(db, "users"),
    where("username", "==", usernameOrEmail.toLowerCase()),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error("Username not found");
  }

  return snapshot.docs[0].data().email;
}

/**
 * Check if username is available
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const q = query(
    collection(db, "users"),
    where("username", "==", username.toLowerCase()),
    limit(1)
  );

  const snapshot = await getDocs(q);
  return snapshot.empty;
}

/**
 * Get all competitions with their teams
 */
export async function getCompetitions() {
  try {
    const snapshot = await getDocs(collection(db, "competitions"));
    const competitions: any[] = [];

    for (const doc of snapshot.docs) {
      const teamsSnapshot = await getDocs(
        collection(db, "competitions", doc.id, "teams")
      );
      competitions.push({
        id: doc.id,
        ...doc.data(),
        teams: teamsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
    }

    return competitions;
  } catch (error) {
    console.error("Error fetching competitions:", error);
    throw error;
  }
}

/**
 * Get teams for a specific competition
 */
export async function getCompetitionTeams(competitionCode: string) {
  try {
    const snapshot = await getDocs(
      collection(db, "competitions", competitionCode, "teams")
    );
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching competition teams:", error);
    throw error;
  }
}

/**
 * Get fixtures for a specific competition
 */
export async function getCompetitionFixtures(competitionCode: string) {
  try {
    const snapshot = await getDocs(
      collection(db, "competitions", competitionCode, "fixtures")
    );
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching fixtures:", error);
    throw error;
  }
}

/**
 * Add a team to manage (admin operation)
 */
export async function addTeamToManage(
  teamId: string,
  teamName: string
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    const teamsRef = collection(db, "competitions", "manual", "teams");
    await addDoc(teamsRef, {
      id: teamId,
      name: teamName,
      createdAt: Timestamp.now(),
      createdBy: auth.currentUser.uid,
    });
  } catch (error) {
    console.error("Error adding team:", error);
    throw error;
  }
}

/**
 * Delete a managed team (admin operation)
 */
export async function deleteTeamFromManage(teamId: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Query to find the team and delete it
    const q = query(
      collection(db, "competitions", "manual", "teams"),
      where("id", "==", teamId)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Delete the first matching team document
      const teamDoc = snapshot.docs[0];
      await setDoc(doc(db, "competitions", "manual", "teams", teamDoc.id), {}, { merge: false });
    }
  } catch (error) {
    console.error("Error deleting team:", error);
    throw error;
  }
}

/**
 * Send forgot password email
 */
export async function sendForgotPasswordEmail(email: string): Promise<void> {
  try {
    const { sendPasswordResetEmail } = await import("firebase/auth");
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}
