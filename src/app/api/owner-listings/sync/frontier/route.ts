import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isValidOwnerListingsCronSecret,
  OWNER_LISTINGS_CRON_SECRET_HEADER,
} from '@/lib/owner-listings/background';
import { runOwnerListingsFrontierTick } from '@/lib/owner-listings/frontier';

export const runtime = 'nodejs';

const frontierSchema = z.object({
  scopeKey: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  maxRuntimeMs: z.number().int().min(1000).max(15 * 60 * 1000).optional(),
  maxPage: z.number().int().min(1).max(250).optional(),
});

function formatError(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Payload invalid pentru frontier scheduler.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Frontier scheduler a esuat.' };
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get(OWNER_LISTINGS_CRON_SECRET_HEADER);
    if (!isValidOwnerListingsCronSecret(secret)) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }

    const body = frontierSchema.parse(await request.json().catch(() => ({})));
    const result = await runOwnerListingsFrontierTick({
      scopeKey: body.scopeKey,
      limit: body.limit,
      maxRuntimeMs: body.maxRuntimeMs,
      maxPage: body.maxPage,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
