import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchScraperResponse } from '@/lib/owner-listings/browser';
import { recognizePubli24PhoneWithoutBrowser } from '@/lib/owner-listings/publi24-phone-ocr';
import { recognizePubli24PhonePure } from '@/lib/owner-listings/publi24-phone-ocr-pure';
import {
  extractImoradar24LastPage,
  extractImoradar24ListPageFromHtml,
  scrapeImoradar24ListingsPage,
} from '@/lib/owner-listings/sources/imoradar24';
import { getOwnerListingCanonicalIdentity } from '@/lib/owner-listings/canonical-identity';
import { extractOlxLastPage, extractOlxListPageFromHtml } from '@/lib/owner-listings/sources/olx';
import {
  extractPubli24LastPage,
  extractPubli24StructuredOffersFromHtml,
  recognizePubli24PhoneViaBrowser,
} from '@/lib/owner-listings/sources/publi24';
import { listOwnerListingScopes } from '@/lib/owner-listings/scope';
import {
  compareOwnerListingEnrichmentPriority,
  parseOptionalNumber,
  parseRomanianDateToUnix,
} from '@/lib/owner-listings/utils';

const fixtures = join(process.cwd(), 'src', 'lib', 'owner-listings', '__tests__', 'fixtures');
const fixture = (name: string) => readFileSync(join(fixtures, name), 'utf8');

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('owner-listing parser contracts', () => {
  it('parses the current Imoradar24 semantic cards and pagination', () => {
    const html = fixture('imoradar24-current.html');
    const cards = extractImoradar24ListPageFromHtml(html);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      href: '/oferta/apartament-de-vanzare-bucuresti-1941638',
      rooms: '2 camere',
      constructionYear: 2018,
      location: 'Bucuresti, Aviatiei',
      originSourceLabel: 'Storia',
      originSourceUrl: 'https://www.storia.ro/',
    });
    expect(cards[1]).toMatchObject({
      href: '/link-extern/1942044',
      originSourceLabel: 'Imobiliare.ro',
      originSourceUrl: 'https://www.imobiliare.ro/',
    });
    expect(extractImoradar24LastPage(html)).toBe(12);
  });

  it('reads the external portal label from the card when GA metadata drifts', () => {
    const cards = extractImoradar24ListPageFromHtml(`
      <article data-listing-id="1952009">
        <a href="https://www.imoradar24.ro/link-extern/1952009">
          <p class="listing-title">Apartament cu 2 camere în Obor</p>
          <span>Vezi anunțul pe Imobiliare.ro</span>
        </a>
        <span class="text-price">110.000 EUR</span>
        <span class="posted-at">Azi</span>
      </article>
    `);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      originSourceLabel: 'Imobiliare.ro',
      originSourceUrl: 'https://www.imobiliare.ro/',
    });
  });

  it('loads Imoradar24 directly and advances beyond a non-expired first page', async () => {
    const html = fixture('imoradar24-current.html');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html, { status: 200 })));

    const result = await scrapeImoradar24ListingsPage({
      scopeKey: 'bucuresti-ilfov',
      scopeCity: 'Bucuresti - Ilfov',
      searchKeywords: [],
      searchUrls: ['https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?sort=latest'],
      maxAgeDays: 60,
      hardPageLimit: 250,
      propertyTypeHint: 'apartment',
      transactionTypeHint: 'sale',
    });

    expect(result.cardsFound).toBe(2);
    expect(result.listings).toHaveLength(2);
    expect(result.reachedEnd).toBe(false);
  });

  it('keeps HTTP rate limits on the direct retry path instead of launching Chromium', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      scrapeImoradar24ListingsPage({
        scopeKey: 'bucuresti-ilfov',
        scopeCity: 'Bucuresti - Ilfov',
        searchKeywords: [],
        searchUrls: ['https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?sort=latest'],
        maxAgeDays: 60,
        hardPageLimit: 250,
        propertyTypeHint: 'apartment',
        transactionTypeHint: 'sale',
      })
    ).rejects.toThrow('Request failed with status 429');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps the final redirect URL even when an external portal returns an HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      url: 'https://www.imobiliare.ro/oferta/apartament-test-123',
      text: async () => 'blocked',
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchScraperResponse('https://www.imoradar24.ro/link-extern/123', 1000, { acceptHttpErrors: true })
    ).resolves.toMatchObject({
      status: 403,
      finalUrl: 'https://www.imobiliare.ro/oferta/apartament-test-123',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not collapse different aggregator listings onto a portal root URL', () => {
    const first = getOwnerListingCanonicalIdentity({
      source: 'imoradar24',
      originSourceUrl: 'https://www.imobiliare.ro/',
      link: 'https://www.imoradar24.ro/link-extern/1',
      dedupeSignature: 'first',
    });
    const second = getOwnerListingCanonicalIdentity({
      source: 'imoradar24',
      originSourceUrl: 'https://www.imobiliare.ro/',
      link: 'https://www.imoradar24.ro/link-extern/2',
      dedupeSignature: 'second',
    });
    const exact = getOwnerListingCanonicalIdentity({
      source: 'imoradar24',
      originSourceUrl: 'https://www.imobiliare.ro/oferta/apartament-test-123',
      link: 'https://www.imoradar24.ro/link-extern/3',
    });

    expect(first).toBe('content:first');
    expect(second).toBe('content:second');
    expect(first).not.toBe(second);
    expect(exact).toBe('url:https://imobiliare.ro/oferta/apartament-test-123');
  });

  it('parses every Publi24 JSON-LD product instead of only the first one', () => {
    const html = fixture('publi24-current.html');
    const offers = extractPubli24StructuredOffersFromHtml(html);

    expect(offers).toHaveLength(2);
    expect(offers.map((offer) => offer.rooms)).toEqual(['3 camere', '5 camere']);
    expect(offers[0]).toMatchObject({ area: '72 mp', constructionYear: 2016 });
    expect(extractPubli24LastPage(html)).toBe(9);
  });

  it('decodes a Publi24 phone image without launching Chromium', async () => {
    const phone = '0723456789';
    const canvas = createCanvas(180, 40);
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black';
    context.font = 'normal 28px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    Array.from(phone).forEach((digit, index) => context.fillText(digit, 9 + index * 18, 20));

    const base64 = canvas.toBuffer('image/png').toString('base64');
    await expect(recognizePubli24PhoneWithoutBrowser(base64, phone.length)).resolves.toBe(phone);
    await expect(recognizePubli24PhonePure(base64, phone.length)).resolves.toBe(phone);
  });

  it('decodes a Publi24 phone image with the serialized local Chromium fallback', async () => {
    const phone = '0723456789';
    const canvas = createCanvas(180, 40);
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black';
    context.font = 'normal 28px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    Array.from(phone).forEach((digit, index) => context.fillText(digit, 9 + index * 18, 20));

    const base64 = canvas.toBuffer('image/png').toString('base64');
    await expect(recognizePubli24PhoneViaBrowser(base64, phone.length)).resolves.toBe(phone);
  }, 30_000);

  it('isolates OLX cards and discovers the actual last page', () => {
    const html = fixture('olx-current.html');
    const cards = extractOlxListPageFromHtml(html);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.href).toContain('IDabc123');
    expect(cards[1]?.title).toContain('Casa 4 camere');
    expect(extractOlxLastPage(html)).toBe(17);
  });

  it('turns Romanian relative timestamps into stable Unix timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T12:00:00.000Z'));

    expect(parseRomanianDateToUnix('22 ore in urma')).toBe(
      Math.floor(new Date('2026-07-21T14:00:00.000Z').getTime() / 1000)
    );
    expect(parseRomanianDateToUnix('3 zile in urma')).toBe(
      Math.floor(new Date('2026-07-19T12:00:00.000Z').getTime() / 1000)
    );
  });

  it('does not turn absent optional query filters into zero', () => {
    expect(parseOptionalNumber(null)).toBeNull();
    expect(parseOptionalNumber('')).toBeNull();
    expect(parseOptionalNumber('   ')).toBeNull();
    expect(parseOptionalNumber('2 camere')).toBe(2);
    expect(parseOptionalNumber(125000)).toBe(125000);
  });

  it('prioritizes fresh detail enrichment work ahead of retries and older pending work', () => {
    const jobs = [
      { status: 'pending', priority: 1080, createdAt: '2026-07-23T07:08:00.000Z' },
      {
        status: 'retry',
        priority: 1120,
        createdAt: '2026-07-22T07:08:00.000Z',
        nextAttemptAt: '2026-07-23T07:05:00.000Z',
      },
      {
        status: 'retry',
        priority: 1080,
        createdAt: '2026-07-23T07:09:00.000Z',
        nextAttemptAt: '2026-07-23T07:04:00.000Z',
      },
      { status: 'pending', priority: 1080, createdAt: '2026-07-23T07:10:00.000Z' },
    ].sort(compareOwnerListingEnrichmentPriority);

    expect(jobs.map((job) => `${job.status}:${job.priority}:${job.createdAt}`)).toEqual([
      'pending:1080:2026-07-23T07:10:00.000Z',
      'pending:1080:2026-07-23T07:08:00.000Z',
      'retry:1080:2026-07-23T07:09:00.000Z',
      'retry:1120:2026-07-22T07:08:00.000Z',
    ]);
  });

  it('uses the Publi24 county/city hierarchy for every configured scope', () => {
    const expectedLocationPaths: Record<string, string> = {
      'bucuresti-ilfov': 'bucuresti',
      'cluj-napoca': 'cluj/cluj-napoca',
      timisoara: 'timis/timisoara',
      brasov: 'brasov/brasov',
      iasi: 'iasi/iasi',
      constanta: 'constanta/constanta',
      oradea: 'bihor/oradea',
      arad: 'arad/arad',
      craiova: 'dolj/craiova',
      galati: 'galati/galati',
      braila: 'braila/braila',
      buzau: 'buzau/buzau',
      ploiesti: 'prahova/ploiesti',
      'alba-iulia': 'alba/alba-iulia',
      'baia-mare': 'maramures/baia-mare',
    };

    for (const scope of listOwnerListingScopes()) {
      const locationPath = expectedLocationPaths[scope.key];
      expect(locationPath).toBeTruthy();
      expect(scope.publi24FreshRadarUrls).toEqual([
        `https://www.publi24.ro/anunturi/imobiliare/${locationPath}/?commercial=false`,
      ]);
      expect(scope.publi24SourceUrls.filter((entry) => entry.kind === 'coverage')).toHaveLength(7);
      expect(
        scope.publi24SourceUrls
          .filter((entry) => entry.kind === 'coverage')
          .every((entry) => entry.url.includes(`/${locationPath}/?commercial=false`))
      ).toBe(true);
    }
  });

  it('uses the current OLX commercial category with distinct transaction filters', () => {
    for (const scope of listOwnerListingScopes()) {
      const commercialUrls = scope.olxSourceUrls.filter((entry) => entry.propertyType === 'commercial');
      expect(commercialUrls).toHaveLength(2);
      expect(commercialUrls.find((entry) => entry.transactionType === 'sale')?.url).toContain(
        '/birouri-spatii-comerciale/'
      );
      expect(commercialUrls.find((entry) => entry.transactionType === 'sale')?.url).toContain(
        'search%5Bfilter_enum_alege%5D%5B0%5D=vanzare'
      );
      expect(commercialUrls.find((entry) => entry.transactionType === 'rent')?.url).toContain(
        'search%5Bfilter_enum_alege%5D%5B0%5D=inchiriere'
      );
    }
  });

  it('does not retry non-transient scraper HTTP errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchScraperResponse('https://example.com/missing', 1000)).rejects.toMatchObject({
      message: expect.stringContaining('status 404'),
      retryable: false,
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries transient scraper HTTP errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchScraperResponse('https://example.com/transient', 1000)).resolves.toMatchObject({
      html: 'ok',
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
