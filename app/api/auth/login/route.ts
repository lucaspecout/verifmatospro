import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation';
import { setAuthCookie, signToken, verifyPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    const rate = checkRateLimit(ip, 5, 60_000);
    if (!rate.allowed) {
      return NextResponse.json({ message: 'Trop de tentatives. Réessayez plus tard.' }, { status: 429 });
    }

    const payload = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user || !user.isActive) {
      return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 401 });
    }

    const valid = await verifyPassword(payload.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 401 });
    }

    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(token);

    return NextResponse.json({ forcePasswordChange: user.forcePasswordChange });
  } catch (error) {
    return NextResponse.json({ message: 'Erreur de connexion.' }, { status: 400 });
  }
}
