import { NextRequest, NextResponse } from 'next/server';
import { AVAILABLE_COMPETITIONS } from '@/lib/competitions';

/**
 * Get available football competitions
 * GET /api/competitions
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      competitions: AVAILABLE_COMPETITIONS,
    });
  } catch (error: any) {
    console.error('Get competitions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch competitions' },
      { status: 500 }
    );
  }
}
