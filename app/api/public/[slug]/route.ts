import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const event = await prisma.event.findUnique({
    where: { publicSlug: params.slug },
    include: {
      checklistSections: {
        include: {
          items: {
            include: { verificationLine: true },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!event) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const sections = event.checklistSections.map((section) => ({
    name: section.name,
    items: section.items.map((item) => ({
      id: item.verificationLine?.id ?? item.id,
      label: item.label,
      expectedQuantity: item.expectedQuantity,
      unit: item.unit,
      status: item.verificationLine?.status ?? 'PENDING',
      comment: item.verificationLine?.comment ?? null,
      sectionName: section.name
    }))
  }));

  return NextResponse.json({ eventTitle: event.title, sections });
}
