import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userSchema } from '@/lib/validation';
import { getSession, hashPassword } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = userSchema.partial().parse(await request.json());
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        email: payload.email,
        role: payload.role,
        isActive: payload.isActive
      }
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ message: 'Erreur mise à jour.' }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ message: 'Supprimé' });
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const newPassword = `Reset${Math.random().toString(36).slice(2, 8)}!`;
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: params.id },
    data: { passwordHash, forcePasswordChange: true }
  });
  return NextResponse.json({ tempPassword: newPassword });
}
