import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { catalogSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'MATERIEL';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = catalogSchema.partial().parse(await request.json());
    const updated = await prisma.itemCatalog.update({
      where: { id: params.id },
      data: payload
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ message: 'Erreur mise à jour.' }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  await prisma.itemCatalog.delete({ where: { id: params.id } });
  return NextResponse.json({ message: 'Supprimé' });
}
