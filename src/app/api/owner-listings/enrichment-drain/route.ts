import { NextRequest, NextResponse } from 'next/server';
import {
  isValidOwnerListingsCronSecret,
  OWNER_LISTINGS_CRON_SECRET_HEADER,
} from '@/lib/owner-listings/background';
import { drainOwnerListingEnrichmentQueue } from '@/lib/owner-listings/enrichment-queue';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Enrichment drain a esuat.' };
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get(OWNER_LISTINGS_CRON_SECRET_HEADER);
    if (!isValidOwnerListingsCronSecret(secret)) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const result = await drainOwnerListingEnrichmentQueue({
      limit: typeof body.limit === 'number' ? body.limit : undefined,
      concurrency: typeof body.concurrency === 'number' ? body.concurrency : undefined,
      maxRuntimeMs: typeof body.maxRuntimeMs === 'number' ? body.maxRuntimeMs : undefined,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
