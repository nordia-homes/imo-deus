import type { Page } from 'playwright';
import { buildSummary, normalizeUrl, normalizeWhitespace, parseRomanianDateToUnix } from '@/lib/owner-listings/utils';
import type { OwnerListingDetail, OwnerListingSummary, SourceScrapeOptions } from '@/lib/owner-listings/types';
import { fetchScraperHtml, waitForScraperReady, withScraperPage } from '@/lib/owner-listings/browser';

function matchesKeywords(text: string, keywords: string[]) {
  const normalized = normalizeWhitespace(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function isWithinMaxAgeDays(unixTimestamp: number, maxAgeDays?: number | null) {
  if (!maxAgeDays) return true;
  const ageSeconds = Math.floor(Date.now() / 1000) - unixTimestamp;
  return ageSeconds <= maxAgeDays * 24 * 60 * 60;
}

function stripHtml(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  );
}

function extractArticleBlocks(html: string) {
  return Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi)).map((match) => match[0]);
}

function extractRoomCount(text: string) {
  const normalized = normalizeWhitespace(text);
  return (
    normalized.match(/\b(\d+)\s+camere?\b/i)?.[0] ||
    normalized.match(/\bapartament\s+cu\s+(\d+)\s+camere?\b/i)?.[0] ||
    ''
  );
}

type ExtractedCard = {
  href: string;
  title: string;
  price: string;
  area: string;
  rooms: string;
  location: string;
  postedAtText: string;
  image: string;
  text: string;
};

function extractListPageFromHtml(html: string): ExtractedCard[] {
  const listingMarkers = Array.from(html.matchAll(/id="listing-link-(\d+)"/gi));
  if (listingMarkers.length) {
    return listingMarkers
      .map((marker, index) => {
        const markerIndex = marker.index ?? 0;
        const textContainerIndex = html.lastIndexOf('class="md:w-3/5', markerIndex);
        const start = Math.max(0, textContainerIndex >= 0 ? html.lastIndexOf('<div', textContainerIndex) : html.lastIndexOf('<a', markerIndex));
        const nextIndex = index + 1 < listingMarkers.length ? (listingMarkers[index + 1].index ?? html.length) : html.length;
        const chunk = html.slice(start, nextIndex);
        const href = chunk.match(/href="([^"]*\/oferta\/[^"]+)"/i)?.[1] || '';
        const title =
          stripHtml(chunk.match(/<span class="relative top-\[2px\][^"]*>\s*([\s\S]*?)\s*<\/span>/i)?.[1] || '') ||
          stripHtml(chunk.match(/<h3[^>]*class="hide-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '') ||
          stripHtml(chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '');
        const plainText = stripHtml(chunk);
        const price = title.match(/\d[\d.]*\s*€/i)?.[0] || plainText.match(/\b\d[\d.]*\s*€/i)?.[0] || '';
        const location =
          plainText.match(/\b([A-ZĂÂÎȘȚ][A-Za-zĂÂÎȘȚăâîșț\- ]+,\s*Sectorul\s*\d)\b/u)?.[1] ||
          title.match(/în\s+([^0-9€]{2,50})/u)?.[1] ||
          '';
        const rooms = extractRoomCount(`${title} ${plainText}`);
        const area = plainText.match(/\b\d+\s*mp\b/i)?.[0] || '';
        const postedAtText = plainText.match(/\b(Azi|Ieri|\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/i)?.[1] || '';
        const text = [location, rooms, area, price, postedAtText].filter(Boolean).join(' • ');

        return {
          href,
          title,
          price,
          area,
          rooms,
          location,
          postedAtText,
          text,
          image: chunk.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i)?.[1] || '',
        };
      })
      .filter((item) => item.href && item.title);
  }

  const articles = extractArticleBlocks(html);
  return articles
    .map((article) => {
      const href = article.match(/href="([^"]*\/oferta\/[^"]+)"/i)?.[1] || '';
      const title = stripHtml(article.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || '');
      const plainText = stripHtml(article);
      const price = title.match(/\d[\d.]*\s*€/i)?.[0] || plainText.match(/\b\d[\d.]*\s*€/i)?.[0] || '';
      const location = title.match(/în\s+([^0-9€]{2,50})/u)?.[1] || '';
      const rooms = extractRoomCount(`${title} ${plainText}`);
      const area = plainText.match(/\b\d+\s*mp\b/i)?.[0] || '';
      const postedAtText = plainText.match(/\b(Azi|Ieri|\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/i)?.[1] || '';

      return {
        href,
        title,
        price,
        area,
        rooms,
        location,
        postedAtText,
        text: [location, rooms, area, price, postedAtText].filter(Boolean).join(' • '),
        image: article.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i)?.[1] || '',
      };
    })
    .filter((item) => item.href && item.title);
}

export async function scrapeImoradar24Listings(options: SourceScrapeOptions) {
  const listings: OwnerListingSummary[] = [];
  const seenLinks = new Set<string>();
  const hardPageLimit = options.maxPages ?? options.hardPageLimit ?? 250;
  const maxAgeDays = options.maxAgeDays ?? 60;

  for (const baseUrl of options.searchUrls) {
    for (let pageNumber = 1; pageNumber <= hardPageLimit; pageNumber += 1) {
      const pageUrl = new URL(baseUrl);
      if (pageNumber > 1) {
        pageUrl.searchParams.set('page', String(pageNumber));
      }

      const html = await fetchScraperHtml(pageUrl.toString(), 30000);
      const cards = extractListPageFromHtml(html);
      if (!cards.length) break;
      let pageContainsOnlyOldListings = true;

      for (const card of cards) {
        if (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource) break;
        if (!/imoradar24\.ro/.test(card.href) && !card.href.startsWith('/')) continue;

        const postedAt = parseRomanianDateToUnix(card.postedAtText || '');
        if (!isWithinMaxAgeDays(postedAt, maxAgeDays)) {
          continue;
        }

        pageContainsOnlyOldListings = false;
        const absoluteUrl = normalizeUrl(card.href, 'https://www.imoradar24.ro');
        if (seenLinks.has(absoluteUrl)) continue;

        seenLinks.add(absoluteUrl);
        listings.push(
          buildSummary({
            scopeKey: options.scopeKey,
            scopeCity: options.scopeCity,
            source: 'imoradar24',
            externalId: absoluteUrl,
            title: card.title,
            price: card.price,
            area: card.area,
            rooms: card.rooms,
            location: card.location,
            postedAt,
            postedAtText: card.postedAtText,
            link: absoluteUrl,
            imageUrl: card.image,
            description: normalizeWhitespace(`${card.title} ${card.location}`).slice(0, 500),
          })
        );
      }

      if (pageContainsOnlyOldListings) {
        break;
      }
    }
  }

  return listings;
}

export async function scrapeImoradar24ListingDetail(url: string) {
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

    const summary = buildSummary({
      source: 'imoradar24',
      externalId: url,
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
