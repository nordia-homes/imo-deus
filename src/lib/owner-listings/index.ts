import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { scrapeOlxListingDetail, scrapeOlxListings } from '@/lib/owner-listings/sources/olx';
import { scrapeImoradar24ListingDetail, scrapeImoradar24Listings } from '@/lib/owner-listings/sources/imoradar24';
import { scrapePubli24ListingDetail, scrapePubli24Listings } from '@/lib/owner-listings/sources/publi24';
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

  const batch = adminDb.batch();
  for (const listing of unique.values()) {
    const docRef = adminDb.collection('ownerListings').doc(docIdForListing(listing));
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
  }

  return result;
}
