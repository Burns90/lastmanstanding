/**
 * Server-side Firebase helper functions for API routes
 * Uses Firestore client SDK (not admin SDK since we run on Next.js, not Cloud Functions)
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
  updateDoc,
  limit,
  orderBy,
} from 'firebase/firestore';
import {
  Round,
  Selection,
  Notification,
  LeagueParticipant,
  LeagueWinner,
} from '../../shared/types';

/**
 * Check if user is league owner
 */
export async function isLeagueOwner(
  leagueId: string,
  userId: string
): Promise<boolean> {
  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueDoc = await getDoc(leagueRef);
  return leagueDoc.exists() && leagueDoc.data().ownerId === userId;
}

/**
 * Verify user has access to league as participant or owner
 */
export async function hasLeagueAccess(
  leagueId: string,
  userId: string
): Promise<boolean> {
  // Check if owner
  const isOwner = await isLeagueOwner(leagueId, userId);
  if (isOwner) return true;

  // Check if participant
  const participantQuery = query(
    collection(db, 'leagues', leagueId, 'participants'),
    where('userId', '==', userId),
    limit(1)
  );
  const participantSnap = await getDocs(participantQuery);
  return !participantSnap.empty;
}

/**
 * Auto-eliminate no-picks and return eliminated users
 */
export async function eliminateNoPicks(
  leagueId: string,
  roundId: string
): Promise<{ eliminatedCount: number; eliminatedUserIds: string[] }> {
  const roundRef = doc(db, 'leagues', leagueId, 'rounds', roundId);
  const roundSnap = await getDoc(roundRef);
  if (!roundSnap.exists()) {
    throw new Error('Round not found');
  }
  const roundData = roundSnap.data() as Round;

  // Get all non-eliminated participants
  const participantsQuery = query(
    collection(db, 'leagues', leagueId, 'participants'),
    where('eliminated', '==', false)
  );
  const participantsSnap = await getDocs(participantsQuery);

  const batch = writeBatch(db);
  const eliminatedUserIds: string[] = [];

  for (const participantDoc of participantsSnap.docs) {
    const participantData = participantDoc.data() as LeagueParticipant;

    // Check if has selection for this round
    const selectionQuery = query(
      collection(db, 'leagues', leagueId, 'rounds', roundId, 'selections'),
      where('userId', '==', participantData.userId),
      limit(1)
    );
    const selectionSnap = await getDocs(selectionQuery);

    // No pick = elimination
    if (selectionSnap.empty) {
      const participantRef = doc(
        db,
        'leagues',
        leagueId,
        'participants',
        participantDoc.id
      );
      batch.update(participantRef, {
        eliminated: true,
        eliminatedAtRound: roundData.number,
        eliminatedReason: 'NO_PICK',
      });

      // Send notification
      const notificationRef = doc(collection(db, 'notifications'));
      batch.set(notificationRef, {
        id: notificationRef.id,
        leagueId,
        userId: participantData.userId,
        type: 'ELIMINATED',
        title: "You've been eliminated",
        message: 'No pick was made before the deadline.',
        read: false,
        sentAt: Timestamp.now(),
      } as Notification);

      eliminatedUserIds.push(participantData.userId);
    }
  }

  await batch.commit();
  return { eliminatedCount: eliminatedUserIds.length, eliminatedUserIds };
}

/**
 * Validate round: apply fixture results and eliminate losers
 */
