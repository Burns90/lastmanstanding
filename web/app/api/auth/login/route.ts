import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { query, collection, where, getDocs, limit } from 'firebase/firestore';

/**
 * Unified login endpoint supporting both username and email
 * POST /api/auth/login
 * Body: { usernameOrEmail: string, password: string }
 * 
 * NOTE: This endpoint handles username lookup only.
 * Actual authentication is done client-side with Firebase Auth.
 */
export async function POST(request: NextRequest) {
  try {
    const { usernameOrEmail } = await request.json();

    if (!usernameOrEmail) {
      return NextResponse.json(
        { error: 'Username or email is required' },
        { status: 400 }
      );
    }

    // If it's a username (doesn't contain @), look up the email
    if (!usernameOrEmail.includes('@')) {
      try {
        const q = query(
          collection(db, 'users'),
          where('username', '==', usernameOrEmail.toLowerCase()),
          limit(1)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          return NextResponse.json(
            { error: 'Username not found' },
            { status: 404 }
          );
        }

        const email = snapshot.docs[0].data().email;
        return NextResponse.json({
          success: true,
          email: email,
        });
      } catch (error: any) {
        console.error('Username lookup error:', error);
        return NextResponse.json(
          { error: 'Failed to look up username' },
          { status: 500 }
        );
      }
    }

    // If it's already an email, just return it
    return NextResponse.json({
      success: true,
      email: usernameOrEmail,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process login' },
      { status: 500 }
    );
  }
}
