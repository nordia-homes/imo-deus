import type { Firestore } from 'firebase-admin/firestore';
import { scrapeOlxPhoneForAgent } from '@/lib/owner-listings/agent-olx-phone';
import { scrapeOlxPhoneNumber } from '@/lib/owner-listings/sources/olx';
import { upsertRawOlxPhoneQueueEntry } from '@/lib/owner-listings/olx-phone-queue';

type OlxPhoneResolverInput = {
  adminDb: Firestore;
  agencyId: string;
  uid: string;
  url: string;
  listingId?: string | null;
  title?: string | null;
};

export type OlxPhoneResolutionSource = 'cache' | 'agent-browser' | 'internal-scraper' | 'queued';

type OlxPhoneResolutionResult = {
  phone: string;
  message: string;
  source: OlxPhoneResolutionSource;
  debug?: unknown;
};

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
  if (input.listingId) {
    const listingSnapshot = await input.adminDb.collection('ownerListings').doc(input.listingId).get();
    const phone = normalizePhoneCandidate(listingSnapshot.data()?.ownerPhone);
    if (phone) return phone;
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

  await input.adminDb.collection('ownerListings').doc(input.listingId).set(
    {
      ownerPhone: phone,
      enrichmentStatus: 'partial',
      phoneResolvedAt: new Date().toISOString(),
      phoneResolvedBy: source,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function queueRetry(input: OlxPhoneResolverInput, message: string) {
  if (!input.listingId) {
    return;
  }

  await upsertRawOlxPhoneQueueEntry({
    listingId: input.listingId,
    link: input.url,
    title: input.title || '',
    error: message,
  });
}

export async function resolveOlxPhoneInternally(input: OlxPhoneResolverInput): Promise<OlxPhoneResolutionResult> {
  const storedPhone = await getStoredOwnerPhone(input);
  if (storedPhone) {
    return { phone: storedPhone, message: 'Telefon preluat din cache-ul ownerListings.', source: 'cache' };
  }

  const agentResult = await scrapeOlxPhoneForAgent(input).catch((error) => ({
    phone: '',
    message: error instanceof Error ? error.message : 'Browserul intern OLX a esuat.',
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

  const scraperPhone = normalizePhoneCandidate(await scrapeOlxPhoneNumber(input.url).catch(() => ''));
  if (scraperPhone) {
    await persistResolvedPhone(input, scraperPhone, 'internal-scraper');
    return {
      phone: scraperPhone,
      message: 'Telefon preluat prin scraperul intern OLX.',
      source: 'internal-scraper',
    };
  }

  const message =
    agentResult.message ||
    'Telefonul OLX nu a fost disponibil imediat. Anuntul a fost trimis in coada interna de retry.';
  await queueRetry(input, message);

  return {
    phone: '',
    message,
    source: 'queued',
    debug: agentResult.debug,
  };
}
