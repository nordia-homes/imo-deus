import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isValidOwnerListingsCronSecret,
  OWNER_LISTINGS_CRON_SECRET_HEADER,
  runOwnerListingsFreshRadarSync,
} from '@/lib/owner-listings/background';

export const runtime = 'nodejs';

const freshRadarSchema = z.object({
  scopeKey: z.string().trim().min(1).optional(),
  maxPages: z.number().int().min(1).max(5).optional(),
  maxListingsPerSource: z.number().int().min(1).max(100).optional(),
  hardPageLimit: z.number().int().min(1).max(5).optional(),
});

function formatError(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Payload invalid pentru fresh radar.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Fresh radar sync a esuat.' };
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get(OWNER_LISTINGS_CRON_SECRET_HEADER);
    if (!isValidOwnerListingsCronSecret(secret)) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }

    const body = freshRadarSchema.parse(await request.json().catch(() => ({})));
    const result = await runOwnerListingsFreshRadarSync({
      scopeKey: body.scopeKey,
      maxPages: body.maxPages,
      maxListingsPerSource: body.maxListingsPerSource,
      hardPageLimit: body.hardPageLimit,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
