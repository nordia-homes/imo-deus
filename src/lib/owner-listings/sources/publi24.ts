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
      area: extractAreaText(`${typeof record.name === 'string' ? record.name : ''} ${typeof record.description === 'string' ? record.description : ''}`),
      constructionYear: extractConstructionYear(`${typeof record.name === 'string' ? record.name : ''} ${typeof record.description === 'string' ? record.description : ''}`),
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
      area: extractAreaText(`${title} ${description}`),
      constructionYear: extractConstructionYear(`${title} ${description}`),
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

        const idMatch = absoluteUrl.match(/\/([a-z0-9]+)\.html/i);
        seenLinks.add(absoluteUrl);
        listings.push(
          buildSummary({
            scopeKey: options.scopeKey,
            scopeCity: options.scopeCity,
            source: 'publi24',
            externalId: idMatch?.[1] || absoluteUrl,
            title: offer.title,
            price: offer.price,
            area: offer.area,
            rooms: '',
            constructionYear: offer.constructionYear,
            year: offer.constructionYear,
            location: offer.location,
            postedAt: Math.floor(Date.now() / 1000),
            postedAtText: '',
            link: absoluteUrl,
            imageUrl: offer.imageUrl,
            description: normalizeWhitespace(offer.description).slice(0, 500),
          })
        );
      }
    }
  }

  return listings;
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

    const summary = buildSummary({
      source: 'publi24',
      externalId: url.match(/\/([a-z0-9]+)\.html/i)?.[1] || url,
      title: payload.title,
      price: '',
      area: extractAreaText(payload.description),
      constructionYear: extractConstructionYear(`${payload.title} ${payload.description}`),
      year: extractConstructionYear(`${payload.title} ${payload.description}`),
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
