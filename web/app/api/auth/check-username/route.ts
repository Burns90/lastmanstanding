import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/check-username
 * Check if a username is available (without exposing full user data)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { available: false, reason: 'Username must be at least 3 characters' },
        { status: 200 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json(
        { available: false, reason: 'Username can only contain letters, numbers, underscores, and hyphens' },
        { status: 200 }
      );
    }

    // Check if username exists in Firestore
    const q = query(
      collection(db, 'users'),
      where('username', '==', username.toLowerCase())
    );
    const snapshot = await getDocs(q);

    const available = snapshot.empty;

    return NextResponse.json(
      { available },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error checking username:', error);
    return NextResponse.json(
      { error: 'Failed to check username availability' },
      { status: 500 }
    );
  }
}
