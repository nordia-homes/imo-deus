import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { runOwnerListingsBackgroundSync } from '@/lib/owner-listings/background';
import type { OwnerListingSource } from '@/lib/owner-listings/types';

export const runtime = 'nodejs';

const syncSchema = z.object({
  sources: z.array(z.enum(['olx', 'imoradar24', 'publi24'])).optional(),
  scopeKey: z.string().trim().min(1).optional(),
  maxPages: z.number().int().min(1).max(1000).nullable().optional(),
  maxListingsPerSource: z.number().int().min(1).max(100).optional(),
  hardPageLimit: z.number().int().min(1).max(1000).optional(),
});

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'Sincronizarea anunturilor a esuat.',
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Payload invalid pentru sincronizare.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Sincronizarea anunturilor a esuat.' };
}

export async function POST(request: NextRequest) {
  try {
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = syncSchema.parse(await request.json().catch(() => ({})));
    const sources = (body.sources || ['olx', 'imoradar24', 'publi24']) as OwnerListingSource[];
    const result = await runOwnerListingsBackgroundSync({
      scopeKey: body.scopeKey,
      sources,
      maxPages: body.maxPages ?? undefined,
      maxListingsPerSource: body.maxListingsPerSource,
      hardPageLimit: body.hardPageLimit,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
