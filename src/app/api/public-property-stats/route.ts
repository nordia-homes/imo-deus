import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/firebase/admin';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

const eventSchema = z.object({
  agencyId: z.string().trim().min(1).max(160),
  propertyId: z.string().trim().min(1).max(160),
  event: z.enum(['view', 'favorite', 'unfavorite']),
  visitorId: z.string().trim().min(8).max(200),
  sessionId: z.string().trim().min(8).max(200),
});

type StatsData = {
  views?: number;
  favorites?: number;
  favoriteAdds?: number;
};

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    return { status, message: error instanceof Error ? error.message : 'Datele nu au putut fi incarcate.' };
  }

  return {
    status: 500,
    message: error instanceof Error ? error.message : 'Datele nu au putut fi incarcate.',
  };
}

export async function GET(request: NextRequest) {
  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId')?.trim();
    if (!propertyId) {
      return NextResponse.json({ message: 'Lipseste proprietatea.' }, { status: 400 });
    }

    const { agencyId, adminDb: authenticatedDb } = await requireAgencyUserFromBearerToken(
      request.headers.get('authorization')
    );
    const propertyRef = authenticatedDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId);
    const statsRef = authenticatedDb.collection('agencies').doc(agencyId).collection('propertyPublicStats').doc(propertyId);
    const [propertySnapshot, statsSnapshot] = await Promise.all([propertyRef.get(), statsRef.get()]);

    if (!propertySnapshot.exists) {
      return NextResponse.json({ message: 'Proprietatea nu a fost gasita.' }, { status: 404 });
    }

    const stats = (statsSnapshot.data() || {}) as StatsData;
    return NextResponse.json({
      views: safeCount(stats.views),
      favorites: safeCount(stats.favorites),
      favoriteAdds: safeCount(stats.favoriteAdds),
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = eventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: 'Eveniment invalid.' }, { status: 400 });
    }

    const { agencyId, propertyId, event, visitorId, sessionId } = parsed.data;
    const agencyRef = adminDb.collection('agencies').doc(agencyId);
    const propertyRef = agencyRef.collection('properties').doc(propertyId);
    const statsRef = agencyRef.collection('propertyPublicStats').doc(propertyId);
    const propertySnapshot = await propertyRef.get();

    if (!propertySnapshot.exists || propertySnapshot.data()?.status !== 'Activ') {
      return NextResponse.json({ message: 'Proprietatea nu este disponibila public.' }, { status: 404 });
    }

    await adminDb.runTransaction(async (transaction) => {
      const statsSnapshot = await transaction.get(statsRef);
      const stats = (statsSnapshot.data() || {}) as StatsData;
      const now = new Date().toISOString();

      if (event === 'view') {
        const viewRef = statsRef.collection('viewSessions').doc(
          hashKey(`${propertyId}:${visitorId}:${sessionId}`)
        );
        const viewSnapshot = await transaction.get(viewRef);
        if (viewSnapshot.exists) return;

        transaction.create(viewRef, { createdAt: now });
        transaction.set(statsRef, {
          views: safeCount(stats.views) + 1,
          updatedAt: now,
        }, { merge: true });
        return;
      }

      const favoriteRef = statsRef.collection('visitors').doc(hashKey(`${propertyId}:${visitorId}`));
      const favoriteSnapshot = await transaction.get(favoriteRef);
      const wasFavorite = favoriteSnapshot.data()?.isFavorite === true;
      const shouldBeFavorite = event === 'favorite';
      if (wasFavorite === shouldBeFavorite) return;

      transaction.set(favoriteRef, {
        isFavorite: shouldBeFavorite,
        updatedAt: now,
      }, { merge: true });
      transaction.set(statsRef, {
        favorites: Math.max(0, safeCount(stats.favorites) + (shouldBeFavorite ? 1 : -1)),
        favoriteAdds: safeCount(stats.favoriteAdds) + (shouldBeFavorite ? 1 : 0),
        updatedAt: now,
      }, { merge: true });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
