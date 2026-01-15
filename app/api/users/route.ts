import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userSchema } from '@/lib/validation';
import { getSession, hashPassword } from '@/lib/auth';

const tempPassword = () => `Tmp${Math.random().toString(36).slice(2, 8)}!`;

export async function GET() {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = userSchema.parse(await request.json());
    const password = tempPassword();
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        role: payload.role,
        isActive: payload.isActive ?? true,
        forcePasswordChange: true,
        passwordHash
      }
    });
    return NextResponse.json({ id: user.id, tempPassword: password });
  } catch (error) {
    return NextResponse.json({ message: 'Erreur création utilisateur.' }, { status: 400 });
  }
}
