import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { query, collection, where, getDocs, limit } from 'firebase/firestore';

/**
 * POST /api/auth/forgot-password
 * Send a password reset email to the user
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Verify email exists in Firestore
    const q = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase()),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Don't reveal whether email exists for security
      return NextResponse.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    }

    // Send password reset email using Firebase
    try {
      await sendPasswordResetEmail(auth, email);
      
      return NextResponse.json({
        success: true,
        message: 'Password reset email sent successfully',
      });
    } catch (firebaseError: any) {
      console.error('Firebase error sending reset email:', firebaseError);
      
      // Return generic error message
      return NextResponse.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    }
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process password reset' },
      { status: 500 }
    );
  }
}
