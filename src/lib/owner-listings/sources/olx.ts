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

async function extractListPage(page: Page) {
  return page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('a[href*="/d/oferta/"]'));
    return candidates.map((anchor) => {
      const card = anchor.closest('article') || anchor.closest('[data-cy="l-card"]') || anchor.parentElement;
      const text = card?.textContent || anchor.textContent || '';
      const image = card?.querySelector('img')?.getAttribute('src') || card?.querySelector('img')?.getAttribute('data-src') || '';
      const title =
        anchor.getAttribute('title') ||
        card?.querySelector('h4, h6')?.textContent ||
        anchor.textContent ||
        '';

      return {
        href: anchor.getAttribute('href') || '',
        title,
        text,
        image,
      };
    });
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
  const articles = extractArticleBlocks(html);
  if (articles.length) {
    return articles
      .map((article) => {
        const href = article.match(/href="([^"]*\/d\/oferta\/[^"]+)"/i)?.[1] || '';
        const titleAttr = article.match(/\stitle="([^"]+)"/i)?.[1] || '';
        const heading =
          article.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ||
          article.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
          '';

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
    html.matchAll(/<a[^>]+href="(?<href>[^"]*\/d\/oferta\/[^"]+)"[^>]*>(?<inner>[\s\S]*?)<\/a>/gi)
  );

  return matches.map((match) => {
    const inner = match.groups?.inner || '';
    const titleAttr = match[0].match(/\stitle="([^"]+)"/i)?.[1] || '';
    const heading =
      inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ||
      inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      '';

    return {
      href: match.groups?.href || '',
      title: stripHtml(titleAttr || heading || inner),
      text: stripHtml(inner),
      image: match[0].match(/<img[^>]+(?:src|data-src)="([^"]+)"/i)?.[1] || '',
    };
  });
}

type StructuredOffer = {
  url: string;
  title: string;
  price: string;
  location: string;
  imageUrl: string;
};

function collectStructuredOffers(node: unknown, target: StructuredOffer[]) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    node.forEach((item) => collectStructuredOffers(item, target));
    return;
  }

  const record = node as Record<string, unknown>;
  if (record['@type'] === 'Offer' && typeof record.url === 'string' && record.url.includes('/d/oferta/')) {
    const currency = typeof record.priceCurrency === 'string' ? record.priceCurrency : '';
    const rawPrice = typeof record.price === 'number' || typeof record.price === 'string' ? String(record.price) : '';
    const location =
      typeof record.areaServed === 'object' && record.areaServed && typeof (record.areaServed as Record<string, unknown>).name === 'string'
        ? ((record.areaServed as Record<string, unknown>).name as string)
        : '';
    const imageUrl = Array.isArray(record.image)
      ? (record.image.find((item) => typeof item === 'string') as string | undefined) || ''
      : typeof record.image === 'string'
        ? record.image
        : '';

    target.push({
      url: record.url,
      title: typeof record.name === 'string' ? record.name : '',
      price: rawPrice ? `${rawPrice} ${currency}`.trim() : '',
      location,
      imageUrl,
    });
  }

  Object.values(record).forEach((value) => collectStructuredOffers(value, target));
}

function extractStructuredOffersFromHtml(html: string) {
  const offers: StructuredOffer[] = [];
  const scripts = Array.from(html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi));

  for (const script of scripts) {
    const payload = script[1]?.trim();
    if (!payload) continue;
    try {
      collectStructuredOffers(JSON.parse(payload), offers);
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }

  return offers;
}

function parseCardText(text: string) {
  const normalized = normalizeWhitespace(text);
  const lines = normalized
    .split(/[•|]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  const price = lines.find((line) => /€|eur|lei|ron/i.test(line)) || '';
  const area = lines.find((line) => /\bmp\b|m²/i.test(line)) || '';
  const rooms = lines.find((line) => /\bcamera|\bcamere/i.test(line)) || '';
  const location = lines.find((line) => /azi|ieri|reactualizat|\d{1,2}\s+[a-zăâîșţț]+/i.test(line)) || lines[lines.length - 1] || '';
  return { price, area, rooms, location };
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

      const html = await fetchScraperHtml(pageUrl.toString(), 30000);
      const structuredOffers = extractStructuredOffersFromHtml(html);

      if (structuredOffers.length > 0) {
        for (const offer of structuredOffers) {
          if (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource) break;

          const absoluteUrl = normalizeUrl(offer.url, 'https://www.olx.ro');
          if (seenLinks.has(absoluteUrl)) continue;
          if (!matchesKeywords(`${offer.location} ${offer.title}`, options.searchKeywords)) {
            continue;
          }

          const externalIdMatch = absoluteUrl.match(/-(\w+)\.html|ID([A-Za-z0-9]+)/);
          const externalId = externalIdMatch?.[1] || externalIdMatch?.[2] || absoluteUrl;

          seenLinks.add(absoluteUrl);
          listings.push(
            buildSummary({
              scopeKey: options.scopeKey,
              scopeCity: options.scopeCity,
              source: 'olx',
              externalId,
              title: offer.title,
              price: offer.price,
              area: '',
              rooms: '',
              location: offer.location,
              postedAt: Math.floor(Date.now() / 1000),
              postedAtText: '',
              link: absoluteUrl,
              imageUrl: offer.imageUrl,
              description: `${offer.title} ${offer.location}`.trim(),
            })
          );
        }

        continue;
      }

      const cards = extractListPageFromHtml(html);
      if (!cards.length) break;

      for (const card of cards) {
        if (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource) break;
        if (!card.href || !card.title) continue;

        const absoluteUrl = normalizeUrl(card.href, 'https://www.olx.ro');
        if (seenLinks.has(absoluteUrl)) continue;

        const parsed = parseCardText(card.text);
        const combinedLocationText = `${parsed.location} ${card.text}`;
        if (!matchesKeywords(combinedLocationText, options.searchKeywords)) {
          continue;
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
}

export async function scrapeOlxListingDetail(url: string) {
  return withScraperPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScraperReady(page, ['h1', '[data-testid="ad-price-container"]', 'meta[property="og:title"]'], 10000);

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
      const price =
        document.querySelector('[data-testid="ad-price-container"]')?.textContent ||
        Array.from(document.querySelectorAll('*'))
          .map((node) => node.textContent || '')
          .find((value) => /€|eur|lei|ron/i.test(value) && /\d/.test(value)) ||
        '';
      const images = Array.from(document.querySelectorAll('img'))
        .map((img) => img.getAttribute('src') || img.getAttribute('data-src') || '')
        .filter((src) => src.startsWith('http'));

      return {
        bodyText,
        title,
        description,
        price,
        images,
      };
    });

    const summary = buildSummary({
      source: 'olx',
      externalId: url.match(/-(\w+)\.html|ID([A-Za-z0-9]+)/)?.[1] || url.match(/ID([A-Za-z0-9]+)/)?.[1] || url,
      title: payload.title,
      price: payload.price,
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
