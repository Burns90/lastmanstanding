import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  // For now, we'll use the Firebase REST API which doesn't require a service account
  // This is a temporary solution - you should eventually get a service account key
  // In production, download service account key from Firebase Console
  // and initialize with: admin.initializeApp({
  //   credential: admin.credential.cert(serviceAccountKey),
  // })
}

export default admin;