export async function validateRoundResults(
  leagueId: string,
  roundId: string
): Promise<{ eliminatedCount: number; processedSelections: number }> {
  const roundRef = doc(db, 'leagues', leagueId, 'rounds', roundId);
  const roundSnap = await getDoc(roundRef);
  if (!roundSnap.exists()) {
    throw new Error('Round not found');
  }
  const roundData = roundSnap.data() as Round;

  if (roundData.status !== 'LOCKED') {
    throw new Error('Round must be locked before validation');
  }

  // Get all selections for this round
  const selectionsQuery = query(
    collection(db, 'leagues', leagueId, 'rounds', roundId, 'selections')
  );
  const selectionsSnap = await getDocs(selectionsQuery);

  // Get all fixtures for this round
  const fixturesQuery = query(
    collection(db, 'leagues', leagueId, 'rounds', roundId, 'fixtures')
  );
  const fixturesSnap = await getDocs(fixturesQuery);
  const fixtureMap = new Map(fixturesSnap.docs.map((d) => [d.id, d.data()]));

  const batch = writeBatch(db);
  let eliminatedCount = 0;
  let processedCount = 0;

  for (const selectionDoc of selectionsSnap.docs) {
    const selection = selectionDoc.data() as Selection;
    processedCount++;

    // Get fixture result from the round's fixtures subcollection
    const fixture = fixtureMap.get(selection.fixtureId);

    if (fixture?.status === 'FINISHED') {
      let result: 'WIN' | 'LOSS' | 'DRAW';

      if (fixture.homeScore === fixture.awayScore) {
        result = 'DRAW'; // Draw = loss
      } else if (
        (fixture.homeTeamId === selection.selectedTeamId &&
          fixture.homeScore > fixture.awayScore) ||
        (fixture.awayTeamId === selection.selectedTeamId &&
          fixture.awayScore > fixture.homeScore)
      ) {
        result = 'WIN';
      } else {
        result = 'LOSS';
      }

      // Check for admin overrides
      const overrideQuery = query(
        collection(db, 'leagues', leagueId, 'rounds', roundId, 'adminOverrides'),
        where('selectionId', '==', selectionDoc.id),
        limit(1)
      );
      const overrideSnap = await getDocs(overrideQuery);

      if (!overrideSnap.empty) {
        result = overrideSnap.docs[0].data().overrideResult;
      }

      // Update selection with result
      const selectionRef = doc(
        db,
        'leagues',
        leagueId,
        'rounds',
        roundId,
        'selections',
        selectionDoc.id
      );
      batch.update(selectionRef, {
        result,
        updatedAt: Timestamp.now(),
      });

      // If loss or draw, eliminate user
      if (result !== 'WIN') {
        const participantQuery = query(
          collection(db, 'leagues', leagueId, 'participants'),
          where('userId', '==', selection.userId),
          limit(1)
        );
        const participantSnap = await getDocs(participantQuery);

        if (
          !participantSnap.empty &&
          !participantSnap.docs[0].data().eliminated
        ) {
          const participantRef = doc(
            db,
            'leagues',
            leagueId,
            'participants',
            participantSnap.docs[0].id
          );
          batch.update(participantRef, {
            eliminated: true,
            eliminatedAtRound: roundData.number,
            eliminatedReason: 'LOSS',
          });

          // Send notification
          const notificationRef = doc(collection(db, 'notifications'));
          batch.set(notificationRef, {
            id: notificationRef.id,
            leagueId,
            userId: selection.userId,
            type: 'ELIMINATED',
            title: "You've been eliminated",
            message: `Your team ${result === 'DRAW' ? 'drew' : 'lost'}. Better luck next time!`,
            read: false,
            sentAt: Timestamp.now(),
          } as Notification);

          eliminatedCount++;
        }
      }
    }
  }

  // Update round status
  batch.update(roundRef, {
    status: 'VALIDATED',
    updatedAt: Timestamp.now(),
  });

  await batch.commit();

  // Check if league is complete
  await checkLeagueCompletion(leagueId);

  return { eliminatedCount, processedSelections: processedCount };
}

/**
 * Recalculate eliminations for a user (used after overrides)
 */
