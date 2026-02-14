import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";
import {
  League,
  Round,
  LeagueParticipant,
  Selection,
  AdminOverride,
} from "../../../shared/types";

// ============================================================================
// LEAGUE MANAGEMENT
// ============================================================================

export async function createLeague(
  leagueData: Omit<League, "id" | "createdAt" | "updatedAt">
): Promise<League> {
  const leagueRef = await addDoc(collection(db, "leagues"), {
    ...leagueData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return {
    ...leagueData,
    id: leagueRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function getLeague(leagueId: string): Promise<League | null> {
  const docSnap = await getDoc(doc(db, "leagues", leagueId));
  return docSnap.exists() ? (docSnap.data() as League) : null;
}

export async function updateLeague(
  leagueId: string,
  updates: Partial<League>
): Promise<void> {
  await updateDoc(doc(db, "leagues", leagueId), {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// ROUND MANAGEMENT
// ============================================================================

export async function createRound(
  leagueId: string,
  roundData: Omit<Round, "id" | "createdAt" | "updatedAt">
): Promise<Round> {
  const roundRef = await addDoc(
    collection(db, "leagues", leagueId, "rounds"),
    {
      ...roundData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }
  );

  return {
    ...roundData,
    id: roundRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function getRound(
  leagueId: string,
  roundId: string
): Promise<Round | null> {
  const docSnap = await getDoc(
    doc(db, "leagues", leagueId, "rounds", roundId)
  );
  return docSnap.exists() ? (docSnap.data() as Round) : null;
}

export async function getLeagueRounds(leagueId: string): Promise<Round[]> {
  const q = query(collection(db, "leagues", leagueId, "rounds"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => doc.data() as Round);
}

// ============================================================================
// ROUND STATE MANAGEMENT
// ============================================================================

export async function lockRound(
  leagueId: string,
  roundId: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/rounds/lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ leagueId, roundId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to lock round");
  }
}

export async function validateRound(
  leagueId: string,
  roundId: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/rounds/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ leagueId, roundId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to validate round");
  }
}

// ============================================================================
// SELECTIONS
// ============================================================================

export async function makeSelection(
  leagueId: string,
  roundId: string,
  selectionData: Omit<Selection, "id" | "createdAt" | "updatedAt">
): Promise<Selection> {
  const selectionRef = await addDoc(
    collection(db, "leagues", leagueId, "rounds", roundId, "selections"),
    {
      ...selectionData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }
  );

  return {
    ...selectionData,
    id: selectionRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function getSelections(
  leagueId: string,
  roundId: string
): Promise<Selection[]> {
  const q = query(
    collection(db, "leagues", leagueId, "rounds", roundId, "selections")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => doc.data() as Selection);
}

export async function getUserSelection(
  leagueId: string,
  roundId: string,
  userId: string
): Promise<Selection | null> {
  const q = query(
    collection(db, "leagues", leagueId, "rounds", roundId, "selections"),
    where("userId", "==", userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.length > 0
    ? (querySnapshot.docs[0].data() as Selection)
    : null;
}

// ============================================================================
// ADMIN OVERRIDES
// ============================================================================

export async function overrideSelectionResult(
  leagueId: string,
  roundId: string,
  selectionId: string,
  overrideResult: "WIN" | "LOSS" | "DRAW",
  reason: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/selections/override", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      leagueId,
      roundId,
      selectionId,
      overrideResult,
      reason,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to override selection");
  }
}

export async function reverseOverride(
  leagueId: string,
  roundId: string,
  overrideId: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/selections/reverse-override", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ leagueId, roundId, overrideId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reverse override");
  }
}

export async function getOverrides(
  leagueId: string,
  roundId: string
): Promise<AdminOverride[]> {
  const q = query(
    collection(db, "leagues", leagueId, "rounds", roundId, "adminOverrides")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => doc.data() as AdminOverride);
}

// ============================================================================
// PARTICIPANTS
// ============================================================================

export async function getLeagueParticipants(
  leagueId: string
): Promise<LeagueParticipant[]> {
  const q = query(collection(db, "leagues", leagueId, "participants"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => doc.data() as LeagueParticipant);
}

export async function getActiveParticipants(
  leagueId: string
): Promise<LeagueParticipant[]> {
  const q = query(
    collection(db, "leagues", leagueId, "participants"),
    where("eliminated", "==", false)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => doc.data() as LeagueParticipant);
}

export async function manuallyEliminateParticipant(
  leagueId: string,
  participantId: string,
  roundNumber: number
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/participants/eliminate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ leagueId, participantId, roundNumber }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to eliminate participant");
  }
}
