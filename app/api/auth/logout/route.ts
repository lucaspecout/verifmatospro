import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  clearAuthCookie();
  return NextResponse.redirect(new URL('/login', request.url));
}
