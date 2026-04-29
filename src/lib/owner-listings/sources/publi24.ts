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

function extractRoomCount(text: string) {
  const normalized = normalizeWhitespace(text);
  return (
    normalized.match(/\b(\d+)\s+camere?\b/i)?.[0] ||
    normalized.match(/\bapartament\s+cu\s+(\d+)\s+camere?\b/i)?.[0] ||
    normalized.match(/\b(\d+)\s+camera\b/i)?.[0] ||
    (/\bgarsoniera\b/i.test(normalized) ? '1 camera' : '') ||
    (/\bstudio\b/i.test(normalized) ? '1 camera' : '') ||
    ''
  );
}

function extractRoomCountFromUrl(url: string) {
  const normalized = normalizeWhitespace(url).toLowerCase();
  const directMatch =
    normalized.match(/apartamente-(\d+)-camere/i)?.[1] ||
    normalized.match(/apartamente-(\d+)-camera/i)?.[1] ||
    normalized.match(/(\d+)-camere/i)?.[1] ||
    normalized.match(/(\d+)-camera/i)?.[1] ||
    '';

  if (directMatch) {
    return `${directMatch} ${Number(directMatch) === 1 ? 'camera' : 'camere'}`;
  }

  if (/(?:\/|-)garsoniera(?:\/|-|$)/i.test(normalized) || /(?:\/|-)studio(?:\/|-|$)/i.test(normalized)) {
    return '1 camera';
  }

  return '';
}

function extractAreaTextFlexible(text: string) {
  const strictArea = extractAreaText(text);
  if (strictArea) {
    return strictArea;
  }

  const normalized = normalizeWhitespace(text)
    .replace(/\bm\s*2\b/gi, 'm2')
    .replace(/\bm\s*²\b/gi, 'm2')
    .replace(/\s+/g, ' ');

  const labeledMatch = normalized.match(
    /\bsuprafata(?:\s+(?:utila|totala))?(?:\s+de)?\s*:?\s*([1-9]\d{1,2}(?:[.,]\d{1,2})?)\s*(?:mp|m2)\b/i
  );
  if (labeledMatch?.[1]) {
    return `${labeledMatch[1].replace('.', ',')} mp`;
  }

  const genericMatch = normalized.match(/\b([1-9]\d{1,2}(?:[.,]\d{1,2})?)\s*(?:mp|m2)\b/i);
  if (genericMatch?.[1]) {
    return `${genericMatch[1].replace('.', ',')} mp`;
  }

  return '';
}

function extractPubli24BodyText(html: string) {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u00a0/g, ' ')
  )
    .replace(/\bm\s+2\b/gi, 'm2')
    .replace(/\bm\s+²\b/gi, 'm2');
}

function extractRoomCountFlexible(text: string, url?: string) {
  return extractRoomCount(text) || extractRoomCountFromUrl(url || '');
}

function extractPubli24AreaAndRooms(text: string, url?: string) {
  return {
    area: extractAreaTextFlexible(text),
    rooms: extractRoomCountFlexible(text, url),
  };
}

function extractConstructionYearFlexible(text: string) {
  const normalized = normalizeWhitespace(text);
  const inferred =
    extractConstructionYear(normalized) ||
    extractConstructionYear(normalized.replace(/\banul\s+cons\b/gi, 'anul constructiei')) ||
    undefined;

  if (inferred) {
    return inferred;
  }

  const directMatch =
    normalized.match(/\ban(?:ul)?\s+construct(?:iei|ie|ii)?\s*:?\s*(19\d{2}|20\d{2})\b/i)?.[1] ||
    normalized.match(/\bbloc\s*(?:din|finalizat\s+in|construit\s+in)?\s*(19\d{2}|20\d{2})\b/i)?.[1] ||
    normalized.match(/\bedificat\s+in\s*(19\d{2}|20\d{2})\b/i)?.[1] ||
    '';

  if (!directMatch) {
    return undefined;
  }

  const parsed = Number(directMatch);
  const currentYear = new Date().getFullYear() + 1;
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= currentYear ? parsed : undefined;
}

