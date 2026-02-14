import * as functions from "firebase-functions";
import { db } from "./firebase.js";
import * as admin from "firebase-admin";
import {
  LeagueParticipant,
  Selection,
  Round,
  Notification,
  LeagueWinner,
} from "../shared/types.js";

// ============================================================================
// ROUND STATE MANAGEMENT
// ============================================================================

/**
 * Lock a round: no more picks allowed
 * Called manually by admin via API
 */
export const lockRound = functions.https.onCall(
  async (request) => {
    if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "User not authenticated");

    const { leagueId, roundId } = request.data;

    // Check admin permission
    const league = await db.collection("leagues").doc(leagueId).get();
    if (league.data()?.ownerId !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Only league owner can lock rounds");
    }

    // Update round status
    await db
      .collection("leagues")
      .doc(leagueId)
      .collection("rounds")
      .doc(roundId)
      .update({ status: "LOCKED", updatedAt: admin.firestore.Timestamp.now() });

    // Auto-eliminate no-picks
    const participants = await db
      .collection("leagues")
      .doc(leagueId)
      .collection("participants")
      .where("eliminated", "==", false)
      .get();

    const batch = db.batch();

    for (const participant of participants.docs) {
      const selection = await db
        .collection("leagues")
        .doc(leagueId)
        .collection("rounds")
        .doc(roundId)
        .collection("selections")
        .where("userId", "==", participant.id)
        .get();

      if (selection.empty) {
        // No pick = elimination
        const roundData = (
          await db
            .collection("leagues")
            .doc(leagueId)
            .collection("rounds")
            .doc(roundId)
            .get()
        ).data() as Round;

        batch.update(
          db
            .collection("leagues")
            .doc(leagueId)
            .collection("participants")
            .doc(participant.id),
          {
            eliminated: true,
            eliminatedAtRound: roundData.number,
            eliminatedReason: "NO_PICK",
          }
        );

        // Send notification
        const notificationRef = db
          .collection("notifications")
          .doc();
        batch.set(notificationRef, {
          id: notificationRef.id,
          leagueId,
          userId: participant.data().userId,
          type: "ELIMINATED",
          title: "You've been eliminated",
          message: "No pick was made before the deadline.",
          read: false,
          sentAt: admin.firestore.Timestamp.now(),
        } as Notification);
      }
    }

    await batch.commit();

    return { success: true, message: "Round locked, no-picks eliminated" };
  }
);

// ============================================================================
// ROUND VALIDATION
// ============================================================================

/**
 * Validate a round: apply fixture results
 * Called manually by admin after lock
 */
