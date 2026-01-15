import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { changePasswordSchema } from '@/lib/validation';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = changePasswordSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ message: 'Utilisateur introuvable' }, { status: 404 });
    }
    const valid = await verifyPassword(payload.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ message: 'Mot de passe actuel incorrect' }, { status: 400 });
    }
    const newHash = await hashPassword(payload.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, forcePasswordChange: false }
    });
    return NextResponse.json({ message: 'Mot de passe mis à jour.' });
  } catch {
    return NextResponse.json({ message: 'Erreur lors de la mise à jour.' }, { status: 400 });
  }
}
