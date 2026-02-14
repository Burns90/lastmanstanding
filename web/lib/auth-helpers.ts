/**
 * Auth helper functions for username/email login support
 */

import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
} from 'firebase/firestore';

/**
 * Check if username is available (calls API to avoid exposing user data)
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (username.length < 3) return false;
  
  try {
    const response = await fetch('/api/auth/check-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    
    if (!response.ok) {
      console.error('Error checking username availability');
      return false;
    }
    
    const data = await response.json();
    return data.available;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
}

/**
 * Get user ID by username (for login)
 */
export async function getUserIdByUsername(
  username: string
): Promise<string | null> {
  const q = query(
    collection(db, 'users'),
    where('username', '==', username.toLowerCase()),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0].id;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<any | null> {
  const q = query(
    collection(db, 'users'),
    where('email', '==', email),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0].data();
}

/**
 * Get user document by ID
 */
export async function getUser(userId: string): Promise<any | null> {
  const docSnap = await getDoc(doc(db, 'users', userId));
  return docSnap.exists() ? docSnap.data() : null;
}
