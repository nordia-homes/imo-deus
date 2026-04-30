import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { scrapeOlxListingDetail, scrapeOlxListings } from '@/lib/owner-listings/sources/olx';
import { scrapeImoradar24ListingDetail, scrapeImoradar24Listings } from '@/lib/owner-listings/sources/imoradar24';
import { scrapePubli24ListingDetail, scrapePubli24Listings } from '@/lib/owner-listings/sources/publi24';
import { upsertOlxPhoneQueueEntry } from '@/lib/owner-listings/olx-phone-queue';
import { resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import type {
  OwnerListingDetail,
  OwnerListingSource,
  OwnerListingSummary,
  OwnerListingSyncResult,
  SourceScrapeOptions,
} from '@/lib/owner-listings/types';
import { docIdForListing, stripUndefined } from '@/lib/owner-listings/utils';

const DEFAULT_OPTIONS: SourceScrapeOptions = {
  maxPages: null,
  maxListingsPerSource: null,
  hardPageLimit: 250,
  scopeKey: '',
  scopeCity: '',
  searchKeywords: [],
  searchUrls: [],
};

type SourceHandler = {
  scrapeList: (options: SourceScrapeOptions) => Promise<OwnerListingSummary[]>;
  scrapeDetail: (url: string) => Promise<OwnerListingDetail>;
};

const SOURCES: Record<OwnerListingSource, SourceHandler> = {
  olx: {
    scrapeList: scrapeOlxListings,
    scrapeDetail: scrapeOlxListingDetail,
  },
  imoradar24: {
    scrapeList: scrapeImoradar24Listings,
    scrapeDetail: scrapeImoradar24ListingDetail,
  },
  publi24: {
    scrapeList: scrapePubli24Listings,
    scrapeDetail: scrapePubli24ListingDetail,
  },
};

function preferIncomingValue<T>(incoming: T | null | undefined, existing: T | null | undefined): T | undefined {
  if (incoming === undefined || incoming === null) {
    return existing ?? undefined;
  }

  if (typeof incoming === 'string' && !incoming.trim()) {
    return existing ?? undefined;
  }

  return incoming;
}

function mergeListingWithExisting(
  listing: OwnerListingSummary,
  existing?: Partial<OwnerListingSummary> | undefined
): OwnerListingSummary {
  if (!existing) {
    return listing;
  }

  return {
    ...existing,
    ...listing,
    scopeKey: preferIncomingValue(listing.scopeKey, existing.scopeKey),
    scopeCity: preferIncomingValue(listing.scopeCity, existing.scopeCity),
    title: preferIncomingValue(listing.title, existing.title) || '',
    price: preferIncomingValue(listing.price, existing.price) || '',
    link: preferIncomingValue(listing.link, existing.link) || '',
    area: preferIncomingValue(listing.area, existing.area) || '',
    location: preferIncomingValue(listing.location, existing.location) || '',
    postedAtText: preferIncomingValue(listing.postedAtText, existing.postedAtText),
    rooms: preferIncomingValue(listing.rooms, existing.rooms),
    constructionYear: preferIncomingValue(listing.constructionYear, existing.constructionYear),
    year: preferIncomingValue(listing.year, existing.year),
    image: preferIncomingValue(listing.image, existing.image),
    imageUrl: preferIncomingValue(listing.imageUrl, existing.imageUrl),
    description: preferIncomingValue(listing.description, existing.description),
    ownerName: preferIncomingValue(listing.ownerName, existing.ownerName),
    ownerPhone: preferIncomingValue(listing.ownerPhone, existing.ownerPhone),
    ownerConfidence: preferIncomingValue(listing.ownerConfidence, existing.ownerConfidence),
    scrapedAt: Math.max(listing.scrapedAt || 0, existing.scrapedAt || 0),
    lastSeenAt: Math.max(listing.lastSeenAt || 0, existing.lastSeenAt || 0),
  } satisfies OwnerListingSummary;
}

export async function scrapeOwnerListingDetail(source: OwnerListingSource, url: string) {
  return SOURCES[source].scrapeDetail(url);
}

export async function syncOwnerListings(
  agencyId: string,
  requestedSources: OwnerListingSource[] = ['olx', 'imoradar24', 'publi24'],
  options: Partial<SourceScrapeOptions> = {}
): Promise<OwnerListingSyncResult> {
  const agencySnapshot = await adminDb.collection('agencies').doc(agencyId).get();
  const agency = agencySnapshot.data() as import('@/lib/types').Agency | undefined;
  const scope = resolveAgencyOwnerListingScope(agency);

  if (!scope) {
    throw new Error('Momentan owner listings este configurat doar pentru agentii cu orasul Bucuresti-Ilfov.');
  }

  const unique = new Map<string, OwnerListingSummary>();
  const result: OwnerListingSyncResult = {
    scanned: 0,
    accepted: 0,
    stored: 0,
    skipped: 0,
    errors: [],
  };

  for (const source of requestedSources) {
    try {
      const resolvedOptions: SourceScrapeOptions = {
        ...DEFAULT_OPTIONS,
        ...options,
        scopeKey: scope.key,
        scopeCity: scope.displayName,
        searchKeywords: scope.searchKeywords,
        searchUrls:
          source === 'olx'
            ? scope.olxSearchUrls
            : source === 'publi24'
              ? scope.publi24SearchUrls
              : scope.imoradar24SearchUrls,
      };

      const listings = await SOURCES[source].scrapeList(resolvedOptions);
      result.scanned += listings.length;

      for (const listing of listings) {
        if (unique.has(listing.fingerprint)) {
          result.skipped += 1;
          continue;
        }

        unique.set(listing.fingerprint, listing);
        result.accepted += 1;
      }
    } catch (error) {
      result.errors.push({
        source,
        message: error instanceof Error ? error.message : `Scraping-ul pentru ${source} a esuat.`,
      });
    }
  }

  const listingsToStore = await Promise.all(
    Array.from(unique.values()).map(async (listing) => {
      const docRef = adminDb.collection('ownerListings').doc(docIdForListing(listing));
      const existingSnapshot = await docRef.get();
      const existing = existingSnapshot.exists ? (existingSnapshot.data() as Partial<OwnerListingSummary>) : undefined;
      return {
        docRef,
        listing: mergeListingWithExisting(listing, existing),
      };
    })
  );

  const batch = adminDb.batch();
  for (const entry of listingsToStore) {
    const { docRef, listing } = entry;
    batch.set(
      docRef,
      stripUndefined({
        ...listing,
        updatedAt: new Date().toISOString(),
        syncSource: 'scraper',
        dedupeKey: listing.fingerprint,
        searchText: [listing.title, listing.location, listing.price, listing.sourceLabel].join(' '),
        syncMetadata: {
          lastSeenAt: listing.lastSeenAt,
          scrapedAt: listing.scrapedAt,
        },
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      }),
      { merge: true }
    );
    result.stored += 1;
  }

  if (result.stored > 0) {
    await batch.commit();
    await Promise.all(
      listingsToStore.map((entry) => upsertOlxPhoneQueueEntry(entry.docRef.id, entry.listing))
    );
  }

  return result;
}