export async function recalculateEliminationsForUser(
  leagueId: string,
  userId: string
): Promise<void> {
  // Get participant
  const participantQuery = query(
    collection(db, 'leagues', leagueId, 'participants'),
    where('userId', '==', userId),
    limit(1)
  );
  const participantSnap = await getDocs(participantQuery);
  if (participantSnap.empty) {
    throw new Error('Participant not found');
  }

  const participantDoc = participantSnap.docs[0];

  // Get all selections for this user
  const selectionsQuery = query(
    collection(db, 'leagues', leagueId, 'rounds'),
    orderBy('number', 'asc')
  );
  const roundsSnap = await getDocs(selectionsQuery);

  let stillAlive = true;
  let eliminatedAtRound = 1;

  for (const roundDoc of roundsSnap.docs) {
    const selectionQuery = query(
      collection(db, 'leagues', leagueId, 'rounds', roundDoc.id, 'selections'),
      where('userId', '==', userId),
      limit(1)
    );
    const selectionSnap = await getDocs(selectionQuery);

    if (!selectionSnap.empty) {
      const selection = selectionSnap.docs[0].data() as Selection;
      if (selection.result === 'LOSS' || selection.result === 'DRAW') {
        stillAlive = false;
        eliminatedAtRound = (roundDoc.data() as Round).number;
        break;
      }
    }
  }

  const participantRef = doc(
    db,
    'leagues',
    leagueId,
    'participants',
    participantDoc.id
  );

  if (!stillAlive) {
    await updateDoc(participantRef, {
      eliminated: true,
      eliminatedAtRound,
      eliminatedReason: 'LOSS',
    });
  } else {
    await updateDoc(participantRef, {
      eliminated: false,
    });
  }
}

/**
 * Check if league is complete and handle winner determination
 */
export async function checkLeagueCompletion(leagueId: string): Promise<void> {
  const activeParticipantsQuery = query(
    collection(db, 'leagues', leagueId, 'participants'),
    where('eliminated', '==', false)
  );
  const activeParticipantsSnap = await getDocs(activeParticipantsQuery);

  if (activeParticipantsSnap.empty) {
    // League is complete, find winners from last round standing
    const allParticipantsQuery = query(
      collection(db, 'leagues', leagueId, 'participants')
    );
    const allParticipantsSnap = await getDocs(allParticipantsQuery);

    // Get last round number
    const roundsQuery = query(
      collection(db, 'leagues', leagueId, 'rounds'),
      orderBy('number', 'desc'),
      limit(1)
    );
    const roundsSnap = await getDocs(roundsQuery);
    const lastRoundNumber = roundsSnap.docs[0]
      ? (roundsSnap.docs[0].data() as Round).number
      : 0;

    const batch = writeBatch(db);

    // Award winners (last round eliminations = winners)
    for (const participant of allParticipantsSnap.docs) {
      const participantData = participant.data() as LeagueParticipant;
      if (
        participantData.eliminatedReason === 'LOSS' &&
        participantData.eliminatedAtRound === lastRoundNumber
      ) {
        const winnerRef = doc(collection(db, 'leagueWinners'));
        batch.set(winnerRef, {
          id: winnerRef.id,
          leagueId,
          userId: participantData.userId,
          createdAt: Timestamp.now(),
        } as LeagueWinner);
      }
    }

    // Update league status
    const leagueRef = doc(db, 'leagues', leagueId);
    batch.update(leagueRef, {
      status: 'COMPLETED',
      updatedAt: Timestamp.now(),
    });

    await batch.commit();

    // Notify winners
    await notifyLeagueWinners(leagueId);
  }
}

/**
 * Send notifications to league winners
 */
export async function notifyLeagueWinners(leagueId: string): Promise<void> {
  const winnersQuery = query(
    collection(db, 'leagueWinners'),
    where('leagueId', '==', leagueId)
  );
  const winnersSnap = await getDocs(winnersQuery);

  const batch = writeBatch(db);

  for (const winnerDoc of winnersSnap.docs) {
    const winnerData = winnerDoc.data() as LeagueWinner;
    const notificationRef = doc(collection(db, 'notifications'));

    batch.set(notificationRef, {
      id: notificationRef.id,
      leagueId,
      userId: winnerData.userId,
      type: 'LEAGUE_WINNER',
      title: '🎉 You won!',
      message: 'Congratulations! You are a league winner.',
      read: false,
      sentAt: Timestamp.now(),
    } as Notification);
  }

  await batch.commit();
}
