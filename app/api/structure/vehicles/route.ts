import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { vehicleSchema } from '@/lib/validation';
import { getSession } from '@/lib/auth';

const allowed = (role?: string) => role === 'ADMIN' || role === 'MATERIEL';

export async function GET() {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  const vehicles = await prisma.vehicle.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(vehicles);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allowed(session.user.role)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }
  try {
    const payload = vehicleSchema.parse(await request.json());
    const vehicle = await prisma.vehicle.create({ data: payload });
    return NextResponse.json(vehicle);
  } catch {
    return NextResponse.json({ message: 'Erreur création véhicule.' }, { status: 400 });
  }
}
