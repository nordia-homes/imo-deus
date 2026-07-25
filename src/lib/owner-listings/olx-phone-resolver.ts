import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { scrapeOlxPhoneForAgent } from '@/lib/owner-listings/agent-olx-phone';
import { scrapeOlxPhoneNumber } from '@/lib/owner-listings/sources/olx';
import { upsertProspectingOlxPhoneQueueEntry } from '@/lib/owner-listings/olx-phone-queue';
import { resolveOlxPhoneViaAgentCloud } from '@/lib/owner-listings/olx-cloud-phone';
import {
  describeRemoteOlxPhoneStage,
  hasRemoteOlxPhoneBrowser,
  resolveOlxPhoneViaRemoteWorker,
} from '@/lib/owner-listings/remote-olx-phone';

type OlxPhoneResolverInput = {
  adminDb: Firestore;
  agencyId: string;
  uid: string;
  url: string;
  listingId?: string | null;
  title?: string | null;
};

export type OlxPhoneResolutionSource =
  | 'cache'
  | 'agent-browser'
  | 'agent-cloud-browser'
  | 'remote-browser'
  | 'internal-scraper'
  | 'queued';

type OlxPhoneResolutionResult = {
  phone: string;
  message: string;
  source: OlxPhoneResolutionSource;
  debug?: unknown;
};

const activeOlxPhoneResolutions = new Map<string, Promise<OlxPhoneResolutionResult>>();

export function sanitizeOlxPhoneMessage(message: unknown) {
  const normalized = String(message || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Telefonul OLX nu a fost disponibil imediat. Anuntul a fost trimis automat la retry.';
  }

  if (
    /browserType|target (?:page|context|browser)|--(?:disable|no-sandbox)|\/workspace|\\workspace|node_modules|playwright|pid=\d+/i.test(
      normalized
    )
  ) {
    return 'Serviciul OLX s-a reincarcat dupa o intrerupere temporara. Anuntul a fost trimis automat la retry.';
  }

  return normalized.slice(0, 360);
}

function normalizePhoneCandidate(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('4') && digits.length === 11 && digits.slice(1).startsWith('07')) {
    return digits.slice(1);
  }
  if (digits.startsWith('004') && digits.length === 13 && digits.slice(3).startsWith('07')) {
    return digits.slice(3);
  }
  if (digits.startsWith('07') && digits.length === 10) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return digits;
  }
  return '';
}

async function getStoredOwnerPhone(input: OlxPhoneResolverInput) {
  let listingData: DocumentData | undefined;
  if (input.listingId) {
    const listingSnapshot = await input.adminDb.collection('ownerListings').doc(input.listingId).get();
    listingData = listingSnapshot.data();
    const phone = normalizePhoneCandidate(listingData?.ownerPhone);
    if (phone) return phone;

    const canonicalListingId = String(listingData?.canonicalListingId || '').trim();
    if (canonicalListingId && canonicalListingId !== input.listingId) {
      const canonicalSnapshot = await input.adminDb
        .collection('ownerListings')
        .doc(canonicalListingId)
        .get();
      const canonicalPhone = normalizePhoneCandidate(canonicalSnapshot.data()?.ownerPhone);
      if (canonicalPhone) {
        await persistResolvedPhone(input, canonicalPhone, 'cache');
        return canonicalPhone;
      }
    }

    const identityFields = ['dedupeGroupId', 'canonicalIdentity', 'canonicalKey'] as const;
    for (const field of identityFields) {
      const value = String(listingData?.[field] || '').trim();
      if (!value) continue;
      const siblingSnapshot = await input.adminDb
        .collection('ownerListings')
        .where(field, '==', value)
        .limit(12)
        .get();
      const siblingPhone = siblingSnapshot.docs
        .filter((document) => document.id !== input.listingId)
        .map((document) => normalizePhoneCandidate(document.data()?.ownerPhone))
        .find(Boolean);
      if (siblingPhone) {
        await persistResolvedPhone(input, siblingPhone, 'cache');
        return siblingPhone;
      }
    }
  }

  const byUrlSnapshot = await input.adminDb
    .collection('ownerListings')
    .where('link', '==', input.url)
    .limit(1)
    .get();
  return normalizePhoneCandidate(byUrlSnapshot.docs[0]?.data()?.ownerPhone);
}

