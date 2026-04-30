import type { Page } from 'playwright';
import { buildSummary, extractAreaText, extractConstructionYear, normalizeUrl, normalizeWhitespace, parseRomanianDateToUnix } from '@/lib/owner-listings/utils';
import type { OwnerListingDetail, OwnerListingSummary, SourceScrapeOptions } from '@/lib/owner-listings/types';
import { fetchScraperHtml, waitForScraperReady, withScraperPage } from '@/lib/owner-listings/browser';
import { scrapeOlxPhoneNumber } from '@/lib/owner-listings/sources/olx';
import { scrapePubli24ListingDetail } from '@/lib/owner-listings/sources/publi24';

const imoradarPhoneCache = new Map<string, string>();

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

function isLikelyImageUrl(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized.startsWith('http')) {
    return false;
  }

  try {
    const url = new URL(normalized);
    const pathname = url.pathname.toLowerCase();
    if (/\.(?:jpe?g|png|webp|avif|gif|bmp|svg)(?:$|\?)/i.test(pathname)) {
      return true;
    }

    if (/(?:image|img|photo|gallery|media)/i.test(pathname)) {
      return true;
    }

    if (url.searchParams.has('w') || url.searchParams.has('width') || url.searchParams.has('format')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function parseSrcSetCandidates(value: string) {
  return value
    .split(',')
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean)
    .map((entry) => {
      const [url = '', descriptor = ''] = entry.split(/\s+/, 2);
      return { url, descriptor };
    })
    .filter((entry) => isLikelyImageUrl(entry.url));
}

function inferImageScore(url: string, descriptor?: string) {
  let score = 0;
  const descriptorWidth = descriptor?.match(/(\d+)\s*w/i)?.[1];
  if (descriptorWidth) {
    score += Number(descriptorWidth) * 10;
  }

  const sizedParamMatch = url.match(/[?&](?:w|width|h|height)=(\d{2,4})/i);
  if (sizedParamMatch) {
    score += Number(sizedParamMatch[1]) * 4;
  }

  const dimensionsMatch = url.match(/(\d{2,4})x(\d{2,4})/i);
  if (dimensionsMatch) {
    score += Number(dimensionsMatch[1]) + Number(dimensionsMatch[2]);
  }

  if (/gallery-main|og-image-full|full|large|original|gallery|photo/i.test(url)) {
    score += 3000;
  }
  if (/gallery-full/i.test(url)) {
    score += 7000;
  }
  if (/gallery-main/i.test(url)) {
    score += 5000;
  }
  if (/og-image-full/i.test(url)) {
    score -= 2500;
  }
  if (/gallery-thumb|thumb|thumbnail|small|blur|placeholder|lazy/i.test(url)) {
    score -= 5000;
  }
  if (/logo|icon|sprite/i.test(url) || /assets\.imoradar24\.ro/i.test(url)) {
    score -= 15000;
  }
  if (/i\.roamcdn\.net/i.test(url)) {
    score += 2000;
  }

  return score;
}

function sortImageUrls(candidates: string[]) {
  const parsedCandidates = candidates
    .flatMap((candidate) => {
      const normalized = normalizeWhitespace(candidate);
      if (!normalized) return [];

      if (normalized.includes('http') && /\s+\d+w\b/i.test(normalized)) {
        return parseSrcSetCandidates(normalized).map((entry) => ({
          url: entry.url,
          score: inferImageScore(entry.url, entry.descriptor),
        }));
      }

      if (!isLikelyImageUrl(normalized)) return [];
      return [{ url: normalized, score: inferImageScore(normalized) }];
    })
    .filter((entry) => isLikelyImageUrl(entry.url));

  return Array.from(new Map(parsedCandidates.map((entry) => [entry.url, entry])).values())
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.url);
}

function pickImoradarCardCoverImage(candidates: string[]) {
  return Array.from(new Set(candidates.map((candidate) => normalizeWhitespace(candidate)).filter(Boolean)))
    .filter((candidate) => isLikelyImageUrl(candidate))
    .map((candidate) => {
      let score = inferImageScore(candidate);

      if (/watermark/i.test(candidate)) {
        score -= 25000;
      }
      if (/og-image-full/i.test(candidate)) {
        score += 6000;
      }
      if (/gallery-main/i.test(candidate) && !/watermark/i.test(candidate)) {
        score += 4000;
      }

      return { url: candidate, score };
    })
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.url)[0] || '';
}

function extractImageCandidatesFromHtml(html: string) {
  return Array.from(
    html.matchAll(
      /<(?:img|source)\b[^>]*?(?:src|data-src|data-lazy-src|data-original|data-full-image|data-image|srcset|data-srcset|data-large)="([^"]+)"/gi
    )
  ).map((match) => normalizeWhitespace(match[1]));
}

