import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publicLineSchema } from '@/lib/validation';
import { emitLineUpdate } from '@/lib/socket-client';

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const payload = publicLineSchema.parse(await request.json());
    if (payload.status === 'MISSING' && !payload.comment) {
      return NextResponse.json({ message: 'Commentaire obligatoire.' }, { status: 400 });
    }

    const line = await prisma.verificationLine.findUnique({
      where: { id: payload.lineId },
      include: { eventChecklistItem: { include: { section: { include: { event: true } } } } }
    });

    if (!line || line.eventChecklistItem.section.event.publicSlug !== params.slug) {
      return NextResponse.json({ message: 'Ligne introuvable.' }, { status: 404 });
    }

    const updated = await prisma.verificationLine.update({
      where: { id: payload.lineId },
      data: {
        status: payload.status,
        comment: payload.status === 'MISSING' ? payload.comment : null,
        checkedAt: new Date(),
        checkedByLabel: payload.checkedByLabel ?? null
      }
    });

    await emitLineUpdate(params.slug, request.headers.get('origin'));

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ message: 'Erreur de mise à jour.' }, { status: 400 });
  }
}
