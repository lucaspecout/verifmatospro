import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { templateSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'MATERIEL';

export async function GET() {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const templates = await prisma.template.findMany({
    include: { sections: { include: { items: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = templateSchema.parse(await request.json());
    const template = await prisma.template.create({ data: payload });
    return NextResponse.json(template);
  } catch {
    return NextResponse.json({ message: 'Erreur création template.' }, { status: 400 });
  }
}
