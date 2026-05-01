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

type ListingPreview = {
  page: number;
  listingId: string;
  title: string;
  href: string;
  visibleSourceLabel: string;
  visibleLocation: string;
  visiblePrice: string;
  isExternal: boolean;
};

async function extractPageListings(url: string, pageNumber: number) {
  const { withScraperPage, waitForScraperReady } = await import('../src/lib/owner-listings/browser');

  return withScraperPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScraperReady(page, ['[id^="listing-link-"]', 'article', 'h3'], 10000);
    const html = await page.content();
    const clean = (value: string | null | undefined) => (value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const markers = Array.from(html.matchAll(/id="listing-link-(\d+)"/gi));

    return markers
      .map((marker, index) => {
        const listingId = clean(marker[1] || '');
        const markerIndex = marker.index ?? 0;
        const nextIndex = index + 1 < markers.length ? (markers[index + 1].index ?? html.length) : html.length;
        const start = Math.max(0, html.lastIndexOf('<div', markerIndex));
        const chunk = html.slice(start, nextIndex);
        const href =
          clean(chunk.match(/id="listing-link-\d+"[^>]*href="([^"]+)"/i)?.[1] || '') ||
          clean(chunk.match(/href="([^"]*(?:\/oferta\/[^"]+|\/link-extern\/\d+))"/i)?.[1] || '');
        const title =
          clean(chunk.match(/data-name="([^"]+)"/i)?.[1] || '') ||
          clean(chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '') ||
          clean(chunk.match(/<span class="relative top-\[2px\][^"]*>\s*([\s\S]*?)\s*<\/span>/i)?.[1] || '');
        const plainText = clean(chunk);
        const sourceMatches = plainText.match(/(?:Imobiliare\.ro|OLX|Publi24|Storia|Anuntul\.ro|LaJumate\.ro|Autovit|Imovirtual|imoradar24\.ro)/gi) || [];
        const visibleSourceLabel = clean(sourceMatches[sourceMatches.length - 1] || '');
        const visiblePrice = clean(plainText.match(/\b\d[\d.\s]*\s*€\b/u)?.[0] || '');
        const visibleLocation =
          clean(plainText.match(/\b(?:București|Bucuresti|Ilfov|Voluntari|Chiajna|Bragadiru|Otopeni|Tunari|Sectorul\s*\d)[^€]{0,60}\b/u)?.[0] || '');

        return {
          page: pageNumber,
          listingId,
          title,
          href,
          visibleSourceLabel,
          visibleLocation,
          visiblePrice,
          isExternal: /\/link-extern\//i.test(href),
        };
      })
      .filter((item) => item.href && item.title);
  });
}

function countBy<T extends string>(items: ListingPreview[], pick: (item: ListingPreview) => T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = pick(item) || '(missing)';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const base = 'https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?location=8608,8276&sort=latest';
  const page1 = await extractPageListings(base, 1);
  const page2 = await extractPageListings(`${base}&page=2`, 2);
  const combined = [...page1, ...page2];

  console.log(
    JSON.stringify(
      {
        summary: {
          total: combined.length,
          page1: page1.length,
          page2: page2.length,
          countsBySourceLabel: countBy(combined, (item) => item.visibleSourceLabel),
          externalCount: combined.filter((item) => item.isExternal).length,
        },
        page1Listings: page1,
        page2Listings: page2,
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
