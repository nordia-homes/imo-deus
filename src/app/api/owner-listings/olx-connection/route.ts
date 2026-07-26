import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import {
  disconnectAgentOlxConnection,
  getAgentOlxConnectionPublicStatus,
  startAgentOlxConnection,
} from '@/lib/owner-listings/olx-agent-connection';
import { confirmAgentOlxConnection } from '@/lib/owner-listings/olx-cloud-phone';
import { upsertProspectingOlxPhoneQueueEntry } from '@/lib/owner-listings/olx-phone-queue';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';

export const runtime = 'nodejs';

const requestSchema = z.object({
  action: z.enum(['start', 'confirm', 'disconnect']),
});

function formatError(error: unknown) {
  if (error instanceof z.ZodError) {
    return { status: 400, message: error.issues[0]?.message || 'Payload invalid.' };
  }
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return {
      status: (error as { status: number }).status,
      message: error instanceof Error ? error.message : 'Cererea a esuat.',
    };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : 'Conectarea OLX a esuat.',
  };
}

function getOlxUrl(listing: OwnerListingSummary) {
  for (const candidate of [
    listing.source === 'olx' ? listing.link : '',
    listing.originSourceUrl || '',
    listing.sourceUrl || '',
  ]) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' && /(^|\.)olx\.ro$/i.test(parsed.hostname)) {
        return parsed.toString();
      }
    } catch {
      // Continue.
    }
  }
  return '';
}

async function resumeAgentProspectingJobs(input: {
  adminDb: Awaited<ReturnType<typeof requireAgencyUserFromBearerToken>>['adminDb'];
  agencyId: string;
  uid: string;
}) {
  const favoritesSnapshot = await input.adminDb
    .collection('agencies')
    .doc(input.agencyId)
    .collection('ownerListingFavorites')
    .get();
  const favorites = favoritesSnapshot.docs
    .filter((document) => {
      const data = document.data();
      return (
        data.isFavoriteActive !== false &&
        data.phoneExtractionRequestedBy === input.uid &&
        ['awaiting_connection', 'retrying', 'failed'].includes(data.phoneExtractionStatus)
      );
    })
    .slice(0, 100);
  if (!favorites.length) return 0;

  const listingSnapshots = await input.adminDb.getAll(
    ...favorites.map((favorite) =>
      input.adminDb.collection('ownerListings').doc(favorite.id)
    )
  );
  let queued = 0;
  for (const [index, listingSnapshot] of listingSnapshots.entries()) {
    if (!listingSnapshot.exists) continue;
    const listing = listingSnapshot.data() as OwnerListingSummary;
    const favorite = favorites[index].data();
    if (normalizeRomanianPhone(favorite.ownerPhone)) continue;
    const url = getOlxUrl(listing);
    if (!url) continue;
    await upsertProspectingOlxPhoneQueueEntry({
      adminDb: input.adminDb,
      agencyId: input.agencyId,
      requestedByUid: input.uid,
      requestedByName: favorite.phoneExtractionRequestedByName || '',
      listingId: favorites[index].id,
      link: url,
      title: listing.title,
      forceRetry: true,
    });
    await favorites[index].ref.set(
      {
        phoneExtractionStatus: 'queued',
        phoneExtractionMessage: 'Cont OLX conectat. Anuntul asteapta preluarea numarului.',
        phoneExtractionError: null,
        phoneExtractionNextAttemptAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    queued += 1;
  }
  return queued;
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(
      request.headers.get('authorization')
    );
    const status = await getAgentOlxConnectionPublicStatus(
      context.adminDb,
      context.agencyId,
      context.uid
    );
    return NextResponse.json(status);
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(
      request.headers.get('authorization')
    );
    const body = requestSchema.parse(await request.json().catch(() => ({})));

    if (body.action === 'start') {
      const result = await startAgentOlxConnection(
        context.adminDb,
        context.agencyId,
        context.uid
      );
      return NextResponse.json(result);
    }

    if (body.action === 'disconnect') {
      await disconnectAgentOlxConnection(context.adminDb, context.agencyId, context.uid);
      return NextResponse.json({ status: 'disconnected' });
    }

    const confirmation = await confirmAgentOlxConnection(
      context.adminDb,
      context.agencyId,
      context.uid
    );
    const resumedJobs = confirmation.connected
      ? await resumeAgentProspectingJobs({
          adminDb: context.adminDb,
          agencyId: context.agencyId,
          uid: context.uid,
        })
      : 0;
    return NextResponse.json({ ...confirmation, resumedJobs }, {
      status: confirmation.connected ? 200 : 409,
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
