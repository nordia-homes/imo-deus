import {
  buildSummary,
  extractConstructionYear,
  normalizeUrl,
  normalizeWhitespace,
} from '@/lib/owner-listings/utils';
import type { OwnerListingDetail, OwnerListingSourcePageResult, OwnerListingSummary, SourceScrapeOptions } from '@/lib/owner-listings/types';
import { fetchScraperHtml, waitForScraperReady, withRemoteBrowserPage, withScraperPage } from '@/lib/owner-listings/browser';

const ROMANIAN_PHONE_WORD_DIGITS: Record<string, string> = {
  zero: '0',
  unu: '1',
  una: '1',
  doi: '2',
  doua: '2',
  trei: '3',
  patru: '4',
  cinci: '5',
  sase: '6',
  sapte: '7',
  opt: '8',
  noua: '9',
};
const olxPhoneCache = new Map<string, string>();

function matchesKeywords(text: string, keywords: string[]) {
  const normalized = normalizeWhitespace(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function normalizeComparableText(value: string) {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripHtml(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
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
    .filter((entry) => entry.url.startsWith('http'));
}

function inferImageScore(url: string, descriptor?: string) {
  let score = 0;
  const descriptorWidth = descriptor?.match(/(\d+)\s*w/i)?.[1];
  if (descriptorWidth) {
    score += Number(descriptorWidth) * 10;
  }

  const sizedPathMatch = url.match(/[;?&](?:s|w|width)=(\d{2,4})(?:x(\d{2,4}))?/i);
  if (sizedPathMatch) {
    score += Number(sizedPathMatch[1]) * 2;
    if (sizedPathMatch[2]) {
      score += Number(sizedPathMatch[2]);
    }
  }

  const rawDimensionsMatch = url.match(/(\d{2,4})x(\d{2,4})/i);
  if (rawDimensionsMatch) {
    score += Number(rawDimensionsMatch[1]) + Number(rawDimensionsMatch[2]);
  }

  if (/apollo\.olxcdn\.com/i.test(url)) {
    score += 2000;
  }
  if (/\/image(?:[?#]|$)/i.test(url)) {
    score += 20000;
  }
  if (/;s=\d{2,4}x\d{2,4}/i.test(url)) {
    score -= 8000;
  }
  if (/placeholder|avatar|logo|icon|default/i.test(url)) {
    score -= 5000;
  }

  return score;
}

function pickBestImageUrl(candidates: string[]) {
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

      if (!normalized.startsWith('http')) return [];
      return [{ url: normalized, score: inferImageScore(normalized) }];
    })
    .filter((entry) => entry.url.startsWith('http'));

  const uniqueCandidates = Array.from(new Map(parsedCandidates.map((entry) => [entry.url, entry])).values());
  uniqueCandidates.sort((left, right) => right.score - left.score);
  return uniqueCandidates[0]?.url || '';
}

function sortImageUrls(candidates: string[]) {
  return Array.from(
    new Map(
      candidates
        .map((url) => normalizeWhitespace(url))
        .filter((url) => url.startsWith('http'))
        .map((url) => [url, { url, score: inferImageScore(url) }])
    ).values()
  )
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.url);
}

function extractRoomCount(text: string) {
  const normalized = normalizeWhitespace(text);
  return (
    normalized.match(/\b(\d+)\s+camere?\b/i)?.[0] ||
    normalized.match(/\bapartament\s+cu\s+(\d+)\s+camere?\b/i)?.[0] ||
    (/\bgarsoniera\b/i.test(normalized) ? '1 camera' : '') ||
    ''
  );
}

function extractPriceText(text: string) {
  const normalized = normalizeWhitespace(text);
  const match =
    normalized.match(/\b\d{2,3}(?:[.\s]\d{3})+(?:[.,]\d{1,2})?\s*(?:€|eur|â‚¬)\b/i) ||
    normalized.match(/\b\d{2,3}(?:[.\s]\d{3})+(?:[.,]\d{1,2})?\b/);
  return match ? normalizeWhitespace(match[0]) : '';
}

function extractAreaTextStrict(text: string) {
  const normalized = normalizeWhitespace(text);
  const comparable = normalizeComparableText(text);
  const match =
    normalized.match(/\b([1-9]\d{1,2}(?:[.,]\d{1,2})?)\s*(?:mp|m2|m²|㎡)\b/i) ||
    comparable.match(/\b([1-9]\d{1,2}(?:[.,]\d{1,2})?)\s*(?:mp|m2|m²)\b/i);
  if (!match) return '';

  const areaValue = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(areaValue) || areaValue < 10 || areaValue > 500) {
    return '';
  }

  return `${String(match[1]).replace('.', ',')} mp`;
}

function extractLocationText(text: string) {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(
    /\b(Bucuresti(?:,\s*Sectorul\s*\d)?|Sectorul\s*\d|Ilfov|Popesti(?:-Leordeni)?|Voluntari|Otopeni|Bragadiru|Chiajna|Baneasa|Titan|Pallady|Domenii|Dristor)\b/i
  );
  return match ? normalizeWhitespace(match[0]) : '';
}

function extractAreaTextFromLabeledValue(text: string) {
  const strictMatch = extractAreaTextStrict(text);
  if (strictMatch) {
    return strictMatch;
  }

  const normalized = normalizeWhitespace(text);
  const comparable = normalizeComparableText(text);
  const match =
    normalized.match(/\b([1-9]\d{1,2}(?:[.,]\d{1,2})?)\b/) ||
    comparable.match(/\b([1-9]\d{1,2}(?:[.,]\d{1,2})?)\b/);
  if (!match) return '';

  const areaValue = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(areaValue) || areaValue < 10 || areaValue > 500) {
    return '';
  }

  return `${String(match[1]).replace('.', ',')} mp`;
}