export const validateRound = functions.https.onCall(
  async (request) => {
    if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "User not authenticated");

    const { leagueId, roundId } = request.data;

    // Check admin permission
    const league = await db.collection("leagues").doc(leagueId).get();
    if (league.data()?.ownerId !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Only league owner can validate rounds");
    }

    const roundData = (
      await db
        .collection("leagues")
        .doc(leagueId)
        .collection("rounds")
        .doc(roundId)
        .get()
    ).data() as Round;

    if (roundData.status !== "LOCKED") {
      throw new functions.https.HttpsError("failed-precondition", "Round must be locked before validation");
    }

    // Get all selections for this round
    const selections = await db
      .collection("leagues")
      .doc(leagueId)
      .collection("rounds")
      .doc(roundId)
      .collection("selections")
      .get();

    const batch = db.batch();

    for (const selectionDoc of selections.docs) {
      const selection = selectionDoc.data() as Selection;

      // Get fixture result
      const fixtureDoc = await db
        .collection("cachedFixtures")
        .doc(selection.fixtureId)
        .get();
      const fixture = fixtureDoc.data();

      if (fixture?.status === "FINISHED") {
        let result: "WIN" | "LOSS" | "DRAW";

        if (fixture.homeScore === fixture.awayScore) {
          result = "DRAW"; // Draw = loss
        } else if (
          (fixture.homeTeamId === selection.selectedTeamId &&
            fixture.homeScore > fixture.awayScore) ||
          (fixture.awayTeamId === selection.selectedTeamId &&
            fixture.awayScore > fixture.homeScore)
        ) {
          result = "WIN";
        } else {
          result = "LOSS";
        }

        // Check for admin overrides
        const override = await db
          .collection("leagues")
          .doc(leagueId)
          .collection("rounds")
          .doc(roundId)
          .collection("adminOverrides")
          .where("selectionId", "==", selectionDoc.id)
          .limit(1)
          .get();

        if (!override.empty) {
          result = override.docs[0].data().overrideResult;
        }

        // Update selection with result
        batch.update(
          db
            .collection("leagues")
            .doc(leagueId)
            .collection("rounds")
            .doc(roundId)
            .collection("selections")
            .doc(selectionDoc.id),
          { result, updatedAt: admin.firestore.Timestamp.now() }
        );

        // If loss or draw, eliminate user
        if (result !== "WIN") {
          const participant = await db
            .collection("leagues")
            .doc(leagueId)
            .collection("participants")
            .where("userId", "==", selection.userId)
            .limit(1)
            .get();

          if (!participant.empty && !participant.docs[0].data().eliminated) {
            batch.update(
              db
                .collection("leagues")
                .doc(leagueId)
                .collection("participants")
                .doc(participant.docs[0].id),
              {
                eliminated: true,
                eliminatedAtRound: roundData.number,
                eliminatedReason: "LOSS",
              }
            );

            // Send notification
            const notificationRef = db.collection("notifications").doc();
            batch.set(notificationRef, {
              id: notificationRef.id,
              leagueId,
              userId: selection.userId,
              type: "ELIMINATED",
              title: "You've been eliminated",
              message: `Your team ${result === "DRAW" ? "drew" : "lost"}. Better luck next time!`,
              read: false,
              sentAt: admin.firestore.Timestamp.now(),
            } as Notification);
          }
        }
      }
    }

    // Update round status
    batch.update(
      db
        .collection("leagues")
        .doc(leagueId)
        .collection("rounds")
        .doc(roundId),
      { status: "VALIDATED", updatedAt: admin.firestore.Timestamp.now() }
    );

    await batch.commit();

    // Check if league is complete
    await checkLeagueCompletion(leagueId);

    return { success: true, message: "Round validated" };
  }
);

// ============================================================================
// ADMIN OVERRIDES
// ============================================================================

/**
 * Override a selection result (before or after validation)
 */
export const overrideSelectionResult = functions.https.onCall(
  async (request) => {
    if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "User not authenticated");

    const { leagueId, roundId, selectionId, overrideResult, reason } = request.data;

    // Check admin permission
    const league = await db.collection("leagues").doc(leagueId).get();
    if (league.data()?.ownerId !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Only league owner can override results");
    }

    // Get selection
    const selection = (
      await db
        .collection("leagues")
        .doc(leagueId)
        .collection("rounds")
        .doc(roundId)
        .collection("selections")
        .doc(selectionId)
        .get()
    ).data() as Selection;

    // Create override record
    const overrideRef = db
      .collection("leagues")
      .doc(leagueId)
      .collection("rounds")
      .doc(roundId)
      .collection("adminOverrides")
      .doc();

    await overrideRef.set({
      id: overrideRef.id,
      leagueId,
      roundId,
      selectionId,
      userId: selection.userId,
      originalResult: selection.result,
      overrideResult,
      reason,
      createdBy: request.auth.uid,
      createdAt: admin.firestore.Timestamp.now(),
    });

    // Update selection if round is already validated
    const roundData = (
      await db
        .collection("leagues")
        .doc(leagueId)
        .collection("rounds")
        .doc(roundId)
        .get()
    ).data() as Round;

    if (roundData.status === "VALIDATED") {
      // Need to recalculate eliminations
      await recalculateEliminationsForUser(leagueId, selection.userId);
    }

    return { success: true, message: "Result override applied" };
  }
);

/**
 * Reverse/delete an override
 */
