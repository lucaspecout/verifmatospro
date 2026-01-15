import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { catalogSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'MATERIEL';

export async function GET() {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const catalog = await prisma.itemCatalog.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(catalog);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = catalogSchema.parse(await request.json());
    const item = await prisma.itemCatalog.create({ data: payload });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ message: 'Erreur création catalogue.' }, { status: 400 });
  }
}
