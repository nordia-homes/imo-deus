import { chromium, type Page } from 'playwright';
import { buildSummary, extractAreaText, extractConstructionYear, normalizeUrl, normalizeWhitespace, parseRomanianDateToUnix } from '@/lib/owner-listings/utils';
import type { OwnerListingDetail, OwnerListingSourcePageResult, OwnerListingSummary, SourceScrapeOptions } from '@/lib/owner-listings/types';
import { fetchScraperHtml, waitForScraperReady, withScraperPage } from '@/lib/owner-listings/browser';

const publi24PhoneCache = new Map<string, string>();

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

function extractPubli24PhoneRequest(html: string, url: string) {
  const formAction = normalizeWhitespace(html.match(/<form action="([^"]*PhoneNumberImages[^"]*)"/i)?.[1] || '');
  const encryptedPhone = normalizeWhitespace(html.match(/name="EncryptedPhone"[^>]*value="([^"]+)"/i)?.[1] || '');
  const hintedLength = Number(formAction.match(/Length=(\d+)/i)?.[1] || '');

  if (!formAction || !encryptedPhone) {
    return null;
  }

  return {
    cacheKey: `${formAction}|${encryptedPhone}`,
    endpointUrl: normalizeUrl(formAction, url),
    encryptedPhone,
    hintedLength: Number.isFinite(hintedLength) && hintedLength > 0 ? hintedLength : null,
  };
}

async function fetchPubli24PhoneImageBase64(html: string, url: string) {
  const request = extractPubli24PhoneRequest(html, url);
  if (!request) {
    return null;
  }

  const cached = publi24PhoneCache.get(request.cacheKey);
  if (cached) {
    return { ...request, base64: cached };
  }

  const response = await fetch(request.endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
      Origin: 'https://www.publi24.ro',
      Referer: url,
    },
    body: new URLSearchParams({ EncryptedPhone: request.encryptedPhone }).toString(),
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const base64 = normalizeWhitespace(await response.text().catch(() => ''));
  if (!/^[A-Za-z0-9+/=]+$/.test(base64) || base64.length < 200) {
    return null;
  }

  publi24PhoneCache.set(request.cacheKey, base64);
  return { ...request, base64 };
}

