import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { scrapeOwnerListingDetail } from '@/lib/owner-listings';
import { toPropertySeed } from '@/lib/owner-listings/utils';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';

export const runtime = 'nodejs';

const importSchema = z.object({
  source: z.enum(['olx', 'imoradar24', 'publi24']),
  url: z.string().url('URL-ul anuntului este invalid.'),
  listingId: z.string().min(1).optional(),
  ownerPhone: z.string().optional(),
  sourceDescription: z.string().optional(),
});

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'Importul anuntului a esuat.',
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Payload invalid pentru import.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Importul anuntului a esuat.' };
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = importSchema.parse(await request.json().catch(() => ({})));
    const detail = await scrapeOwnerListingDetail(body.source, body.url);
    let prospectingPhone = '';
    if (body.listingId) {
      const favoriteSnapshot = await context.adminDb
        .collection('agencies')
        .doc(context.agencyId)
        .collection('ownerListingFavorites')
        .doc(body.listingId)
        .get();
      if (favoriteSnapshot.exists && favoriteSnapshot.data()?.isFavoriteActive !== false) {
        prospectingPhone = normalizeRomanianPhone(favoriteSnapshot.data()?.ownerPhone);
      }
    }
    const fallbackDescription = body.sourceDescription?.trim() || '';
    const safeDetail = {
      ...detail,
      ownerPhone: prospectingPhone,
      contactPhone: prospectingPhone,
    };
    const seededProperty = toPropertySeed(safeDetail);
    const property = {
      ...seededProperty,
      description: seededProperty.description?.trim() || fallbackDescription || `[Anunt importat de la ${detail.sourceLabel}]`,
      ownerPhone: prospectingPhone,
    };

    return NextResponse.json({ detail: safeDetail, property }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
