import type { Page } from 'playwright';
import { buildSummary, isOwnerText, normalizeUrl, normalizeWhitespace, parseRomanianDateToUnix } from '@/lib/owner-listings/utils';
import type { OwnerListingDetail, OwnerListingSummary, SourceScrapeOptions } from '@/lib/owner-listings/types';
import { waitForScraperReady, withScraperPage } from '@/lib/owner-listings/browser';

function matchesKeywords(text: string, keywords: string[]) {
  const normalized = normalizeWhitespace(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

async function extractListPage(page: Page) {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/anunturi/imobiliare/"]'));
    return anchors.map((anchor) => {
      const card = anchor.closest('article') || anchor.closest('[class*="listing"]') || anchor.parentElement;
      return {
        href: anchor.getAttribute('href') || '',
        title:
          anchor.getAttribute('title') ||
          card?.querySelector('h2, h3, h4')?.textContent ||
          anchor.textContent ||
          '',
        text: card?.textContent || anchor.textContent || '',
        image:
          card?.querySelector('img')?.getAttribute('src') ||
          card?.querySelector('img')?.getAttribute('data-src') ||
          '',
      };
    });
  });
}

function parseCardText(text: string) {
  const normalized = normalizeWhitespace(text);
  const parts = normalized.split('•').map((part) => normalizeWhitespace(part));
  return {
    price: parts.find((line) => /€|eur|lei|ron/i.test(line)) || '',
    area: parts.find((line) => /\bmp\b|m²/i.test(line)) || '',
    rooms: parts.find((line) => /camera/i.test(line)) || '',
    location: parts.find((line) => /valabil din|azi|ieri|\d{1,2}[./-]\d{1,2}[./-]\d{4}/i.test(line)) || parts[0] || '',
  };
}

export async function scrapePubli24Listings(options: SourceScrapeOptions) {
  return withScraperPage(async (page) => {
    const listings: OwnerListingSummary[] = [];
    const seenLinks = new Set<string>();
    const hardPageLimit = options.maxPages ?? options.hardPageLimit ?? 250;

    for (const baseUrl of options.searchUrls) {
      for (let pageNumber = 1; pageNumber <= hardPageLimit; pageNumber += 1) {
        const pageUrl = new URL(baseUrl);
        if (pageNumber > 1) {
          pageUrl.searchParams.set('page', String(pageNumber));
        }

        await page.goto(pageUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForScraperReady(page, ['a[href*="/anunturi/imobiliare/"]', 'article', '[class*="listing"]'], 10000);
        const cards = await extractListPage(page);
        if (!cards.length) break;

        for (const card of cards) {
          if (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource) break;
          if (!card.href || !card.title) continue;
          if (!isOwnerText(`${card.title} ${card.text}`)) continue;

          const parsed = parseCardText(card.text);
          const absoluteUrl = normalizeUrl(card.href, 'https://www.publi24.ro');
          if (seenLinks.has(absoluteUrl)) continue;
          if (!matchesKeywords(`${parsed.location} ${card.text}`, options.searchKeywords)) {
            continue;
          }

          const idMatch = absoluteUrl.match(/ID anunț:\s*(\d+)|\/([a-z0-9]+)\.html/i);
          seenLinks.add(absoluteUrl);
          listings.push(
            buildSummary({
              scopeKey: options.scopeKey,
              scopeCity: options.scopeCity,
              source: 'publi24',
              externalId: idMatch?.[1] || idMatch?.[2] || absoluteUrl,
              title: card.title,
              price: parsed.price,
              area: parsed.area,
              rooms: parsed.rooms,
              location: parsed.location,
              postedAt: parseRomanianDateToUnix(parsed.location),
              postedAtText: parsed.location,
              link: absoluteUrl,
              imageUrl: card.image,
              description: normalizeWhitespace(card.text).slice(0, 500),
            })
          );
        }
      }
    }

    return listings;
  });
}

export async function scrapePubli24ListingDetail(url: string) {
  return withScraperPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScraperReady(page, ['h1', 'meta[property="og:title"]', 'img'], 10000);

    const payload = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const title =
        document.querySelector('h1')?.textContent ||
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        '';
      const description =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ||
        document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        '';
      const images = Array.from(document.querySelectorAll('img'))
        .map((img) => img.getAttribute('src') || img.getAttribute('data-src') || '')
        .filter((src) => src.startsWith('http'));
      return { bodyText, title, description, images };
    });

    if (!isOwnerText(payload.bodyText)) {
      throw new Error('Anuntul Publi24 nu pare sa fie publicat de proprietar.');
    }

    const summary = buildSummary({
      source: 'publi24',
      externalId: url.match(/\/([a-z0-9]+)\.html/i)?.[1] || url,
      title: payload.title,
      price: '',
      area: '',
      location: '',
      postedAt: Math.floor(Date.now() / 1000),
      link: url,
      imageUrl: payload.images[0] || '',
      description: payload.description,
    });

    return {
      ...summary,
      images: Array.from(new Set(payload.images)).slice(0, 12),
      fullDescription: payload.description,
      contactName: '',
      contactPhone: '',
    } satisfies OwnerListingDetail;
  });
}