async function recognizePubli24PhoneFromBase64(base64: string, hintedLength?: number | null) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });

  try {
    const context = await browser.newContext({
      locale: 'ro-RO',
      timezoneId: 'Europe/Bucharest',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 800, height: 600 },
    });
    const page = await context.newPage();
    await page.setContent('<html><body></body></html>');

    const result = await page.evaluate(
      async ({ imageBase64, hintedLength }) => {
        function toBinaryFromCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, threshold = 245) {
          const { data } = ctx.getImageData(0, 0, width, height);
          const bin = Array.from({ length: height }, () => Array(width).fill(0));

          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const index = (y * width + x) * 4;
              const luminance = (data[index] + data[index + 1] + data[index + 2]) / 3;
              bin[y][x] = luminance < threshold && data[index + 3] > 20 ? 1 : 0;
            }
          }

          return bin;
        }

        function cropBounds(bin: number[][]) {
          const height = bin.length;
          const width = bin[0]?.length || 0;
          let top = 0;
          let bottom = height - 1;
          let left = 0;
          let right = width - 1;

          const rowInk = (y: number) => bin[y]?.reduce((sum, pixel) => sum + pixel, 0) || 0;
          const colInk = (x: number) => bin.reduce((sum, row) => sum + (row[x] || 0), 0);

          while (top < height && rowInk(top) === 0) top += 1;
          while (bottom > top && rowInk(bottom) === 0) bottom -= 1;
          while (left < width && colInk(left) === 0) left += 1;
          while (right > left && colInk(right) === 0) right -= 1;

          return { top, bottom, left, right };
        }

        function sliceBin(bin: number[][], bounds: { top: number; bottom: number; left: number; right: number }) {
          const out: number[][] = [];
          for (let y = bounds.top; y <= bounds.bottom; y += 1) {
            out.push(bin[y].slice(bounds.left, bounds.right + 1));
          }
          return out;
        }

        function resizeBin(bin: number[][], targetWidth = 20, targetHeight = 28) {
          const srcHeight = bin.length;
          const srcWidth = bin[0]?.length || 0;
          if (!srcHeight || !srcWidth) {
            return Array.from({ length: targetHeight }, () => Array(targetWidth).fill(0));
          }

          const out = Array.from({ length: targetHeight }, () => Array(targetWidth).fill(0));
          for (let y = 0; y < targetHeight; y += 1) {
            for (let x = 0; x < targetWidth; x += 1) {
              const srcX = Math.min(srcWidth - 1, Math.floor((x * srcWidth) / targetWidth));
              const srcY = Math.min(srcHeight - 1, Math.floor((y * srcHeight) / targetHeight));
              out[y][x] = bin[srcY][srcX];
            }
          }

          return out;
        }

        function diffBin(left: number[][], right: number[][]) {
          let diff = 0;
          for (let y = 0; y < left.length; y += 1) {
            for (let x = 0; x < left[0].length; x += 1) {
              if (left[y][x] !== right[y][x]) diff += 1;
            }
          }
          return diff;
        }

        function buildTemplates() {
          const templates: Array<{ digit: string; bin: number[][] }> = [];
          const fonts = ['Arial', 'Helvetica', 'Verdana', 'Tahoma', 'sans-serif'];
          const sizes = [22, 24, 26, 28, 30, 32];
          const weights = ['normal', 'bold'];

          for (const font of fonts) {
            for (const size of sizes) {
              for (const weight of weights) {
                for (let digit = 0; digit <= 9; digit += 1) {
                  const canvas = document.createElement('canvas');
                  canvas.width = 26;
                  canvas.height = 34;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) continue;

                  ctx.fillStyle = 'white';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.fillStyle = 'black';
                  ctx.font = `${weight} ${size}px ${font}`;
                  ctx.textBaseline = 'middle';
                  ctx.textAlign = 'center';
                  ctx.fillText(String(digit), canvas.width / 2, canvas.height / 2 + 1);

                  const binary = toBinaryFromCanvas(ctx, canvas.width, canvas.height);
                  const bounds = cropBounds(binary);
                  templates.push({
                    digit: String(digit),
                    bin: resizeBin(sliceBin(binary, bounds)),
                  });
                }
              }
            }
          }

          return templates;
        }

        function classifySegment(segment: number[][], templates: Array<{ digit: string; bin: number[][] }>) {
          const bounds = cropBounds(segment);
          const normalized = resizeBin(sliceBin(segment, bounds));
          let bestDigit = '?';
          let bestScore = Number.POSITIVE_INFINITY;

          for (const template of templates) {
            const score = diffBin(normalized, template.bin);
            if (score < bestScore) {
              bestScore = score;
              bestDigit = template.digit;
            }
          }

          return { digit: bestDigit, score: bestScore };
        }

        function scorePhoneCandidate(phone: string, averageTemplateScore: number) {
          let penalty = 0;

          if (!/^\d+$/.test(phone)) {
            penalty += 500;
          }

          if (/^07\d{8}$/.test(phone)) {
            penalty -= 35;
          } else if (/^0(?:2|3)\d{8}$/.test(phone)) {
            penalty -= 25;
          } else if (/^0\d{9}$/.test(phone)) {
            penalty -= 12;
          } else if (/^\d{8}$/.test(phone)) {
            penalty += 16;
          } else if (/^\d{9}$/.test(phone)) {
            penalty += 12;
          } else if (/^\d{11,}$/.test(phone)) {
            penalty += 40;
          }

          if (/(\d)\1{4,}/.test(phone)) {
            penalty += 22;
          }

          return averageTemplateScore + penalty;
        }

        const image = new Image();
        image.src = `data:image/png;base64,${imageBase64}`;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return '';
        }

        ctx.drawImage(image, 0, 0);
        const binary = toBinaryFromCanvas(ctx, canvas.width, canvas.height);
        const cropped = sliceBin(binary, cropBounds(binary));
        const croppedWidth = cropped[0]?.length || 0;
        if (!cropped.length || !croppedWidth) {
          return '';
        }

        const colInk = Array.from({ length: croppedWidth }, (_, x) => cropped.reduce((sum, row) => sum + row[x], 0));
        const templates = buildTemplates();
        const candidateCounts = Array.from(new Set([10, hintedLength || 0, 9, 8, 11].filter((value) => value >= 8 && value <= 11)));

        let bestPhone = '';
        let bestPhoneScore = Number.POSITIVE_INFINITY;

        for (const count of candidateCounts) {
          const averageWidth = croppedWidth / count;
          const boundaries = [0];

          for (let index = 1; index < count; index += 1) {
            const center = Math.round(index * averageWidth);
            let bestBoundary = center;
            let bestBoundaryScore = Number.POSITIVE_INFINITY;

            for (
              let x = Math.max(boundaries[index - 1] + 6, center - 6);
              x <= Math.min(croppedWidth - 6, center + 6);
              x += 1
            ) {
              const score = colInk[x] + Math.abs(x - boundaries[index - 1] - averageWidth) * 0.7;
              if (score < bestBoundaryScore) {
                bestBoundaryScore = score;
                bestBoundary = x;
              }
            }

            boundaries.push(bestBoundary);
          }

          boundaries.push(croppedWidth);

          const digits: string[] = [];
          let totalTemplateScore = 0;

          for (let index = 0; index < count; index += 1) {
            const start = boundaries[index];
            const end = boundaries[index + 1];
            const segment = cropped.map((row) => row.slice(start, end));
            const guess = classifySegment(segment, templates);
            digits.push(guess.digit);
            totalTemplateScore += guess.score;
          }

          const phoneCandidate = digits.join('');
          const candidateScore = scorePhoneCandidate(phoneCandidate, totalTemplateScore / count);
          if (candidateScore < bestPhoneScore) {
            bestPhoneScore = candidateScore;
            bestPhone = phoneCandidate;
          }
        }

        return bestPhone;
      },
      { imageBase64: base64, hintedLength: hintedLength || 0 }
    );

    await context.close();
    return result;
  } catch {
    return '';
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function extractPubli24PhoneFromHtml(html: string, url: string) {
  const phonePayload = await fetchPubli24PhoneImageBase64(html, url);
  if (!phonePayload?.base64) {
    return '';
  }

  const recognized = normalizeWhitespace(await recognizePubli24PhoneFromBase64(phonePayload.base64, phonePayload.hintedLength));
  const digits = recognized.replace(/[^\d]/g, '');

  if (/^0\d{9}$/.test(digits) || /^\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^7\d{8}$/.test(digits)) {
    return `0${digits}`;
  }

  return '';
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
  ownerPhone?: string;
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

export async function scrapePubli24ListingsPage(
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

    const structuredOffers = extractStructuredOffersFromHtml(html);
    if (!structuredOffers.length) {
      continue;
    }

    reachedEnd = false;

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
          const ownerPhone = await extractPubli24PhoneFromHtml(detailHtml, absoluteUrl).catch(() => '');
          enrichedOffer = {
            ...enrichedOffer,
            title: detail.title || enrichedOffer.title,
            description: detail.description || enrichedOffer.description,
            price: enrichedOffer.price || detail.price,
            area: enrichedOffer.area || detail.area,
            rooms: enrichedOffer.rooms || detail.rooms,
            imageUrl: enrichedOffer.imageUrl || detail.images[0] || '',
            constructionYear: enrichedOffer.constructionYear || detail.constructionYear,
            ownerPhone,
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
          ownerPhone: normalizeWhitespace(enrichedOffer.ownerPhone),
        })
      );
    }
  }

  return { listings, reachedEnd };
}