function extractAreaFromOlxBodyText(text: string) {
  const comparable = normalizeComparableText(text);
  const match = comparable.match(
    /\bsuprafata(?:\s+(?:utila|totala))?(?:\s+de)?\s*:?\s*([1-9]\d{1,2}(?:[.,]\d{1,2})?)(?:\s*(?:mp|m2|m²))?\b/i
  );
  if (!match) return '';

  const areaValue = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(areaValue) || areaValue < 10 || areaValue > 500) {
    return '';
  }

  return `${String(match[1]).replace('.', ',')} mp`;
}

function extractOlxConstructionYearLabel(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;

  const exactYear = normalized.match(/^(19\d{2}|20\d{2})$/)?.[1];
  if (exactYear) {
    return exactYear;
  }

  if (
    /^(?:inainte de|dup[aă])\s+(19\d{2}|20\d{2})$/i.test(normalized) ||
    /^(19\d{2}|20\d{2})\s*[-–]\s*(19\d{2}|20\d{2})$/i.test(normalized)
  ) {
    return normalized;
  }

  return undefined;
}

function extractOlxConstructionYearFromBodyText(text: string) {
  const normalized = normalizeComparableText(text);
  const labeledMatch = normalized.match(
    /an\s+construct(?:ie|iei|ii)\s*:?\s*(inainte de\s+\d{4}|dupa\s+\d{4}|\d{4}\s*[-–]\s*\d{4}|\d{4})/i
  )?.[1];

  return extractOlxConstructionYearLabel(labeledMatch || '');
}

function parseCard(title: string, text: string) {
  const combined = normalizeWhitespace(`${title} ${text}`);
  return {
    price: extractPriceText(combined),
    area: extractAreaTextStrict(combined) || extractAreaFromOlxBodyText(combined),
    rooms: extractRoomCount(combined),
    location: extractLocationText(combined),
    constructionYear: extractConstructionYear(combined),
  };
}

type ParsedOlxCard = {
  price: string;
  area: string;
  rooms: string;
  location: string;
  constructionYear?: string | number;
};

