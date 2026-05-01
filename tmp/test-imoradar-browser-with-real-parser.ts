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

async function loadListHtmlViaBrowser(url: string) {
  const { withScraperPage, waitForScraperReady } = await import('../src/lib/owner-listings/browser');

  return withScraperPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScraperReady(page, ['[id^="listing-link-"]', 'article', 'h3'], 10000);
    return page.content();
  });
}

async function main() {
  const { getOwnerListingScope } = await import('../src/lib/owner-listings/scope');

  const scope = getOwnerListingScope('bucuresti-ilfov');
  if (!scope) {
    throw new Error('Missing bucuresti-ilfov scope');
  }

  const base = scope.imoradar24SearchUrls[0];
  const page2Url = `${base}&page=2`;

  const [page1Html, page2Html] = await Promise.all([
    loadListHtmlViaBrowser(base),
    loadListHtmlViaBrowser(page2Url),
  ]);

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === base) {
      return new Response(page1Html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (url === page2Url) {
      return new Response(page2Html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    return originalFetch(input as never, init);
  };

  try {
    const { scrapeImoradar24ListingsPage } = await import('../src/lib/owner-listings/sources/imoradar24');

    const page1 = await scrapeImoradar24ListingsPage(
      {
        scopeKey: scope.key,
        scopeCity: scope.displayName,
        searchKeywords: scope.searchKeywords,
        searchUrls: [base],
        startPage: 1,
        maxPages: 1,
        maxListingsPerSource: null,
        hardPageLimit: 30,
        maxAgeDays: 60,
      },
      1
    );

    const page2 = await scrapeImoradar24ListingsPage(
      {
        scopeKey: scope.key,
        scopeCity: scope.displayName,
        searchKeywords: scope.searchKeywords,
        searchUrls: [base],
        startPage: 2,
        maxPages: 1,
        maxListingsPerSource: null,
        hardPageLimit: 30,
        maxAgeDays: 60,
      },
      2
    );

    const combined = [...page1.listings, ...page2.listings];
    const countsByOrigin = combined.reduce<Record<string, number>>((acc, listing) => {
      const key = listing.originSourceLabel || '(missing)';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    console.log(
      JSON.stringify(
        {
          summary: {
            page1: page1.listings.length,
            page2: page2.listings.length,
            total: combined.length,
            countsByOrigin,
          },
          page1Listings: page1.listings.map((listing) => ({
            title: listing.title,
            price: listing.price,
            location: listing.location,
            rooms: listing.rooms,
            area: listing.area,
            constructionYear: listing.constructionYear,
            originSourceLabel: listing.originSourceLabel,
            link: listing.link,
          })),
          page2Listings: page2.listings.map((listing) => ({
            title: listing.title,
            price: listing.price,
            location: listing.location,
            rooms: listing.rooms,
            area: listing.area,
            constructionYear: listing.constructionYear,
            originSourceLabel: listing.originSourceLabel,
            link: listing.link,
          })),
        },
        null,
        2
      )
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
