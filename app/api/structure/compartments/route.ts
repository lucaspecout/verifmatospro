import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compartmentSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'MATERIEL';

export async function GET() {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const compartments = await prisma.compartment.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(compartments);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = compartmentSchema.parse(await request.json());
    const compartment = await prisma.compartment.create({ data: payload });
    return NextResponse.json(compartment);
  } catch {
    return NextResponse.json({ message: 'Erreur création compartiment.' }, { status: 400 });
  }
}