function decodeOlxEscaped(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\\"/g, '"')
      .replace(/\\u002F/g, '/')
      .replace(/\\u003C/g, '<')
      .replace(/\\u003E/g, '>')
      .replace(/\\u00a0/gi, ' ')
      .replace(/\\\//g, '/')
  );
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

function normalizeComparableWordText(value: string) {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractRomanianWordPhone(text: string) {
  const normalized = normalizeComparableWordText(text).replace(/[^a-z0-9+]+/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);
  let current = '';

  const flush = () => {
    const candidate = normalizePhoneCandidate(current);
    current = '';
    return candidate;
  };

  for (const token of tokens) {
    const digit = ROMANIAN_PHONE_WORD_DIGITS[token];
    if (digit) {
      current += digit;
      continue;
    }

    if (current.length >= 8) {
      const candidate = flush();
      if (candidate) {
        return candidate;
      }
    } else {
      current = '';
    }
  }

  if (current.length >= 8) {
    return normalizePhoneCandidate(current);
  }

  return '';
}

function extractPhoneFromText(text: string) {
  const directPatterns = [
    /(?:\+4|004)?07\d(?:[\s.-]?\d){7,8}/g,
    /(?:\+4|004)?0(?:2|3)\d(?:[\s.-]?\d){7,8}/g,
    /\b0\d(?:[\s.-]?\d){7,12}\b/g,
  ];

  for (const pattern of directPatterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = normalizePhoneCandidate(match[0]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return extractRomanianWordPhone(text);
}

function extractOlxPhoneFromHtml(html: string) {
  const telMatches = [
    ...Array.from(html.matchAll(/href="tel:([^"]+)"/gi)).map((match) => match[1]),
    ...Array.from(html.matchAll(/"phone":"([^"]+)"/gi)).map((match) => decodeOlxEscaped(match[1])),
    ...Array.from(html.matchAll(/\\"phone\\":\\"([^\\"]+)\\"/gi)).map((match) => decodeOlxEscaped(match[1])),
    ...Array.from(html.matchAll(/"telephone":"([^"]+)"/gi)).map((match) => decodeOlxEscaped(match[1])),
    ...Array.from(html.matchAll(/\\"telephone\\":\\"([^\\"]+)\\"/gi)).map((match) => decodeOlxEscaped(match[1])),
    ...Array.from(html.matchAll(/"phoneNumber":"([^"]+)"/gi)).map((match) => decodeOlxEscaped(match[1])),
    ...Array.from(html.matchAll(/\\"phoneNumber\\":\\"([^\\"]+)\\"/gi)).map((match) => decodeOlxEscaped(match[1])),
    ...Array.from(html.matchAll(/"phones":\[(.*?)\]/gi)).flatMap((match) =>
      Array.from(match[1].matchAll(/"([^"]+)"/g)).map((phoneMatch) => decodeOlxEscaped(phoneMatch[1]))
    ),
    ...Array.from(html.matchAll(/\\"phones\\":\[(.*?)\]/gi)).flatMap((match) =>
      Array.from(match[1].matchAll(/\\"([^\\"]+)\\"/g)).map((phoneMatch) => decodeOlxEscaped(phoneMatch[1]))
    ),
  ];

  for (const value of telMatches) {
    const candidate = normalizePhoneCandidate(value);
    if (candidate) {
      return candidate;
    }
  }

  const extractedText = [
    extractOlxDescriptionFromHtml(html),
    decodeOlxEscaped(html.match(/"description":"([\s\S]*?)","validTo"/i)?.[1] || ''),
    stripHtml(html),
  ]
    .filter(Boolean)
    .join(' ');

  return extractPhoneFromText(extractedText);
}

function extractOlxFrictionTokenFromHtml(html: string) {
  const rawMatch =
    html.match(/"frictionToken":"([^"]+)"/i)?.[1] ||
    html.match(/\\"frictionToken\\":\\"([^\\"]+)\\"/i)?.[1] ||
    html.match(/"friction_token":"([^"]+)"/i)?.[1] ||
    html.match(/\\"friction_token\\":\\"([^\\"]+)\\"/i)?.[1] ||
    html.match(/data-friction-token="([^"]+)"/i)?.[1] ||
    html.match(/name="friction-token"[^>]*value="([^"]+)"/i)?.[1] ||
    '';

  return decodeOlxEscaped(rawMatch);
}