function extractCanonicalGalleryImages(html: string) {
  const directMatches = [
    ...Array.from(html.matchAll(/https:\/\/i\.roamcdn\.net\/prop\/rad\/gallery-full-[^"'\\\s<]+/gi)).map((match) => normalizeWhitespace(match[0])),
    ...Array.from(html.matchAll(/https:\/\/i\.roamcdn\.net\/prop\/rad\/gallery-main-[^"'\\\s<]+/gi)).map((match) => normalizeWhitespace(match[0])),
    ...Array.from(html.matchAll(/"@id":"(https:\/\/i\.roamcdn\.net\/[^"]+)"/gi)).map((match) => normalizeWhitespace(match[1])),
    ...Array.from(html.matchAll(/"contentUrl":"(https:\/\/i\.roamcdn\.net\/[^"]+)"/gi)).map((match) => normalizeWhitespace(match[1])),
    ...Array.from(html.matchAll(/<meta\s+property="og:image"\s+content="(https:\/\/[^"]+)"/gi)).map((match) => normalizeWhitespace(match[1])),
  ];

  return sortImageUrls(directMatches).slice(0, 20);
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

function normalizePhoneCandidate(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return '';
  }

  const compact = normalized.replace(/[^\d+]/g, '');
  if (/^\+?\d{8,15}$/.test(compact)) {
    return compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  }

  const localDigits = normalized.replace(/[^\d]/g, '');
  if (/^\d{8,15}$/.test(localDigits)) {
    return localDigits;
  }

  return '';
}

function extractImoradarSourceUrl(html: string, url: string) {
  const explicitAnchor =
    html.match(/href="(https?:\/\/[^"]+)"[\s\S]{0,300}?>\s*Vezi anunțul pe/i)?.[1] ||
    html.match(/Vezi anunțul pe[\s\S]{0,300}?href="(https?:\/\/[^"]+)"/i)?.[1] ||
    html.match(/href="(https?:\/\/(?:www\.)?(?:olx\.ro|storia\.ro|publi24\.ro|autovit\.ro|imovirtual\.ro)[^"]+)"/i)?.[1] ||
    '';

  if (explicitAnchor) {
    return normalizeUrl(explicitAnchor, url);
  }

  const embeddedTarget =
    html.match(/"targetUrl"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/targetUrl\\u0022:\s*\\u0022([^"]+)\\u0022/i)?.[1] ||
    '';

  return embeddedTarget ? normalizeUrl(embeddedTarget.replace(/\\\//g, '/'), url) : '';
}

function shouldSkipImoradarSourceUrl(sourceUrl: string) {
  const absoluteUrl = normalizeUrl(sourceUrl);
  if (!absoluteUrl) {
    return false;
  }

  try {
    const hostname = new URL(absoluteUrl).hostname.toLowerCase();
    return /(?:^|\.)olx\.ro$/.test(hostname) || /(?:^|\.)publi24\.ro$/.test(hostname);
  } catch {
    return false;
  }
}

function extractOlxExternalSourceUrl(html: string, url: string) {
  const directExternal =
    html.match(/data-testid="ad-contact-bar"[\s\S]{0,500}?href="(https?:\/\/(?:www\.)?(?:storia\.ro|publi24\.ro|autovit\.ro|imovirtual\.ro)[^"]+)"/i)?.[1] ||
    html.match(/href="(https?:\/\/(?:www\.)?(?:storia\.ro|publi24\.ro|autovit\.ro|imovirtual\.ro)[^"]+)"/i)?.[1] ||
    '';

  if (directExternal) {
    return normalizeUrl(directExternal, url);
  }

  const apiExternal =
    html.match(/"external_url":"(https?:\\\/\\\/[^"]+)"/i)?.[1] ||
    html.match(/"external_url"\s*:\s*"(https?:\/\/[^"]+)"/i)?.[1] ||
    '';

  return apiExternal ? normalizeUrl(apiExternal.replace(/\\\//g, '/'), url) : '';
}

function extractStoriaPhoneFromHtml(html: string) {
  const patterns = [
    /"contactDetails":\{"name":"[^"]*","type":"[^"]*","phones":\["([^"]+)"\]/i,
    /"owner":\{[\s\S]*?"contacts":\[\{"name":"[^"]*","phone":"([^"]+)"/i,
    /"phone":"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    const phone = normalizePhoneCandidate(match?.replace(/\\\//g, '/'));
    if (phone) {
      return phone;
    }
  }

  return '';
}

async function resolveImoradarPhoneFromSourceUrl(sourceUrl: string, seen = new Set<string>()): Promise<string> {
  const absoluteUrl = normalizeUrl(sourceUrl);
  if (!absoluteUrl || seen.has(absoluteUrl)) {
    return '';
  }

  const cached = imoradarPhoneCache.get(absoluteUrl);
  if (cached !== undefined) {
    return cached;
  }

  seen.add(absoluteUrl);

  let phone = '';
  const hostname = (() => {
    try {
      return new URL(absoluteUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  if (/storia\.ro$/.test(hostname)) {
    const html = await fetchScraperHtml(absoluteUrl, 30000).catch(() => '');
    phone = extractStoriaPhoneFromHtml(html);
  } else if (/publi24\.ro$/.test(hostname)) {
    const detail = await scrapePubli24ListingDetail(absoluteUrl).catch(() => null);
    phone = normalizePhoneCandidate(detail?.contactPhone || detail?.ownerPhone || '');
  } else if (/olx\.ro$/.test(hostname)) {
    phone = await scrapeOlxPhoneNumber(absoluteUrl).catch(() => '');
    if (!phone) {
      const html = await fetchScraperHtml(absoluteUrl, 30000).catch(() => '');
      const externalSourceUrl = html ? extractOlxExternalSourceUrl(html, absoluteUrl) : '';
      if (externalSourceUrl && externalSourceUrl !== absoluteUrl) {
        phone = await resolveImoradarPhoneFromSourceUrl(externalSourceUrl, seen);
      }
    }
  }

  imoradarPhoneCache.set(absoluteUrl, phone);
  return phone;
}

async function extractImoradarPhoneFromHtml(html: string, url: string) {
  const sourceUrl = extractImoradarSourceUrl(html, url);
  if (!sourceUrl) {
    return '';
  }

  return resolveImoradarPhoneFromSourceUrl(sourceUrl);
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
  const images = sortImageUrls([...extractCanonicalGalleryImages(html), ...extractImageCandidatesFromHtml(html)]).slice(0, 20);

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
          image: sortImageUrls(extractImageCandidatesFromHtml(chunk))[0] || '',
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
        image: sortImageUrls(extractImageCandidatesFromHtml(article))[0] || '',
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

        let enrichedCard: typeof card & { href: string; ownerPhone?: string } = { ...card, href: absoluteUrl };
        const detailHtml = await fetchScraperHtml(absoluteUrl, 15000).catch(() => '');
        if (detailHtml) {
          const sourceUrl = extractImoradarSourceUrl(detailHtml, absoluteUrl);
          if (shouldSkipImoradarSourceUrl(sourceUrl)) {
            seenLinks.add(absoluteUrl);
            continue;
          }

          const detail = extractImoradarDetailFromHtml(detailHtml, absoluteUrl);
          const ownerPhone = await extractImoradarPhoneFromHtml(detailHtml, absoluteUrl).catch(() => '');
          const coverImage = pickImoradarCardCoverImage([
            ...extractCanonicalGalleryImages(detailHtml),
            ...extractImageCandidatesFromHtml(detailHtml),
            enrichedCard.image,
          ]);
          enrichedCard = {
            ...enrichedCard,
            title: detail.title || enrichedCard.title,
            price: enrichedCard.price || detail.price,
            area: detail.area || enrichedCard.area,
            rooms: detail.rooms || enrichedCard.rooms,
            constructionYear: detail.constructionYear || enrichedCard.constructionYear,
            image: coverImage || enrichedCard.image || '',
            ownerPhone,
          };
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
            ownerPhone: normalizeWhitespace(enrichedCard.ownerPhone),
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
    const contactPhone = await extractImoradarPhoneFromHtml(html, url).catch(() => '');
    const coverImage = pickImoradarCardCoverImage([...extractCanonicalGalleryImages(html), ...extractImageCandidatesFromHtml(html), detail.images[0] || '']);
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
      imageUrl: coverImage || detail.images[0] || '',
      description: detail.description,
      ownerPhone: contactPhone,
    });

    return {
      ...summary,
      images: detail.images.slice(0, 12),
      fullDescription: detail.description,
      contactName: '',
      contactPhone,
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
        .flatMap((img) => [
          img.getAttribute('src') || '',
          img.currentSrc || '',
          img.getAttribute('data-src') || '',
          img.getAttribute('data-lazy-src') || '',
          img.getAttribute('data-original') || '',
          img.getAttribute('data-full-image') || '',
          img.getAttribute('data-image') || '',
          img.getAttribute('srcset') || '',
          img.getAttribute('data-srcset') || '',
        ])
        .filter((src) => src.startsWith('http'));
      return { bodyText, title, description, images };
    });
    const contactPhone = await extractImoradarPhoneFromHtml(await page.content(), url).catch(() => '');
    const pageHtml = await page.content();
    const coverImage = pickImoradarCardCoverImage([...extractCanonicalGalleryImages(pageHtml), ...payload.images]);

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
      imageUrl: coverImage || sortImageUrls([...extractCanonicalGalleryImages(pageHtml), ...payload.images])[0] || '',
      description: payload.description,
      ownerPhone: contactPhone,
    });

    return {
      ...summary,
      images: sortImageUrls([...extractCanonicalGalleryImages(pageHtml), ...payload.images]).slice(0, 12),
      fullDescription: payload.description,
      contactName: '',
      contactPhone,
    } satisfies OwnerListingDetail;
  });
}