function extractPubli24DetailFromHtml(html: string, url: string) {
  const bodyText = extractPubli24BodyText(html);
  const title =
    normalizeWhitespace(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') ||
    normalizeWhitespace(html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] || '') ||
    '';
  const description =
    normalizeWhitespace(html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || '') ||
    normalizeWhitespace(html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] || '') ||
    '';
  const price =
    normalizeWhitespace(html.match(/(\d[\d.\s]*)\s*(?:EUR|RON|LEI|€)/i)?.[0] || '') ||
    '';
  const images = Array.from(
    new Set(
      Array.from(html.matchAll(/<img[^>]+(?:src|data-src)="([^"]+)"/gi))
        .map((match) => normalizeWhitespace(match[1]))
        .filter((imageUrl) => imageUrl.startsWith('http'))
    )
  );
  const inferred = extractPubli24AreaAndRooms(`${title} ${description} ${bodyText}`, url);

  return {
    title,
    description,
    bodyText,
    price,
    area: inferred.area,
    rooms: inferred.rooms,
    constructionYear: extractConstructionYearFlexible(`${title} ${description} ${bodyText}`),
    images,
  };
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
  const parts = normalized
    .split(/[•|]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  return {
    price: parts.find((line) => /€|eur|lei|ron/i.test(line)) || '',
    area: parts.find((line) => /\bmp\b|m²/i.test(line)) || '',
    rooms: parts.find((line) => /\bcamera|\bcamere/i.test(line)) || '',
    location: parts.find((line) => /valabil din|azi|ieri|\d{1,2}[./-]\d{1,2}[./-]\d{4}/i.test(line)) || parts[0] || '',
  };
}

type StructuredPubli24Offer = {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  price: string;
  location: string;
  area: string;
  rooms: string;
  constructionYear?: number;
};

function collectStructuredOffers(node: unknown, target: StructuredPubli24Offer[]) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    node.forEach((item) => collectStructuredOffers(item, target));
    return;
  }

  const record = node as Record<string, unknown>;
  if (record['@type'] === 'Product' && typeof record.url === 'string') {
    const offers = record.offers as Record<string, unknown> | undefined;
    const address =
      offers &&
      typeof offers.availableAtOrFrom === 'object' &&
      offers.availableAtOrFrom &&
      typeof (offers.availableAtOrFrom as Record<string, unknown>).address === 'object'
        ? ((offers.availableAtOrFrom as Record<string, unknown>).address as Record<string, unknown>)
        : null;

    const locality = typeof address?.addressLocality === 'string' ? address.addressLocality : '';
    const region = typeof address?.addressRegion === 'string' ? address.addressRegion : '';
    const image = Array.isArray(record.image)
      ? (record.image.find((item) => typeof item === 'object' && item && typeof (item as Record<string, unknown>).contentUrl === 'string') as Record<string, unknown> | undefined)?.contentUrl
      : '';

    target.push({
      title: typeof record.name === 'string' ? record.name : '',
      description: typeof record.description === 'string' ? record.description : '',
      url: record.url,
      imageUrl: typeof image === 'string' ? image : '',
      price:
        offers && (typeof offers.price === 'string' || typeof offers.price === 'number')
          ? `${String(offers.price).replace(/\.00$/, '')} ${typeof offers.priceCurrency === 'string' ? offers.priceCurrency : ''}`.trim()
          : '',
      location: [locality, region].filter(Boolean).join(', '),
      area: extractAreaTextFlexible(`${typeof record.name === 'string' ? record.name : ''} ${typeof record.description === 'string' ? record.description : ''}`),
      rooms: extractRoomCountFlexible(`${typeof record.name === 'string' ? record.name : ''} ${typeof record.description === 'string' ? record.description : ''}`, typeof record.url === 'string' ? record.url : ''),
      constructionYear: extractConstructionYearFlexible(`${typeof record.name === 'string' ? record.name : ''} ${typeof record.description === 'string' ? record.description : ''}`),
    });
  }

  Object.values(record).forEach((value) => collectStructuredOffers(value, target));
}

function extractStructuredOffersFromHtml(html: string) {
  const offers: StructuredPubli24Offer[] = [];
  const script = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)?.[1] || '';
  const chunks = script
    .split(/\{\s*"name"\s*:/g)
    .slice(1)
    .map((chunk) => `{"name":${chunk}`);

  for (const chunk of chunks) {
    const title = chunk.match(/"name"\s*:\s*"([^"]+)"/i)?.[1] || '';
    const description = chunk.match(/"description"\s*:\s*"([\s\S]*?)"\s*,\s*"url"/i)?.[1] || '';
    const url = chunk.match(/"url"\s*:\s*"([^"]+\.html)"/i)?.[1] || '';
    const imageUrl = chunk.match(/"contentUrl"\s*:\s*"([^"]+)"/i)?.[1] || '';
    const price = chunk.match(/"price"\s*:\s*"([^"]+)"/i)?.[1] || '';
    const currency = chunk.match(/"priceCurrency"\s*:\s*"([^"]+)"/i)?.[1] || '';
    const locality = chunk.match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1] || '';
    const region = chunk.match(/"addressRegion"\s*:\s*"([^"]+)"/i)?.[1] || '';

    if (!title || !url) continue;
    offers.push({
      title: normalizeWhitespace(title),
      description: normalizeWhitespace(description.replace(/\\"/g, '"')),
      url,
      imageUrl,
      price: `${price.replace(/\.00$/, '')} ${currency}`.trim(),
      location: `${locality}, ${region}`.trim(),
      area: extractAreaTextFlexible(`${title} ${description}`),
      rooms: extractRoomCountFlexible(`${title} ${description}`, url),
      constructionYear: extractConstructionYearFlexible(`${title} ${description}`),
    });
  }

  return offers;
}

