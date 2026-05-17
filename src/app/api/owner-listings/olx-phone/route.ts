import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { scrapeOlxPhoneForAgent } from '@/lib/owner-listings/agent-olx-phone';

export const runtime = 'nodejs';

const requestSchema = z.object({
  url: z.string().url('URL-ul OLX este invalid.'),
});

function formatError(error: unknown) {
  if (error instanceof z.ZodError) {
    return { status: 400, message: error.issues[0]?.message || 'Payload invalid.' };
  }

  if (error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return { status: (error as { status: number }).status, message: error instanceof Error ? error.message : 'Cererea a esuat.' };
  }

  return { status: 500, message: error instanceof Error ? error.message : 'Nu am putut prelua telefonul OLX.' };
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = requestSchema.parse(await request.json().catch(() => ({})));
    const result = await scrapeOlxPhoneForAgent({
      adminDb: context.adminDb,
      agencyId: context.agencyId,
      uid: context.uid,
      url: body.url,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ phone: '', message: formatted.message }, { status: formatted.status });
  }
}
