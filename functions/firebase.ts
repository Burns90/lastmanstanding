// Firebase Admin SDK configuration for Cloud Functions and backend
import admin from "firebase-admin";

// Initialize Firebase Admin (automatically done in Cloud Functions environment)
// but check if explicitly needed
try {
  admin.initializeApp();
} catch (err: any) {
  if (err.code !== "app/duplicate-app") {
    throw err;
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const messaging = admin.messaging();

// Helper to get a document by ID with type safety
export async function getDoc<T>(
  collection: string,
  docId: string
): Promise<T | null> {
  const snap = await db.collection(collection).doc(docId).get();
  return snap.exists ? (snap.data() as T) : null;
}

// Helper to set a document with merged data
export async function setDocData<T>(
  collection: string,
  docId: string,
  data: Partial<T>,
  merge = true
): Promise<void> {
  await db
    .collection(collection)
    .doc(docId)
    .set(data, { merge });
}

// Helper to query documents
export async function queryDocs<T>(
  collection: string,
  where?: [string, FirebaseFirestore.WhereFilterOp, unknown][]
): Promise<T[]> {
  let query: FirebaseFirestore.Query = db.collection(collection);

  if (where) {
    where.forEach(([field, operator, value]) => {
      query = query.where(field, operator, value);
    });
  }

  const snap = await query.get();
  return snap.docs.map((doc: any) => doc.data() as T);
}
