import { config as loadEnv } from 'dotenv';
import Module from 'node:module';
import path from 'node:path';

loadEnv({ path: '.env.local' });

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const mappedRequest = path.join(process.cwd(), 'src', request.slice(2));
    return originalResolveFilename.call(this, mappedRequest, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

async function main() {
  const { scrapeImoradar24ListingsPage, scrapeImoradar24Listings } = await import('../src/lib/owner-listings/sources/imoradar24');
  const { getOwnerListingScope } = await import('../src/lib/owner-listings/scope');
  const { docIdForListing } = await import('../src/lib/owner-listings/utils');

  const scope = getOwnerListingScope('bucuresti-ilfov');
  if (!scope) {
    throw new Error('Missing bucuresti-ilfov scope');
  }

  const pageOptions = {
    scopeKey: scope.key,
    scopeCity: scope.displayName,
    searchKeywords: scope.searchKeywords,
    searchUrls: scope.imoradar24SearchUrls,
    startPage: 1,
    maxPages: 1,
    maxListingsPerSource: null,
    hardPageLimit: 30,
    maxAgeDays: 60,
  };

  const pageResults = [];
  for (const page of [1, 2, 3, 4, 5]) {
    const result = await scrapeImoradar24ListingsPage(pageOptions, page);
    const countsByOrigin = result.listings.reduce<Record<string, number>>((acc, listing) => {
      const key = listing.originSourceLabel || '(missing)';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    pageResults.push({
      page,
      reachedEnd: result.reachedEnd,
      total: result.listings.length,
      countsByOrigin,
      sample: result.listings.slice(0, 5).map((listing) => ({
        title: listing.title,
        originSourceLabel: listing.originSourceLabel,
        link: listing.link,
      })),
    });
  }

  const fullResult = await scrapeImoradar24Listings({
    ...pageOptions,
    maxPages: 30,
    hardPageLimit: 30,
  });

  const fullCountsByOrigin = fullResult.reduce<Record<string, number>>((acc, listing) => {
    const key = listing.originSourceLabel || '(missing)';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const uniqueFingerprints = new Set(fullResult.map((listing) => listing.fingerprint));
  const uniqueDocIds = new Set(fullResult.map((listing) => docIdForListing(listing)));
  const duplicateDocIds = Array.from(
    fullResult.reduce<Map<string, number>>((acc, listing) => {
      const docId = docIdForListing(listing);
      acc.set(docId, (acc.get(docId) || 0) + 1);
      return acc;
    }, new Map())
  )
    .filter(([, count]) => count > 1)
    .map(([docId, count]) => ({ docId, count }));

  console.log(
    JSON.stringify(
      {
        pageResults,
        full: {
          total: fullResult.length,
          countsByOrigin: fullCountsByOrigin,
          uniqueFingerprints: uniqueFingerprints.size,
          uniqueDocIds: uniqueDocIds.size,
          duplicateDocIds,
        },
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
