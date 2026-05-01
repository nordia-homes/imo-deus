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
  const { scrapeOlxListingsPage } = await import('../src/lib/owner-listings/sources/olx');
  const { getOwnerListingScope } = await import('../src/lib/owner-listings/scope');

  const scope = getOwnerListingScope('bucuresti-ilfov');
  if (!scope) throw new Error('Missing scope');

  const result = await scrapeOlxListingsPage(
    {
      scopeKey: scope.key,
      scopeCity: scope.displayName,
      searchKeywords: [],
      searchUrls: scope.olxSearchUrls,
      startPage: 1,
      maxPages: 1,
      maxListingsPerSource: 8,
      hardPageLimit: 5,
      maxAgeDays: 60,
    },
    1
  );

  console.log(
    JSON.stringify(
      result.listings.map((listing) => ({
        title: listing.title,
        location: listing.location,
        price: listing.price,
        link: listing.link,
      })),
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
