import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isValidOwnerListingsCronSecret,
  OWNER_LISTINGS_CRON_SECRET_HEADER,
  runOwnerListingsScheduledCycleTick,
} from '@/lib/owner-listings/background';

export const runtime = 'nodejs';

const backgroundSchema = z.object({
  agencyId: z.string().trim().min(1).optional(),
  hardPageLimit: z.number().int().min(1).max(1000).optional(),
  maxAgeDays: z.number().int().min(1).max(365).optional(),
  maxListingsPerSource: z.number().int().min(1).max(100).nullable().optional(),
  maxPagesPerTick: z.number().int().min(1).max(100).optional(),
  maxRuntimeMs: z.number().int().min(1000).max(15 * 60 * 1000).optional(),
});

function formatError(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Payload invalid pentru jobul de background.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Jobul de background a esuat.' };
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get(OWNER_LISTINGS_CRON_SECRET_HEADER);
    if (!isValidOwnerListingsCronSecret(secret)) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }

    const body = backgroundSchema.parse(await request.json().catch(() => ({})));
    const result = await runOwnerListingsScheduledCycleTick({
      agencyId: body.agencyId,
      hardPageLimit: body.hardPageLimit,
      maxAgeDays: body.maxAgeDays,
      maxListingsPerSource: body.maxListingsPerSource,
      maxPagesPerTick: body.maxPagesPerTick,
      maxRuntimeMs: body.maxRuntimeMs,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
