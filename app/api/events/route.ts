import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';
import { Prisma } from '@prisma/client';

const allowed = (role?: string) => role === 'ADMIN' || role === 'CHEF';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const createChecklistFromTemplate = async (eventId: string, templateId: string) => {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { sections: { include: { items: true } } }
  });
  if (!template) return;

  for (const section of template.sections) {
    const newSection = await prisma.eventChecklistSection.create({
      data: {
        eventId,
        name: section.name,
        order: section.order
      }
    });

    for (const item of section.items) {
      const checklistItem = await prisma.eventChecklistItem.create({
        data: {
          sectionId: newSection.id,
          label: item.label,
          expectedQuantity: item.expectedQuantity,
          unit: item.unit,
          order: item.order,
          requiresExpiryCheck: item.requiresExpiryCheck,
          requiresFunctionalCheck: item.requiresFunctionalCheck,
          itemCatalogId: null
        }
      });

      await prisma.verificationLine.create({
        data: {
          eventChecklistItemId: checklistItem.id,
          status: 'PENDING'
        }
      });
    }
  }
};

export async function GET() {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const where: Prisma.EventWhereInput =
    session.user.role === 'CHEF' ? { createdByUserId: session.user.id } : {};
  const events = await prisma.event.findMany({ where, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = eventSchema.parse(await request.json());
    const baseSlug = slugify(payload.title);
    const publicSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
    const event = await prisma.event.create({
      data: {
        title: payload.title,
        description: payload.description,
        status: payload.status ?? 'DRAFT',
        createdByUserId: session.user.id,
        publicSlug
      }
    });

    if (payload.templateId) {
      await createChecklistFromTemplate(event.id, payload.templateId);
    }

    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ message: 'Erreur création événement.' }, { status: 400 });
  }
}