async function persistResolvedPhone(input: OlxPhoneResolverInput, phone: string, source: OlxPhoneResolutionSource) {
  if (!input.listingId || !phone) return;

  const timestamp = new Date().toISOString();
  await Promise.all([
    input.adminDb.collection('ownerListings').doc(input.listingId).set(
      {
        ownerPhone: phone,
        enrichmentStatus: 'partial',
        phoneResolvedAt: timestamp,
        phoneResolvedBy: source,
        updatedAt: timestamp,
      },
      { merge: true }
    ),
    input.adminDb
      .collection('agencies')
      .doc(input.agencyId)
      .collection('ownerListingFavorites')
      .doc(input.listingId)
      .set(
        {
          ownerPhone: phone,
          phoneExtractionStatus: 'available',
          phoneExtractionMessage: 'Numarul proprietarului a fost preluat.',
          phoneExtractionCompletedAt: timestamp,
          phoneExtractionError: null,
          updatedAt: timestamp,
        },
        { merge: true }
      ),
  ]);
}

async function queueRetry(input: OlxPhoneResolverInput, message: string) {
  if (!input.listingId) {
    return;
  }

  await upsertProspectingOlxPhoneQueueEntry({
    adminDb: input.adminDb,
    agencyId: input.agencyId,
    requestedByUid: input.uid,
    listingId: input.listingId,
    link: input.url,
    title: input.title || '',
    error: sanitizeOlxPhoneMessage(message),
    forceRetry: true,
  });
}

async function resolveOlxPhoneOnce(input: OlxPhoneResolverInput): Promise<OlxPhoneResolutionResult> {
  const storedPhone = await getStoredOwnerPhone(input);
  if (storedPhone) {
    return { phone: storedPhone, message: 'Telefon preluat din cache-ul ownerListings.', source: 'cache' };
  }

  const directPhone = normalizePhoneCandidate(
    await scrapeOlxPhoneNumber(input.url, { allowLocalBrowser: false }).catch(() => '')
  );
  if (directPhone) {
    await persistResolvedPhone(input, directPhone, 'internal-scraper');
    return {
      phone: directPhone,
      message: 'Telefon preluat direct din OLX.',
      source: 'internal-scraper',
    };
  }

  const cloudResult = await resolveOlxPhoneViaAgentCloud({
    adminDb: input.adminDb,
    agencyId: input.agencyId,
    uid: input.uid,
    url: input.url,
  });
  if (cloudResult.phone) {
    await persistResolvedPhone(input, cloudResult.phone, 'agent-cloud-browser');
    return {
      phone: cloudResult.phone,
      message: cloudResult.message,
      source: 'agent-cloud-browser',
      debug: { stage: cloudResult.stage },
    };
  }

  const remoteResult = await resolveOlxPhoneViaRemoteWorker(input.url);
  if (remoteResult.phone) {
    await persistResolvedPhone(input, remoteResult.phone, 'remote-browser');
    return {
      phone: remoteResult.phone,
      message: 'Telefon preluat prin browserul OLX securizat.',
      source: 'remote-browser',
      debug: { stage: remoteResult.stage },
    };
  }

  if (hasRemoteOlxPhoneBrowser() && process.env.K_SERVICE) {
    const message =
      cloudResult.stage === 'not_connected' || cloudResult.stage === 'login_required'
        ? cloudResult.message
        : describeRemoteOlxPhoneStage(remoteResult.stage);
    await queueRetry(input, message);
    return {
      phone: '',
      message,
      source: 'queued',
      debug: { stage: remoteResult.stage },
    };
  }

  const agentResult = await scrapeOlxPhoneForAgent(input).catch((error) => ({
    phone: '',
    message: sanitizeOlxPhoneMessage(error instanceof Error ? error.message : ''),
    debug: { stage: 'agent_browser_exception' },
  }));
  const agentPhone = normalizePhoneCandidate(agentResult.phone);
  if (agentPhone) {
    await persistResolvedPhone(input, agentPhone, 'agent-browser');
    return {
      phone: agentPhone,
      message: agentResult.message || 'Telefon preluat prin browserul intern OLX.',
      source: 'agent-browser',
      debug: agentResult.debug,
    };
  }

  const message = sanitizeOlxPhoneMessage(agentResult.message);
  await queueRetry(input, message);

  return {
    phone: '',
    message,
    source: 'queued',
    debug: agentResult.debug,
  };
}

export async function resolveOlxPhoneInternally(input: OlxPhoneResolverInput): Promise<OlxPhoneResolutionResult> {
  const key = `${input.agencyId}:${input.uid}:${input.listingId || input.url}`;
  const activeResolution = activeOlxPhoneResolutions.get(key);
  if (activeResolution) {
    return activeResolution;
  }

  const resolution = resolveOlxPhoneOnce(input);
  activeOlxPhoneResolutions.set(key, resolution);
  try {
    return await resolution;
  } finally {
    if (activeOlxPhoneResolutions.get(key) === resolution) {
      activeOlxPhoneResolutions.delete(key);
    }
  }
}
