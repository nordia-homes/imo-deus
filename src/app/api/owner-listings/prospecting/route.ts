import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import {
  cancelProspectingOlxPhoneQueueEntry,
  upsertProspectingOlxPhoneQueueEntry,
} from '@/lib/owner-listings/olx-phone-queue';
import {
  cancelProspectingPubli24PhoneQueueEntry,
  upsertPubli24ProspectingPhoneQueueEntry,
} from '@/lib/owner-listings/enrichment-queue';
import { getAgentOlxConnection } from '@/lib/owner-listings/olx-agent-connection';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';

export const runtime = 'nodejs';

const requestSchema = z.object({
  listingId: z.string().min(1).max(200),
  action: z.enum(['add', 'remove', 'retry']),
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
    message: error instanceof Error ? error.message : 'Nu am putut actualiza Prospectarea.',
  };
}

function getOlxUrl(listing: OwnerListingSummary) {
  const candidates = [
    listing.source === 'olx' ? listing.link : '',
    listing.originSourceUrl || '',
    listing.sourceUrl || '',
  ];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' && /(^|\.)olx\.ro$/i.test(parsed.hostname)) {
        return parsed.toString();
      }
    } catch {
      // Continue with the next source URL.
    }
  }
  return '';
}

function getPubli24Url(listing: OwnerListingSummary) {
  const candidates = [
    listing.source === 'publi24' ? listing.link : '',
    listing.originSourceUrl || '',
    listing.sourceUrl || '',
  ];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' && /(^|\.)publi24\.ro$/i.test(parsed.hostname)) {
        return parsed.toString();
      }
    } catch {
      // Continue with the next source URL.
    }
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(
      request.headers.get('authorization')
    );
    const body = requestSchema.parse(await request.json().catch(() => ({})));
    const listingRef = context.adminDb.collection('ownerListings').doc(body.listingId);
    const favoriteRef = context.adminDb
      .collection('agencies')
      .doc(context.agencyId)
      .collection('ownerListingFavorites')
      .doc(body.listingId);
    const [listingSnapshot, favoriteSnapshot, userSnapshot] = await Promise.all([
      listingRef.get(),
      favoriteRef.get(),
      context.adminDb.collection('users').doc(context.uid).get(),
    ]);

    if (!listingSnapshot.exists) {
      return NextResponse.json({ message: 'Anuntul nu mai exista.' }, { status: 404 });
    }

    const listing = listingSnapshot.data() as OwnerListingSummary;
    const existing = favoriteSnapshot.data() || {};
    const userData = userSnapshot.data() as { name?: string; email?: string } | undefined;
    const agentName = userData?.name || userData?.email || 'Agent';
    const timestamp = new Date().toISOString();
    const olxUrl = getOlxUrl(listing);
    const publi24Url = getPubli24Url(listing);

    if (body.action === 'remove') {
      await favoriteRef.set(
        {
          isFavoriteActive: false,
          wasRemovedFromFavorites: true,
          removedAt: timestamp,
          removedBy: context.uid,
          removedByName: agentName,
          phoneExtractionStatus: existing.phoneExtractionStatus || null,
          updatedAt: timestamp,
          updatedBy: context.uid,
        },
        { merge: true }
      );
      if (olxUrl) {
        await cancelProspectingOlxPhoneQueueEntry({
          adminDb: context.adminDb,
          agencyId: context.agencyId,
          listingId: body.listingId,
        });
      }
      if (publi24Url) {
        await cancelProspectingPubli24PhoneQueueEntry({
          adminDb: context.adminDb,
          agencyId: context.agencyId,
          listingId: body.listingId,
        });
      }
      return NextResponse.json({
        active: false,
        phoneExtractionStatus: existing.phoneExtractionStatus || null,
      });
    }

    if (body.action === 'retry' && existing.isFavoriteActive === false) {
      return NextResponse.json(
        { message: 'Adauga mai intai anuntul in Prospectare.' },
        { status: 409 }
      );
    }

    const connection = olxUrl
      ? await getAgentOlxConnection(context.adminDb, context.agencyId, context.uid)
      : null;
    const existingPhone = normalizeRomanianPhone(existing.ownerPhone);
    const hasPhone = Boolean(existingPhone);
    const phoneExtractionStatus = hasPhone
      ? 'available'
      : olxUrl
        ? connection?.status === 'connected'
          ? 'queued'
          : 'awaiting_connection'
        : publi24Url
          ? 'queued'
          : 'not_required';
    const phoneExtractionMessage = hasPhone
      ? 'Numarul proprietarului este disponibil.'
      : olxUrl
        ? connection?.status === 'connected'
          ? 'Anuntul a fost adaugat in coada de preluare OLX.'
          : 'Conecteaza contul OLX pentru preluarea automata a numarului.'
        : publi24Url
          ? 'Anuntul a fost adaugat in coada de preluare Publi24.'
          : 'Pentru aceasta sursa se folosesc datele publice disponibile.';

    await favoriteRef.set(
      {
        ownerListingId: body.listingId,
        isFavoriteActive: true,
        wasRemovedFromFavorites: existing.wasRemovedFromFavorites ?? false,
        removedAt: null,
        removedBy: null,
        removedByName: null,
        reservedByAgentId: existing.reservedByAgentId ?? context.uid,
        reservedByAgentName: existing.reservedByAgentName ?? agentName,
        reservedAt: existing.reservedAt ?? timestamp,
        calledByAgentId: existing.calledByAgentId ?? null,
        calledByAgentName: existing.calledByAgentName ?? null,
        calledAt: existing.calledAt ?? null,
        takenByAgentId: existing.takenByAgentId ?? null,
        takenByAgentName: existing.takenByAgentName ?? null,
        takenAt: existing.takenAt ?? null,
        contactOutcome: existing.contactOutcome ?? null,
        contactOutcomeAt: existing.contactOutcomeAt ?? null,
        contactOutcomeByAgentId: existing.contactOutcomeByAgentId ?? null,
        contactOutcomeByAgentName: existing.contactOutcomeByAgentName ?? null,
        collaborationStatus: existing.collaborationStatus ?? null,
        commissionValue: existing.commissionValue ?? '',
        propertyAddress: existing.propertyAddress ?? '',
        notes: existing.notes ?? '',
        phoneExtractionStatus,
        phoneExtractionMessage,
        ownerPhone: hasPhone ? existingPhone : FieldValue.delete(),
        phoneExtractionRequestedAt: timestamp,
        phoneExtractionRequestedBy: context.uid,
        phoneExtractionRequestedByName: agentName,
        phoneExtractionError: null,
        phoneExtractionCompletedAt: hasPhone
          ? existing.phoneExtractionCompletedAt || timestamp
          : null,
        createdAt: existing.createdAt || timestamp,
        createdBy: existing.createdBy || context.uid,
        updatedAt: timestamp,
        updatedBy: context.uid,
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (olxUrl && !hasPhone) {
      await upsertProspectingOlxPhoneQueueEntry({
        adminDb: context.adminDb,
        agencyId: context.agencyId,
        requestedByUid: context.uid,
        requestedByName: agentName,
        listingId: body.listingId,
        link: olxUrl,
        title: listing.title,
        forceRetry: body.action === 'retry',
      });
    }
    if (publi24Url && !hasPhone) {
      await upsertPubli24ProspectingPhoneQueueEntry({
        adminDb: context.adminDb,
        agencyId: context.agencyId,
        requestedByUid: context.uid,
        requestedByName: agentName,
        listingId: body.listingId,
        link: publi24Url,
        title: listing.title,
        forceRetry: body.action === 'retry',
      });
    }

    return NextResponse.json({
      active: true,
      phoneExtractionStatus,
      phoneExtractionMessage,
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
