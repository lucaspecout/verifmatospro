import { NextResponse } from 'next/server';
import { z } from 'zod';

export const handleZodError = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ message: 'Validation error', issues: error.issues }, { status: 400 });
  }
  return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 });
};
