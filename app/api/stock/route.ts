import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stockSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'MATERIEL';

export async function GET() {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const stock = await prisma.stockEntry.findMany({ include: { itemCatalog: true } });
  return NextResponse.json(stock);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = stockSchema.parse(await request.json());
    const entry = await prisma.stockEntry.create({ data: payload });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ message: 'Erreur création stock.' }, { status: 400 });
  }
}
