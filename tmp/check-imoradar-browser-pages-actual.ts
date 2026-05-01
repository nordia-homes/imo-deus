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

async function inspectUrl(url: string) {
  const { withScraperPage, waitForScraperReady } = await import('../src/lib/owner-listings/browser');

  return withScraperPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScraperReady(page, ['article', '[id^="listing-link-"]', 'h3'], 8000);
    const html = await page.content();

    return {
      url,
      title: await page.title(),
      length: html.length,
      hasListingMarker: /id="listing-link-\d+"/i.test(html),
      hasLinkExtern: /\/link-extern\//i.test(html),
      listingMarkerCount: (html.match(/id="listing-link-\d+"/gi) || []).length,
      linkExternCount: (html.match(/\/link-extern\//gi) || []).length,
    };
  });
}

async function main() {
  const base = 'https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?location=8608,8276&sort=latest';
  const results = [];

  results.push(await inspectUrl(base));
  results.push(await inspectUrl(`${base}&page=2`));

  console.log(JSON.stringify(results, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
