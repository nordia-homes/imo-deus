import {
  buildSummary,
  extractConstructionYear,
  normalizeUrl,
  normalizeWhitespace,
} from '@/lib/owner-listings/utils';
import type { OwnerListingDetail, OwnerListingSummary, SourceScrapeOptions } from '@/lib/owner-listings/types';
import { fetchScraperHtml, waitForScraperReady, withScraperPage } from '@/lib/owner-listings/browser';

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
    return html.slice(articleStart, articleEnd + '</article>'.length);
  }

  const snippetStart = Math.max(0, index - 2500);
  const snippetEnd = Math.min(html.length, nextIndex + 2500);
  return html.slice(snippetStart, snippetEnd);
}

function extractImageCandidatesFromChunk(chunk: string) {
  return Array.from(
    chunk.matchAll(/(?:src|data-src|data-image-src|srcset|data-srcset|data-image-srcset)="([^"]+)"/gi)
  ).map((match) => decodeOlxEscaped(match[1]));
}

function extractListPageFromHtml(html: string) {
  const hrefMatches = Array.from(html.matchAll(/href="([^"]*\/d\/oferta\/[^"]+)"/gi));
  const cards: Array<{ href: string; title: string; text: string; imageCandidates: string[] }> = [];
  const seen = new Set<string>();

  for (let index = 0; index < hrefMatches.length; index += 1) {
    const href = hrefMatches[index]?.[1] || '';
    if (!href || seen.has(href)) continue;

    const currentIndex = hrefMatches[index]?.index ?? 0;
    const nextIndex = hrefMatches[index + 1]?.index ?? Math.min(html.length, currentIndex + 8000);
    const chunk = extractCardChunk(html, currentIndex, nextIndex);
    const title =
      decodeOlxEscaped(chunk.match(/\stitle="([^"]+)"/i)?.[1] || '') ||
      decodeOlxEscaped(chunk.match(/aria-label="([^"]+)"/i)?.[1] || '') ||
      stripHtml(chunk.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || '') ||
      '';
    const text = stripHtml(chunk);
    const imageCandidates = extractImageCandidatesFromChunk(chunk);

    if (!title) continue;

    seen.add(href);
    cards.push({ href, title, text, imageCandidates });
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

  return {
    area: extractAreaTextFromLabeledValue(areaSource) || extractAreaFromOlxBodyText(bodyText),
    rooms: extractRoomCount(roomsSource) || extractRoomCount(bodyText),
    constructionYear: extractConstructionYear(yearSource) || extractConstructionYear(bodyText),
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
      constructionYear: extractConstructionYear(params.constructionYear) || extractConstructionYear(params.bodyText),
      price: extractPriceText(params.price),
      imageUrl: pickBestImageUrl(params.images),
      images: sortImageUrls(params.images.map((image) => pickBestImageUrl([image])).filter(Boolean)).slice(0, 12),
    };
  });
}

export async function scrapeOlxListings(options: SourceScrapeOptions) {
  const listings: OwnerListingSummary[] = [];
  const seenLinks = new Set<string>();
  const hardPageLimit = options.maxPages ?? options.hardPageLimit ?? 250;

  for (const baseUrl of options.searchUrls) {
    for (let pageNumber = 1; pageNumber <= hardPageLimit; pageNumber += 1) {
      const pageUrl = new URL(baseUrl);
      if (pageNumber > 1) {
        pageUrl.searchParams.set('page', String(pageNumber));
      }

      const html = await fetchScraperHtml(pageUrl.toString(), 30000).catch(() => '');
      if (!html) break;

      const cards = extractListPageFromHtml(html);
      if (!cards.length) break;

      for (const card of cards) {
        if (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource) break;
        if (!card.href || !card.title) continue;

        const absoluteUrl = normalizeUrl(card.href, 'https://www.olx.ro');
        if (seenLinks.has(absoluteUrl)) continue;

        let resolvedTitle = card.title;
        let parsed = parseCard(card.title, card.text);
        if (!matchesKeywords(`${parsed.location} ${card.title} ${card.text}`, options.searchKeywords)) {
          continue;
        }

        const listImageUrl = pickBestImageUrl(card.imageCandidates);
        const shouldHydrateFromDetail =
          !parsed.area ||
          !listImageUrl ||
          /;s=\d{2,4}x\d{2,4}/i.test(listImageUrl) ||
          /^salveaza\s+ca\s+favorit/i.test(normalizeComparableText(resolvedTitle));

        if (shouldHydrateFromDetail) {
          const detailHtml = await fetchScraperHtml(absoluteUrl, 15000).catch(() => '');
          if (detailHtml) {
            const detailParams = extractOlxParamsFromHtml(detailHtml);
            const detailTitle = extractOlxTitleFromHtml(detailHtml);
            const detailDescription = extractOlxDescriptionFromHtml(detailHtml);
            const detailBody = `${detailTitle} ${detailDescription} ${stripHtml(detailHtml)}`;
            parsed = {
              ...parsed,
              price: parsed.price || detailParams.price || extractPriceText(detailBody),
              area: parsed.area || detailParams.area || extractAreaFromOlxBodyText(detailBody),
              location: parsed.location || extractLocationText(detailBody),
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

      if (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource) {
        break;
      }
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
    constructionYear: undefined as number | undefined,
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
        constructionYear?: number;
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