function extractOlxAdId(value: string) {
  const normalized = normalizeWhitespace(value);
  return (
    normalized.match(/"sku":"(\d{6,12})"/i)?.[1] ||
    normalized.match(/"id":(\d{6,12}),"title":/i)?.[1] ||
    normalized.match(/window\.__PRERENDERED_STATE__\s*=\s*".*?\\"id\\":(\d{6,12})/i)?.[1] ||
    normalized.match(/\bad-id=(\d{6,12})\b/i)?.[1] ||
    normalized.match(/\bID:\s*(\d{6,12})\b/i)?.[1] ||
    ''
  );
}

async function fetchOlxPhoneByAdId(adId: string, frictionToken?: string) {
  const normalizedAdId = normalizeWhitespace(adId);
  if (!normalizedAdId) {
    return '';
  }

  const cacheKey = frictionToken ? `${normalizedAdId}:${frictionToken}` : normalizedAdId;
  const cached = olxPhoneCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const cookieHeader = normalizeWhitespace(process.env.OLX_COOKIE || '');
  const csrfToken = normalizeWhitespace(process.env.OLX_CSRF_TOKEN || '');
  const response = await fetch(`https://www.olx.ro/api/v1/offers/${normalizedAdId}/limited-phones`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
      Accept: 'application/json, text/plain, */*',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...(frictionToken ? { 'friction-token': frictionToken } : {}),
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!response?.ok) {
    olxPhoneCache.set(cacheKey, '');
    return '';
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: { phones?: string[] | null } | null }
    | null;

  const phone = payload?.data?.phones?.map((value) => normalizePhoneCandidate(value)).find(Boolean) || '';
  olxPhoneCache.set(cacheKey, phone);
  return phone;
}

async function fetchOlxPhoneViaRemoteBrowser(url: string, adId: string) {
  const remoteBrowserUrl = normalizeWhitespace(
    process.env.OLX_REMOTE_DEBUGGING_URL || process.env.OLX_CDP_URL || process.env.SCRAPER_CDP_URL || ''
  );
  if (!remoteBrowserUrl) {
    return '';
  }

  const normalizedAdId = normalizeWhitespace(adId);
  if (!normalizedAdId) {
    return '';
  }

  const cacheKey = `remote:${normalizedAdId}`;
  const cached = olxPhoneCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const phone = await withRemoteBrowserPage(remoteBrowserUrl, async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScraperReady(page, ['h1', '[data-testid="show-phone"]'], 10000);

    const payload = await page.evaluate(async ({ currentAdId }) => {
      const response = await fetch(`https://www.olx.ro/api/v1/offers/${currentAdId}/limited-phones`, {
        credentials: 'include',
        headers: {
          accept: 'application/json, text/plain, */*',
        },
      }).catch(() => null);

      if (!response) {
        return null;
      }

      return {
        ok: response.ok,
        status: response.status,
        text: await response.text().catch(() => ''),
      };
    }, { currentAdId: normalizedAdId });

    if (!payload?.ok) {
      return '';
    }

    const parsed = JSON.parse(payload.text || '{}') as { data?: { phones?: string[] | null } | null };
    return parsed.data?.phones?.map((value) => normalizePhoneCandidate(value)).find(Boolean) || '';
  }).catch(() => '');

  olxPhoneCache.set(cacheKey, phone);
  return phone;
}

function extractOlxLabeledParam(html: string, labels: string[]) {
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedMatch = html.match(
      new RegExp(`\\\\\"name\\\\\":\\\\\"${escapedLabel}\\\\\"[\\s\\S]*?\\\\\"(?:value|normalizedValue)\\\\\":\\\\\"([^\\\\\"]+)\\\\\"`, 'i')
    );
    if (escapedMatch?.[1]) {
      return decodeOlxEscaped(escapedMatch[1]);
    }

    const plainMatch = html.match(
      new RegExp(`"name":"${escapedLabel}"[\\s\\S]*?"(?:value|normalizedValue)":"([^"]+)"`, 'i')
    );
    if (plainMatch?.[1]) {
      return decodeOlxEscaped(plainMatch[1]);
    }
  }

  return '';
}

function extractOlxPriceFromHtml(html: string) {
  const regularPrice =
    html.match(/\\"regularPrice\\":\{[\s\S]*?\\"value\\":(\d+(?:\.\d+)?)/i)?.[1] ||
    html.match(/"regularPrice":\{[\s\S]*?"value":(\d+(?:\.\d+)?)/i)?.[1] ||
    '';

  if (regularPrice) {
    const parsed = Number(regularPrice);
    if (Number.isFinite(parsed)) {
      return String(parsed);
    }
  }

  const displayValue =
    html.match(/\\"displayValue\\":\\\\"([^\\"]+)\\\\"/i)?.[1] ||
    html.match(/"displayValue":"([^"]+)"/i)?.[1] ||
    '';

  return displayValue ? decodeOlxEscaped(displayValue) : '';
}

function extractOlxTitleFromHtml(html: string) {
  return normalizeWhitespace((
    stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') ||
    decodeOlxEscaped(html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] || '') ||
    stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') ||
    decodeOlxEscaped(html.match(/"title":"([^"]+)"/i)?.[1] || '') ||
    ''
  ).replace(/\s*[•|]\s*OLX\.ro\s*$/i, ''));
}

