import type { Page } from 'playwright';
import { buildSummary, isOwnerText, normalizeUrl, normalizeWhitespace, parseRomanianDateToUnix } from '@/lib/owner-listings/utils';
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

async function extractListPage(page: Page) {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    return anchors
      .map((anchor) => {
        const href = anchor.getAttribute('href') || '';
        const card = anchor.closest('article') || anchor.closest('[class*="card"]') || anchor.parentElement;
        return {
          href,
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
      })
      .filter((item) => item.href && !item.href.startsWith('#'));
  });
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

function extractListPageFromHtml(html: string) {
  const listingMarkers = Array.from(html.matchAll(/id="listing-link-(\d+)"/gi));
  if (listingMarkers.length) {
    return listingMarkers
      .map((marker, index) => {
        const markerIndex = marker.index ?? 0;
        const start = Math.max(0, html.lastIndexOf('<a', markerIndex));
        const nextIndex = index + 1 < listingMarkers.length ? (listingMarkers[index + 1].index ?? html.length) : html.length;
        const end = Math.min(html.length, nextIndex + 500);
        const chunk = html.slice(start, end);
        const href = chunk.match(/href="([^"]*\/oferta\/[^"]+)"/i)?.[1] || '';
        const title =
          stripHtml(chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '') ||
          stripHtml(chunk.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
        const text = stripHtml(chunk);

        return {
          href,
          title,
          text,
          image: chunk.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i)?.[1] || '',
        };
      })
      .filter((item) => item.href && item.title);
  }

  const articles = extractArticleBlocks(html);
  if (articles.length) {
    return articles
      .map((article) => {
        const href = article.match(/href="([^"]*\/oferta\/[^"]+)"/i)?.[1] || '';
        const titleAttr = article.match(/\stitle="([^"]+)"/i)?.[1] || '';
        const heading = article.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || '';

        return {
          href,
          title: stripHtml(titleAttr || heading || article),
          text: stripHtml(article),
          image: article.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i)?.[1] || '',
        };
      })
      .filter((item) => item.href);
  }

  const matches = Array.from(
    html.matchAll(/<a[^>]+href="(?<href>[^"]*\/oferta\/[^"]+)"[^>]*>(?<inner>[\s\S]*?)<\/a>/gi)
  );

  return matches.map((match) => {
    const inner = match.groups?.inner || '';
    const titleAttr = match[0].match(/\stitle="([^"]+)"/i)?.[1] || '';
    const heading = inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || '';

    return {
      href: match.groups?.href || '',
      title: stripHtml(titleAttr || heading || inner),
      text: stripHtml(inner),
      image: match[0].match(/<img[^>]+(?:src|data-src)="([^"]+)"/i)?.[1] || '',
    };
  });
}

function parseCardText(text: string) {
  const normalized = normalizeWhitespace(text);
  const parts = normalized.split('•').map((part) => normalizeWhitespace(part));
  return {
    price: parts.find((line) => /€|eur|lei|ron/i.test(line)) || '',
    area: parts.find((line) => /\bmp\b|m²/i.test(line)) || '',
    rooms: parts.find((line) => /camera/i.test(line)) || '',
    location: parts.find((line) => /azi|ieri|actualizat|\d{1,2}[./-]\d{1,2}[./-]\d{4}/i.test(line)) || parts[0] || '',
  };
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

        const parsed = parseCardText(card.text);
        const postedAt = parseRomanianDateToUnix(parsed.location);
        if (!isWithinMaxAgeDays(postedAt, maxAgeDays)) {
          continue;
        }

        pageContainsOnlyOldListings = false;
        const absoluteUrl = normalizeUrl(card.href, 'https://www.imoradar24.ro');
        if (seenLinks.has(absoluteUrl)) continue;
        if (!matchesKeywords(`${parsed.location} ${card.text}`, options.searchKeywords)) {
          continue;
        }

        seenLinks.add(absoluteUrl);
        listings.push(
          buildSummary({
            scopeKey: options.scopeKey,
            scopeCity: options.scopeCity,
            source: 'imoradar24',
            externalId: absoluteUrl,
            title: card.title,
            price: parsed.price,
            area: parsed.area,
            rooms: parsed.rooms,
            location: parsed.location,
            postedAt,
            postedAtText: parsed.location,
            link: absoluteUrl,
            imageUrl: card.image,
            description: normalizeWhitespace(card.text).slice(0, 500),
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

    if (!isOwnerText(payload.bodyText)) {
      throw new Error('Anuntul Imoradar24 nu pare sa fie listat ca proprietar.');
    }

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
