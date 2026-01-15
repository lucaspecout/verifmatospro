import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventChecklistItemSchema, eventChecklistSectionSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'CHEF';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  if (session.user.role === 'CHEF') {
    const event = await prisma.event.findUnique({ where: { id: params.id } });
    if (!event || event.createdByUserId !== session.user.id) {
      return NextResponse.json({ message: 'Non autorisé' }, { status: 403 });
    }
  }
  const sections = await prisma.eventChecklistSection.findMany({
    where: { eventId: params.id },
    include: { items: true },
    orderBy: { order: 'asc' }
  });
  return NextResponse.json(sections);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  if (session.user.role === 'CHEF') {
    const event = await prisma.event.findUnique({ where: { id: params.id } });
    if (!event || event.createdByUserId !== session.user.id) {
      return NextResponse.json({ message: 'Non autorisé' }, { status: 403 });
    }
  }
  const payload = await request.json();
  if (payload.type === 'section') {
    const section = eventChecklistSectionSchema.parse({
      eventId: params.id,
      name: payload.name,
      order: payload.order
    });
    const created = await prisma.eventChecklistSection.create({ data: section });
    return NextResponse.json(created);
  }
  if (payload.type === 'item') {
    const item = eventChecklistItemSchema.parse({
      sectionId: payload.sectionId,
      itemCatalogId: payload.itemCatalogId ?? null,
      label: payload.label,
      expectedQuantity: payload.expectedQuantity,
      unit: payload.unit ?? null,
      order: payload.order,
      requiresExpiryCheck: payload.requiresExpiryCheck,
      requiresFunctionalCheck: payload.requiresFunctionalCheck
    });
    const created = await prisma.eventChecklistItem.create({ data: item });
    await prisma.verificationLine.create({
      data: { eventChecklistItemId: created.id, status: 'PENDING' }
    });
    return NextResponse.json(created);
  }
  return NextResponse.json({ message: 'Type non supporté.' }, { status: 400 });
}
