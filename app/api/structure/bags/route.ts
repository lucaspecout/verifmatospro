import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bagSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'MATERIEL';

export async function GET() {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const bags = await prisma.bag.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(bags);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = bagSchema.parse(await request.json());
    const bag = await prisma.bag.create({ data: payload });
    return NextResponse.json(bag);
  } catch {
    return NextResponse.json({ message: 'Erreur création sac.' }, { status: 400 });
  }
}
