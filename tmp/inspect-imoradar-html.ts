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
  const { fetchScraperHtml } = await import('../src/lib/owner-listings/browser');
  const url = 'https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?location=8608,8276&sort=latest&page=1';
  const html = await fetchScraperHtml(url, 30000);

  console.log(
    JSON.stringify(
      {
        url,
        length: html.length,
        hasListingMarker: /id="listing-link-\d+"/i.test(html),
        hasLinkExtern: /\/link-extern\//i.test(html),
        hasCaptcha: /captcha|cloudflare|challenge|blocked|forbidden|access denied|verify you are human/i.test(html),
        title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '',
        firstSnippet: html.slice(0, 1200),
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
