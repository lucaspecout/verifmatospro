import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'CHEF';

const ensureOwner = async (eventId: string, userId: string, role: string) => {
  if (role !== 'CHEF') return true;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event?.createdByUserId === userId;
};

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const ok = await ensureOwner(params.id, session.user.id, session.user.role);
  if (!ok) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 403 });
  }
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) {
    return NextResponse.json({ message: 'Introuvable' }, { status: 404 });
  }
  return NextResponse.json(event);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const ok = await ensureOwner(params.id, session.user.id, session.user.role);
  if (!ok) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 403 });
  }
  try {
    const payload = eventSchema.partial().parse(await request.json());
    const updated = await prisma.event.update({
      where: { id: params.id },
      data: {
        title: payload.title,
        description: payload.description,
        status: payload.status
      }
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
  const ok = await ensureOwner(params.id, session.user.id, session.user.role);
  if (!ok) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 403 });
  }
  await prisma.event.delete({ where: { id: params.id } });
  return NextResponse.json({ message: 'Supprimé' });
}