function extractOlxDescriptionFromHtml(html: string) {
  return (
    decodeOlxEscaped(html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || '') ||
    decodeOlxEscaped(html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] || '') ||
    decodeOlxEscaped(html.match(/"description":"([\s\S]*?)","validTo"/i)?.[1] || '') ||
    ''
  );
}

function extractOlxImagesFromHtml(html: string) {
  const matches = Array.from(
    html.matchAll(/https?:\\?\/\\?\/[^"'\\\s]*apollo\.olxcdn\.com[^"'\\\s<]*/gi)
  )
    .map((match) => decodeOlxEscaped(match[0]))
    .filter((url) => /\/v1\/files\//i.test(url));

  const ogImage = decodeOlxEscaped(html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] || '');
  return Array.from(new Set([ogImage, ...matches].filter(Boolean)));
}

function extractCardChunk(html: string, index: number, nextIndex: number) {
  const articleStart = html.lastIndexOf('<article', index);
  const articleEnd = html.indexOf('</article>', index);
  if (articleStart >= 0 && articleEnd > index && articleEnd - articleStart < 30000) {
    return {
      chunk: html.slice(articleStart, articleEnd + '</article>'.length),
      isolated: true,
    };
  }

  const snippetStart = Math.max(0, index - 2500);
  const snippetEnd = Math.min(html.length, nextIndex + 2500);
  return {
    chunk: html.slice(snippetStart, snippetEnd),
    isolated: false,
  };
}

function extractImageCandidatesFromChunk(chunk: string) {
  return Array.from(
    chunk.matchAll(/(?:src|data-src|data-image-src|srcset|data-srcset|data-image-srcset)="([^"]+)"/gi)
  ).map((match) => decodeOlxEscaped(match[1]));
}

function extractPriceFromChunk(chunk: string) {
  const priceMatches = [
    ...Array.from(chunk.matchAll(/\b\d{2,3}(?:[.\s]\d{3})+(?:[.,]\d{1,2})?\s*(?:â‚¬|eur|Ã¢â€šÂ¬)\b/gi)).map((match) =>
      normalizeWhitespace(match[0])
    ),
    ...Array.from(chunk.matchAll(/\b\d{2,3}(?:[.\s]\d{3})+(?:[.,]\d{1,2})?\b/g)).map((match) =>
      normalizeWhitespace(match[0])
    ),
  ];

  return priceMatches[0] || '';
}

function extractListPageFromHtml(html: string) {
  const hrefMatches = Array.from(html.matchAll(/href="([^"]*\/d\/oferta\/[^"]+)"/gi));
  const cards: Array<{ href: string; title: string; text: string; price: string; imageCandidates: string[]; isolated: boolean }> = [];
  const seen = new Set<string>();

  for (let index = 0; index < hrefMatches.length; index += 1) {
    const href = hrefMatches[index]?.[1] || '';
    if (!href || seen.has(href)) continue;

    const currentIndex = hrefMatches[index]?.index ?? 0;
    const nextIndex = hrefMatches[index + 1]?.index ?? Math.min(html.length, currentIndex + 8000);
    const { chunk, isolated } = extractCardChunk(html, currentIndex, nextIndex);
    const title =
      decodeOlxEscaped(chunk.match(/\stitle="([^"]+)"/i)?.[1] || '') ||
      decodeOlxEscaped(chunk.match(/aria-label="([^"]+)"/i)?.[1] || '') ||
      stripHtml(chunk.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || '') ||
      '';
    const text = stripHtml(chunk);
    const price = extractPriceFromChunk(chunk);
    const imageCandidates = extractImageCandidatesFromChunk(chunk);

    if (!title) continue;

    seen.add(href);
    cards.push({ href, title, text, price, imageCandidates, isolated });
  }

  return cards;
}

function extractOlxParamsFromHtml(html: string) {
  const areaSource = extractOlxLabeledParam(html, [
    'Suprafata utila',
    'Suprafata',
    'Suprafața utilă',
    'Suprafața',
    'Suprafata totala',
    'Suprafața totală',
  ]);
  const roomsSource = extractOlxLabeledParam(html, ['Numar camere', 'Număr camere', 'Nr. camere']);
  const yearSource = extractOlxLabeledParam(html, ['An constructie', 'An construcție']);
  const bodyText = stripHtml(html);
  const constructionYearFromPage = extractOlxConstructionYearLabel(yearSource) || extractOlxConstructionYearFromBodyText(bodyText);

  return {
    area: extractAreaTextFromLabeledValue(areaSource) || extractAreaFromOlxBodyText(bodyText),
    rooms: extractRoomCount(roomsSource) || extractRoomCount(bodyText),
    constructionYear: constructionYearFromPage || extractConstructionYear(bodyText),
    price: extractOlxPriceFromHtml(html) || extractPriceText(bodyText),
  };
}

async function extractOlxParamsFromDom(url: string) {
  return withScraperPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScraperReady(page, ['[data-testid="ad-parameters-container"]', 'h1'], 10000);

    const params = await page.evaluate(() => {
      const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
      const bodyText = clean(document.body.innerText || '');
      const matchValue = (patterns: RegExp[]) => {
        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match?.[1]) {
            return clean(match[1]);
          }
        }
        return '';
      };
      const price = document.querySelector('[data-testid="ad-price-container"]')?.textContent || '';

      return {
        area: matchValue([
          /Suprafata utila\s*:\s*([0-9]+(?:[.,][0-9]+)?(?:\s*(?:mp|m²|m2))?)/i,
          /Suprafața utilă\s*:\s*([0-9]+(?:[.,][0-9]+)?(?:\s*(?:mp|m²|m2))?)/i,
          /Suprafata\s*:\s*([0-9]+(?:[.,][0-9]+)?(?:\s*(?:mp|m²|m2))?)/i,
          /Suprafața\s*:\s*([0-9]+(?:[.,][0-9]+)?(?:\s*(?:mp|m²|m2))?)/i,
          /Suprafata totala\s*:\s*([0-9]+(?:[.,][0-9]+)?(?:\s*(?:mp|m²|m2))?)/i,
          /Suprafața totală\s*:\s*([0-9]+(?:[.,][0-9]+)?(?:\s*(?:mp|m²|m2))?)/i,
        ]),
        bodyText,
        rooms: matchValue([
          /Numar camere\s*:\s*([^\n\r]+)/i,
          /Număr camere\s*:\s*([^\n\r]+)/i,
          /Nr\.\s*camere\s*:\s*([^\n\r]+)/i,
        ]),
        constructionYear: matchValue([
          /An constructie\s*:\s*([^\n\r]+)/i,
          /An construcție\s*:\s*([^\n\r]+)/i,
        ]),
        price: clean(price),
        images: Array.from(document.querySelectorAll('img'))
          .flatMap((img) => [
            img.getAttribute('src') || '',
            img.currentSrc || '',
            img.getAttribute('data-src') || '',
            img.getAttribute('data-image-src') || '',
            img.getAttribute('srcset') || '',
            img.getAttribute('data-srcset') || '',
            img.getAttribute('data-image-srcset') || '',
          ])
          .filter(Boolean),
      };
    });

    return {
      area: extractAreaTextFromLabeledValue(params.area) || extractAreaFromOlxBodyText(params.bodyText),
      rooms: extractRoomCount(params.rooms) || extractRoomCount(params.bodyText),
      constructionYear:
        extractOlxConstructionYearLabel(params.constructionYear) ||
        extractOlxConstructionYearFromBodyText(params.bodyText) ||
        extractConstructionYear(params.bodyText),
      price: extractPriceText(params.price),
      imageUrl: pickBestImageUrl(params.images),
      images: sortImageUrls(params.images.map((image) => pickBestImageUrl([image])).filter(Boolean)).slice(0, 12),
    };
  });
}

