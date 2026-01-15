import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'MATERIEL';

export async function GET() {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const anomalies = await prisma.verificationLine.findMany({
    where: { status: 'MISSING' },
    include: { eventChecklistItem: { include: { section: { include: { event: true } } } } },
    orderBy: { updatedAt: 'desc' }
  });
  return NextResponse.json(anomalies);
}
