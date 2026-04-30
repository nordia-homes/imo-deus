import { NextRequest, NextResponse } from 'next/server';
import {
  isValidOwnerListingsCronSecret,
  OWNER_LISTINGS_CRON_SECRET_HEADER,
  runOwnerListingsOlxPhoneDrain,
} from '@/lib/owner-listings/background';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Jobul OLX phone drain a esuat.' };
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get(OWNER_LISTINGS_CRON_SECRET_HEADER);
    if (!isValidOwnerListingsCronSecret(secret)) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }

    const result = await runOwnerListingsOlxPhoneDrain();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