async function extractOlxPhoneFromDom(url: string) {
  return withScraperPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScraperReady(page, ['[data-testid="show-phone"]', 'h1'], 10000);

    const capturedPhones: string[] = [];
    const capturePhoneResponse = async (response: { url: () => string; text: () => Promise<string> }) => {
      if (!/\/limited-phones(?:[/?#]|$)/i.test(response.url())) {
        return;
      }

      const text = await response.text().catch(() => '');
      if (!text) {
        return;
      }

      const parsed = JSON.parse(text || '{}') as { data?: { phones?: string[] | null } | null };
      const phone = parsed.data?.phones?.map((value) => normalizePhoneCandidate(value)).find(Boolean) || '';
      if (phone) {
        capturedPhones.push(phone);
      }
    };

    page.on('response', (response) => {
      void capturePhoneResponse(response);
    });

    const revealPhone = async () => {
      const showPhoneButton = page.locator('[data-testid="show-phone"]').last();
      if ((await showPhoneButton.count()) === 0) {
        return;
      }

      const phoneResponsePromise = page
        .waitForResponse((response) => /\/limited-phones(?:[/?#]|$)/i.test(response.url()), { timeout: 8000 })
        .then(async (response) => {
          await capturePhoneResponse(response);
        })
        .catch(() => undefined);

      await showPhoneButton.click({ force: true, timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(1200).catch(() => undefined);
      const callButton = page.locator('[data-testid="ad-contact-phone"]').last();
      if ((await callButton.count()) > 0) {
        await callButton.click({ force: true, timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(800).catch(() => undefined);
      }
      await phoneResponsePromise;
    };

    await revealPhone();

    const networkPhone = capturedPhones.find(Boolean) || '';
    if (networkPhone) {
      return networkPhone;
    }

    const phoneFromDom = await page.evaluate(() => {
      const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

      const telSources = Array.from(document.querySelectorAll('a[href^="tel:"]'))
        .map((node) => node.getAttribute('href') || '')
        .map((href) => href.replace(/^tel:/i, ''));
      for (const value of telSources) {
        if (value) {
          return value;
        }
      }

      const contactNodes = Array.from(document.querySelectorAll('[data-testid="contact-phone"], [data-testid="ad-contact-phone"]'))
        .map((node) => clean(node.textContent || ''))
        .filter(Boolean);
      for (const value of contactNodes) {
        if (/\d/.test(value)) {
          return value;
        }
      }

      return clean(document.body.innerText || '');
    });

    return extractPhoneFromText(phoneFromDom || (await page.content()));
  }).catch(() => '');
}

async function resolveOlxPhone(url: string, html = '') {
  const adId = extractOlxAdId(url) || extractOlxAdId(html);
  const frictionToken = html ? extractOlxFrictionTokenFromHtml(html) : '';
  const apiPhone = adId ? await fetchOlxPhoneByAdId(adId, frictionToken).catch(() => '') : '';
  if (apiPhone) {
    return apiPhone;
  }

  const remoteBrowserPhone = adId ? await fetchOlxPhoneViaRemoteBrowser(url, adId).catch(() => '') : '';
  if (remoteBrowserPhone) {
    return remoteBrowserPhone;
  }

  const htmlPhone = html ? extractOlxPhoneFromHtml(html) : '';
  if (htmlPhone) {
    return htmlPhone;
  }

  return extractOlxPhoneFromDom(url).catch(() => '');
}

export async function scrapeOlxPhoneNumber(url: string) {
  const html = await fetchScraperHtml(url, 30000).catch(() => '');
  return resolveOlxPhone(url, html).catch(() => '');
}

export async function scrapeOlxListingsPage(
  options: SourceScrapeOptions,
  pageNumber = Math.max(1, options.startPage ?? 1)
): Promise<OwnerListingSourcePageResult> {
  const listings: OwnerListingSummary[] = [];
  const seenLinks = new Set<string>();
  let reachedEnd = true;

  for (const baseUrl of options.searchUrls) {
    const pageUrl = new URL(baseUrl);
    if (pageNumber > 1) {
      pageUrl.searchParams.set('page', String(pageNumber));
    }

    const html = await fetchScraperHtml(pageUrl.toString(), 30000).catch(() => '');
    if (!html) {
      continue;
    }

    const cards = extractListPageFromHtml(html);
    if (!cards.length) {
      continue;
    }

    reachedEnd = false;

    for (const card of cards) {
      if (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource) break;
      if (!card.href || !card.title) continue;

      const absoluteUrl = normalizeUrl(card.href, 'https://www.olx.ro');
      if (seenLinks.has(absoluteUrl)) continue;

      let resolvedTitle = card.title;
      let parsed: ParsedOlxCard = parseCard(card.title, card.text);
      parsed.price = card.price || parsed.price;
      if (!matchesKeywords(`${parsed.location} ${card.title} ${card.text}`, options.searchKeywords)) {
        continue;
      }

      const shouldHydrateFromDetail = true;

      if (shouldHydrateFromDetail) {
        const detailHtml = await fetchScraperHtml(absoluteUrl, 15000).catch(() => '');
        if (detailHtml) {
          const detailParams = extractOlxParamsFromHtml(detailHtml);
          const detailTitle = extractOlxTitleFromHtml(detailHtml);
          const detailDescription = extractOlxDescriptionFromHtml(detailHtml);
          const detailBody = `${detailTitle} ${detailDescription} ${stripHtml(detailHtml)}`;
          parsed = {
            ...parsed,
            price: detailParams.price || extractPriceText(detailBody) || parsed.price,
            area: parsed.area || detailParams.area || extractAreaFromOlxBodyText(detailBody),
            location: parsed.location || extractLocationText(detailBody),
            constructionYear: detailParams.constructionYear || parsed.constructionYear,
          };

          if (detailTitle) {
            resolvedTitle = detailTitle;
          }

          card.imageCandidates.push(...extractOlxImagesFromHtml(detailHtml));
        }
      }

      const externalIdMatch = card.href.match(/-(\w+)\.html|ID([A-Za-z0-9]+)/);
      const externalId = externalIdMatch?.[1] || externalIdMatch?.[2] || card.href;

      seenLinks.add(absoluteUrl);
      listings.push(
        buildSummary({
          scopeKey: options.scopeKey,
          scopeCity: options.scopeCity,
          source: 'olx',
          externalId,
          title: resolvedTitle,
          price: parsed.price,
          area: parsed.area,
          rooms: parsed.rooms,
          constructionYear: parsed.constructionYear,
          year: parsed.constructionYear,
          location: parsed.location,
          postedAt: Math.floor(Date.now() / 1000),
          postedAtText: '',
          link: absoluteUrl,
          imageUrl: pickBestImageUrl(card.imageCandidates),
          description: '',
        })
      );
    }
  }

  return { listings, reachedEnd };
}

export async function scrapeOlxListings(options: SourceScrapeOptions) {
  const listings: OwnerListingSummary[] = [];
  const startPage = Math.max(1, options.startPage ?? 1);
  const pageCount = Math.max(1, options.maxPages ?? options.hardPageLimit ?? 250);

  for (let pageNumber = startPage; pageNumber < startPage + pageCount; pageNumber += 1) {
    const pageResult = await scrapeOlxListingsPage(options, pageNumber);
    listings.push(...pageResult.listings);
    if (pageResult.reachedEnd || (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource)) {
      break;
    }
  }

  return listings;
}

export async function scrapeOlxListingDetail(url: string) {
  const html = await fetchScraperHtml(url, 30000).catch(() => '');

  let title = '';
  let description = '';
  let detailParams = {
    area: '',
    rooms: '',
    constructionYear: undefined as string | number | undefined,
    price: '',
  };
  let images: string[] = [];

  if (html) {
    title = extractOlxTitleFromHtml(html);
    description = extractOlxDescriptionFromHtml(html);
    detailParams = extractOlxParamsFromHtml(html);
    images = extractOlxImagesFromHtml(html);
  }

  const parsed = parseCard(title, description);
  let domParams:
    | {
        area: string;
        rooms: string;
        constructionYear?: string | number;
        price: string;
        imageUrl: string;
        images: string[];
      }
    | null = null;

  if (!title || !detailParams.area || !detailParams.price || !images.length) {
    domParams = await extractOlxParamsFromDom(url).catch(() => null);
  }
  const summary = buildSummary({
    source: 'olx',
    externalId: url.match(/-(\w+)\.html|ID([A-Za-z0-9]+)/)?.[1] || url.match(/ID([A-Za-z0-9]+)/)?.[1] || url,
    title,
    price: detailParams.price || parsed.price || domParams?.price || '',
    area: detailParams.area || parsed.area || domParams?.area || '',
    rooms: detailParams.rooms || parsed.rooms || domParams?.rooms || '',
    constructionYear: detailParams.constructionYear || parsed.constructionYear || domParams?.constructionYear,
    year: detailParams.constructionYear || parsed.constructionYear || domParams?.constructionYear,
    location: parsed.location,
    postedAt: Math.floor(Date.now() / 1000),
    link: url,
    imageUrl: pickBestImageUrl([...images, domParams?.imageUrl || '']),
    description,
  });

  return {
    ...summary,
    images: sortImageUrls(
      [...images, ...(domParams?.images || [])]
        .map((image) => pickBestImageUrl([image]))
        .filter(Boolean)
    ).slice(0, 12),
    fullDescription: description,
    contactName: '',
    contactPhone: '',
  } satisfies OwnerListingDetail;
}