export async function scrapePubli24Listings(options: SourceScrapeOptions) {
  const listings: OwnerListingSummary[] = [];
  const startPage = Math.max(1, options.startPage ?? 1);
  const pageCount = Math.max(1, options.maxPages ?? options.hardPageLimit ?? 250);

  for (let pageNumber = startPage; pageNumber < startPage + pageCount; pageNumber += 1) {
    const pageResult = await scrapePubli24ListingsPage(options, pageNumber);
    listings.push(...pageResult.listings);
    if (pageResult.reachedEnd || (options.maxListingsPerSource && listings.length >= options.maxListingsPerSource)) {
      break;
    }
  }

  return listings;
}

export async function scrapePubli24ListingDetail(url: string) {
  const html = await fetchScraperHtml(url, 30000).catch(() => '');
  if (html) {
    const detail = extractPubli24DetailFromHtml(html, url);
    const contactPhone = await extractPubli24PhoneFromHtml(html, url).catch(() => '');
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
        .map((img) => img.getAttribute('src') || img.getAttribute('data-src') || '')
        .filter((src) => src.startsWith('http'));
      return { bodyText, title, description, images };
    });
    const contactPhone = await extractPubli24PhoneFromHtml(await page.content(), url).catch(() => '');

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
      ownerPhone: contactPhone,
    });

    return {
      ...summary,
      images: Array.from(new Set(payload.images)).slice(0, 12),
      fullDescription: payload.description,
      contactName: '',
      contactPhone,
    } satisfies OwnerListingDetail;
  });
}
