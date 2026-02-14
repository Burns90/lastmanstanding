import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Notification } from "../../../shared/types";

// ============================================================================
// SEND NOTIFICATIONS
// ============================================================================

export async function sendManualNotification(
  leagueId: string,
  audience: "ALL_PLAYERS" | "UNPICKED",
  title: string,
  message: string,
  roundId?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/notifications/send-manual", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      leagueId,
      audience,
      roundId,
      title,
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send notification");
  }
}

// Alias for backward compatibility
export const sendPushNotification = sendManualNotification;

// ============================================================================
// RETRIEVE NOTIFICATIONS
// ============================================================================

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => doc.data() as Notification);
}

export async function getUnreadNotifications(
  userId: string
): Promise<Notification[]> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read", "==", false)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => doc.data() as Notification);
}

// ============================================================================
// MARK AS READ
// ============================================================================

export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  await updateDoc(doc(db, "notifications", notificationId), {
    read: true,
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read", "==", false)
  );
  const querySnapshot = await getDocs(q);

  for (const docSnap of querySnapshot.docs) {
    await updateDoc(doc(db, "notifications", docSnap.id), {
      read: true,
    });
  }
}