export const reverseOverride = functions.https.onCall(
  async (request) => {
    if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "User not authenticated");

    const { leagueId, roundId, overrideId } = request.data;

    // Check admin permission
    const league = await db.collection("leagues").doc(leagueId).get();
    if (league.data()?.ownerId !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Only league owner can reverse overrides");
    }

    const override = (
      await db
        .collection("leagues")
        .doc(leagueId)
        .collection("rounds")
        .doc(roundId)
        .collection("adminOverrides")
        .doc(overrideId)
        .get()
    ).data() as any;

    if (!override) {
      throw new functions.https.HttpsError("not-found", "Override not found");
    }

    await db
      .collection("leagues")
      .doc(leagueId)
      .collection("rounds")
      .doc(roundId)
      .collection("adminOverrides")
      .doc(overrideId)
      .delete();

    // Recalculate for user
    await recalculateEliminationsForUser(leagueId, override.userId);

    return { success: true, message: "Override reversed" };
  }
);

// ============================================================================
// MANUAL NOTIFICATIONS
// ============================================================================

/**
 * Send manual notification from admin to players
 */
export const sendManualNotification = functions.https.onCall(
  async (request) => {
    if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "User not authenticated");

    const { leagueId, audience, roundId, title, message } = request.data;

    // Check admin permission
    const league = await db.collection("leagues").doc(leagueId).get();
    if (league.data()?.ownerId !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Only league owner can send notifications");
    }

    // Get participants
    let targetUserIds: string[] = [];

    if (audience === "ALL_PLAYERS") {
      const participants = await db
        .collection("leagues")
        .doc(leagueId)
        .collection("participants")
        .get();
      targetUserIds = participants.docs.map((d: any) => (d.data() as LeagueParticipant).userId);
    } else if (audience === "UNPICKED" && roundId) {
      // Get all active participants
      const participants = await db
        .collection("leagues")
        .doc(leagueId)
        .collection("participants")
        .where("eliminated", "==", false)
        .get();

      // Find those without selections
      const participantIds = participants.docs.map(
        (d: any) => (d.data() as LeagueParticipant).userId
      );

      const selections = await db
        .collection("leagues")
        .doc(leagueId)
        .collection("rounds")
        .doc(roundId)
        .collection("selections")
        .get();

      const selectedUserIds = selections.docs.map(
        (d: any) => (d.data() as Selection).userId
      );

      targetUserIds = participantIds.filter(
        (id: any) => !selectedUserIds.includes(id)
      );
    }

    // Create notifications
    const batch = db.batch();

    for (const userId of targetUserIds) {
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, {
        id: notificationRef.id,
        leagueId,
        userId,
        type: "ADMIN_MESSAGE",
        title,
        message,
        read: false,
        sentAt: admin.firestore.Timestamp.now(),
      } as Notification);
    }

    await batch.commit();

    return {
      success: true,
      message: `Notification sent to ${targetUserIds.length} player(s)`,
    };
  }
);

/**
 * Manually eliminate a participant
 */
export const manuallyEliminateParticipant = functions.https.onCall(
  async (request) => {
    if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "User not authenticated");

    const { leagueId, participantId, roundNumber } = request.data;

    // Check admin permission
    const league = await db.collection("leagues").doc(leagueId).get();
    if (league.data()?.ownerId !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Only league owner can eliminate players");
    }

    // Get participant
    const participant = await db
      .collection("leagues")
      .doc(leagueId)
      .collection("participants")
      .doc(participantId)
      .get();

    if (!participant.exists) {
      throw new functions.https.HttpsError("not-found", "Participant not found");
    }

    const participantData = participant.data() as LeagueParticipant;
    const batch = db.batch();

    // Update participant
    batch.update(
      db
        .collection("leagues")
        .doc(leagueId)
        .collection("participants")
        .doc(participantId),
      {
        eliminated: true,
        eliminatedAtRound: roundNumber,
        eliminatedReason: "ADMIN",
      }
    );

    // Send notification
    const notificationRef = db.collection("notifications").doc();
    batch.set(notificationRef, {
      id: notificationRef.id,
      leagueId,
      userId: participantData.userId,
      type: "ELIMINATED",
      title: "You've been eliminated",
      message: `You were manually eliminated by the league admin in Round ${roundNumber}.`,
      read: false,
      sentAt: admin.firestore.Timestamp.now(),
    } as Notification);

    await batch.commit();

    return { success: true, message: "Player eliminated successfully" };
  }
);

/**
 * Recalculate whether a user should be eliminated based on all their picks
 */
