import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BodyLimitError } from '@/lib/romimo/transport';
export function assistantError(error: unknown) {
  const status = error instanceof BodyLimitError ? 413 : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500;
  return NextResponse.json({ error: status >= 500 ? 'Serviciul nu a putut confirma rezultatul. Reîncarcă istoricul înainte de a repeta acțiunea.' : error instanceof z.ZodError ? 'Cerere invalidă.' : error instanceof Error ? error.message : 'Cerere refuzată.' }, { status: Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500, headers: { 'Cache-Control': 'no-store' } });
}
