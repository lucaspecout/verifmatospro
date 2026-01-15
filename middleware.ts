import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const authSecret = process.env.AUTH_SECRET ?? 'dev-secret-change-me';

const protectedRoutes = [
  '/dashboard',
  '/admin',
  '/stock',
  '/templates',
  '/events',
  '/anomalies',
  '/change-password'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!protectedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('verifmatospro_session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const decoded = jwt.verify(token, authSecret) as { role: string };
    const role = decoded.role;
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/stock') && !['ADMIN', 'MATERIEL'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/templates') && !['ADMIN', 'MATERIEL'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/anomalies') && !['ADMIN', 'MATERIEL'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/events') && !['ADMIN', 'CHEF'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next|api|public).*)']
};