async function recalculateEliminationsForUser(
  leagueId: string,
  userId: string
): Promise<void> {
  const participant = (
    await db
      .collection("leagues")
      .doc(leagueId)
      .collection("participants")
      .where("userId", "==", userId)
      .limit(1)
      .get()
  ).docs[0];

  // Get all selections for this user up to latest validated round
  const selections = await db
    .collectionGroup("selections")
    .where("leagueId", "==", leagueId)
    .where("userId", "==", userId)
    .get();

  let stillAlive = true;

  for (const selectionDoc of selections.docs) {
    const selection = selectionDoc.data() as Selection;
    if (selection.result === "LOSS" || selection.result === "DRAW") {
      stillAlive = false;
      break;
    }
  }

  if (!stillAlive) {
    // Find at which round they lost
    const rounds = await db
      .collection("leagues")
      .doc(leagueId)
      .collection("rounds")
      .orderBy("number", "asc")
      .get();

    let eliminatedAtRound = 1;
    for (const roundDoc of rounds.docs) {
      const selection = selections.docs.find(
        (s: any) => (s.data() as Selection).roundId === roundDoc.id
      );
      if (selection) {
        const sel = selection.data() as Selection;
        if (sel.result === "LOSS" || sel.result === "DRAW") {
          eliminatedAtRound = (roundDoc.data() as Round).number;
          break;
        }
      }
    }

    await db
      .collection("leagues")
      .doc(leagueId)
      .collection("participants")
      .doc(participant.id)
      .update({
        eliminated: true,
        eliminatedAtRound,
        eliminatedReason: "LOSS",
      });
  } else {
    // Keep them alive if they somehow were marked eliminated
    await db
      .collection("leagues")
      .doc(leagueId)
      .collection("participants")
      .doc(participant.id)
      .update({
        eliminated: false,
      });
  }
}

/**
 * Check if league is complete (no active players left)
 */
async function checkLeagueCompletion(leagueId: string): Promise<void> {
  const activeParticipants = await db
    .collection("leagues")
    .doc(leagueId)
    .collection("participants")
    .where("eliminated", "==", false)
    .get();

  if (activeParticipants.empty) {
    // League is done, determine winners from last round standing
    const allParticipants = await db
      .collection("leagues")
      .doc(leagueId)
      .collection("participants")
      .get();

    const batch = db.batch();

    // Get all rounds to find highest number
    const rounds = await db
      .collection("leagues")
      .doc(leagueId)
      .collection("rounds")
      .orderBy("number", "desc")
      .limit(1)
      .get();

    const lastRoundNumber = rounds.docs[0] ? (rounds.docs[0].data() as Round).number : 0;

    for (const participant of allParticipants.docs) {
      const participantData = participant.data() as LeagueParticipant;
      if (participantData.eliminatedReason === "LOSS") {
        // Only last round losses are winners (earliest elimination = joint winners)
        if (participantData.eliminatedAtRound === lastRoundNumber) {
          const winnerRef = db.collection("leagueWinners").doc();
          batch.set(winnerRef, {
            id: winnerRef.id,
            leagueId,
            userId: participantData.userId,
            createdAt: admin.firestore.Timestamp.now(),
          } as LeagueWinner);
        }
      }
    }

    // Update league status
    batch.update(db.collection("leagues").doc(leagueId), {
      status: "COMPLETED",
      updatedAt: admin.firestore.Timestamp.now(),
    });

    await batch.commit();

    // Send winner notification
    await notifyLeagueWinners(leagueId);
  }
}

/**
 * Send notifications to all winners
 */
async function notifyLeagueWinners(leagueId: string): Promise<void> {
  const winners = await db
    .collection("leagueWinners")
    .where("leagueId", "==", leagueId)
    .get();

  const batch = db.batch();

  for (const winner of winners.docs) {
    const winnerData = winner.data() as LeagueWinner;
    const notificationRef = db.collection("notifications").doc();

    batch.set(notificationRef, {
      id: notificationRef.id,
      leagueId,
      userId: winnerData.userId,
      type: "LEAGUE_WINNER",
      title: "🎉 You won!",
      message: "Congratulations! You are a league winner.",
      read: false,
      sentAt: admin.firestore.Timestamp.now(),
    } as Notification);
  }

  await batch.commit();
}
