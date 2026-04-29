import type { Page } from 'playwright';
import { buildSummary, extractAreaText, extractConstructionYear, normalizeUrl, normalizeWhitespace, parseRomanianDateToUnix } from '@/lib/owner-listings/utils';
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

function extractDetailText(html: string) {
  return stripHtml(html).replace(/\bm\s+2\b/gi, 'm2').replace(/\bm\s+²\b/gi, 'm2');
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

function extractConstructionYearStrict(text: string) {
  const normalized = normalizeWhitespace(text);
  const direct =
    normalized.match(/\ban(?:ul)?\s+construct(?:iei|ie|ii)?\s*:?\s*(19\d{2}|20\d{2})\b/i)?.[1] ||
    normalized.match(/\bbloc\s*(?:din|finalizat\s+in|construit\s+in)?\s*(19\d{2}|20\d{2})\b/i)?.[1] ||
    normalized.match(/\bimobil\s*(?:din|finalizat\s+in|construit\s+in)?\s*(19\d{2}|20\d{2})\b/i)?.[1] ||
    normalized.match(/\bfinalizat\s+in\s*(19\d{2}|20\d{2})\b/i)?.[1] ||
    '';

  if (!direct) {
    return undefined;
  }

  const parsed = Number(direct);
  const currentYear = new Date().getFullYear() + 1;
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= currentYear ? parsed : undefined;
}

function extractImoradarDetailFromHtml(html: string, url: string) {
  const text = extractDetailText(html);
  const title =
    stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') ||
    normalizeWhitespace(html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] || '') ||
    '';
  const description =
    normalizeWhitespace(html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || '') ||
    normalizeWhitespace(html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] || '') ||
    '';
  const price =
    normalizeWhitespace(html.match(/(\d[\d.\s]*)\s*(?:EUR|RON|LEI|€|â‚¬)/i)?.[0] || '') ||
    '';
  const images = Array.from(
    new Set(
      Array.from(html.matchAll(/<img[^>]+(?:src|data-src)="([^"]+)"/gi))
        .map((match) => normalizeWhitespace(match[1]))
        .filter((imageUrl) => imageUrl.startsWith('http'))
    )
  );

  return {
    title,
    description,
    area: extractAreaText(`${title} ${description} ${text}`),
    rooms: extractRoomCount(`${title} ${description} ${text}`),
    constructionYear: extractConstructionYearStrict(`${title} ${description} ${text}`) || extractConstructionYear(`${title} ${description} ${text}`),
    price,
    images,
    link: url,
  };
}

type ExtractedCard = {
  href: string;
  title: string;
  price: string;
  area: string;
  constructionYear?: number;
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
        const area = extractAreaText(`${title} ${plainText}`);
        const explicitYear = extractConstructionYearStrict(plainText);
        const constructionYear = explicitYear;
        const postedAtText = plainText.match(/\b(Azi|Ieri|\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/i)?.[1] || '';
        const text = [location, rooms, area, price, postedAtText].filter(Boolean).join(' • ');

        return {
          href,
          title,
          price,
          area,
          constructionYear,
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
      const area = extractAreaText(`${title} ${plainText}`);
      const constructionYear = extractConstructionYearStrict(plainText);
      const postedAtText = plainText.match(/\b(Azi|Ieri|\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/i)?.[1] || '';

      return {
        href,
        title,
        price,
        area,
        constructionYear,
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

        let enrichedCard = { ...card, href: absoluteUrl };
        if (!enrichedCard.constructionYear) {
          const detailHtml = await fetchScraperHtml(absoluteUrl, 15000).catch(() => '');
          if (detailHtml) {
            const detail = extractImoradarDetailFromHtml(detailHtml, absoluteUrl);
            enrichedCard = {
              ...enrichedCard,
              title: detail.title || enrichedCard.title,
              price: enrichedCard.price || detail.price,
              area: enrichedCard.area || detail.area,
              rooms: enrichedCard.rooms || detail.rooms,
              constructionYear: detail.constructionYear || enrichedCard.constructionYear,
              image: enrichedCard.image || detail.images[0] || '',
            };
          }
        }

        seenLinks.add(absoluteUrl);
        listings.push(
          buildSummary({
            scopeKey: options.scopeKey,
            scopeCity: options.scopeCity,
            source: 'imoradar24',
            externalId: absoluteUrl,
            title: enrichedCard.title,
            price: enrichedCard.price,
            area: enrichedCard.area,
            constructionYear: enrichedCard.constructionYear,
            year: enrichedCard.constructionYear,
            rooms: enrichedCard.rooms,
            location: enrichedCard.location,
            postedAt,
            postedAtText: enrichedCard.postedAtText,
            link: absoluteUrl,
            imageUrl: enrichedCard.image,
            description: normalizeWhitespace(`${enrichedCard.title} ${enrichedCard.location}`).slice(0, 500),
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
  const html = await fetchScraperHtml(url, 30000).catch(() => '');
  if (html) {
    const detail = extractImoradarDetailFromHtml(html, url);
    const summary = buildSummary({
      source: 'imoradar24',
      externalId: url,
      title: detail.title,
      price: detail.price,
      area: detail.area,
      rooms: detail.rooms,
      constructionYear: detail.constructionYear,
      year: detail.constructionYear,
      location: '',
      postedAt: Math.floor(Date.now() / 1000),
      link: url,
      imageUrl: detail.images[0] || '',
      description: detail.description,
    });

    return {
      ...summary,
      images: detail.images.slice(0, 12),
      fullDescription: detail.description,
      contactName: '',
      contactPhone: '',
    } satisfies OwnerListingDetail;
  }

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
      area: extractAreaText(`${payload.title} ${payload.description} ${payload.bodyText}`),
      rooms: extractRoomCount(`${payload.title} ${payload.description} ${payload.bodyText}`),
      constructionYear: extractConstructionYearStrict(`${payload.title} ${payload.description} ${payload.bodyText}`) || extractConstructionYear(`${payload.title} ${payload.description} ${payload.bodyText}`),
      year: extractConstructionYearStrict(`${payload.title} ${payload.description} ${payload.bodyText}`) || extractConstructionYear(`${payload.title} ${payload.description} ${payload.bodyText}`),
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