export async function scrapePubli24Listings(options: SourceScrapeOptions) {
  const listings: OwnerListingSummary[] = [];
  const seenLinks = new Set<string>();
  const hardPageLimit = options.maxPages ?? options.hardPageLimit ?? 250;

  for (const baseUrl of options.searchUrls) {
    for (let pageNumber = 1; pageNumber <= hardPageLimit; pageNumber += 1) {
      const pageUrl = new URL(baseUrl);
      if (pageNumber > 1) {
        pageUrl.searchParams.set('page', String(pageNumber));
      }

      const html = await fetchScraperHtml(pageUrl.toString(), 30000);
      const structuredOffers = extractStructuredOffersFromHtml(html);
      if (!structuredOffers.length) break;

      for (const offer of structuredOffers) {
        if (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource) break;
        if (!offer.url || !offer.title) continue;

        const absoluteUrl = normalizeUrl(offer.url, 'https://www.publi24.ro');
        if (seenLinks.has(absoluteUrl)) continue;
        if (!matchesKeywords(`${offer.location} ${offer.title} ${offer.description}`, options.searchKeywords)) {
          continue;
        }

        let enrichedOffer = { ...offer, url: absoluteUrl };
        if (!enrichedOffer.area || !enrichedOffer.rooms || !enrichedOffer.constructionYear) {
          const detailHtml = await fetchScraperHtml(absoluteUrl, 15000).catch(() => '');
          if (detailHtml) {
            const detail = extractPubli24DetailFromHtml(detailHtml, absoluteUrl);
            enrichedOffer = {
              ...enrichedOffer,
              title: detail.title || enrichedOffer.title,
              description: detail.description || enrichedOffer.description,
              price: enrichedOffer.price || detail.price,
              area: enrichedOffer.area || detail.area,
              rooms: enrichedOffer.rooms || detail.rooms,
              imageUrl: enrichedOffer.imageUrl || detail.images[0] || '',
              constructionYear: enrichedOffer.constructionYear || detail.constructionYear,
            };
          }
        }

        const idMatch = absoluteUrl.match(/\/([a-z0-9]+)\.html/i);
        seenLinks.add(absoluteUrl);
        listings.push(
          buildSummary({
            scopeKey: options.scopeKey,
            scopeCity: options.scopeCity,
            source: 'publi24',
            externalId: idMatch?.[1] || absoluteUrl,
            title: enrichedOffer.title,
            price: enrichedOffer.price,
            area: enrichedOffer.area,
            rooms: enrichedOffer.rooms,
            constructionYear: enrichedOffer.constructionYear,
            year: enrichedOffer.constructionYear,
            location: enrichedOffer.location,
            postedAt: Math.floor(Date.now() / 1000),
            postedAtText: '',
            link: absoluteUrl,
            imageUrl: enrichedOffer.imageUrl,
            description: normalizeWhitespace(enrichedOffer.description).slice(0, 500),
          })
        );
      }
    }
  }

  return listings;
}

export async function scrapePubli24ListingDetail(url: string) {
  const html = await fetchScraperHtml(url, 30000).catch(() => '');
  if (html) {
    const detail = extractPubli24DetailFromHtml(html, url);
    const summary = buildSummary({
      source: 'publi24',
      externalId: url.match(/\/([a-z0-9]+)\.html/i)?.[1] || url,
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
      source: 'publi24',
      externalId: url.match(/\/([a-z0-9]+)\.html/i)?.[1] || url,
      title: payload.title,
      price: '',
      area: extractAreaTextFlexible(`${payload.title} ${payload.description} ${payload.bodyText}`),
      rooms: extractRoomCountFlexible(`${payload.title} ${payload.description} ${payload.bodyText}`, url),
      constructionYear: extractConstructionYearFlexible(`${payload.title} ${payload.description} ${payload.bodyText}`),
      year: extractConstructionYearFlexible(`${payload.title} ${payload.description} ${payload.bodyText}`),
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
