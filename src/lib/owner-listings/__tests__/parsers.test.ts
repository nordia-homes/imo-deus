import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchScraperResponse } from '@/lib/owner-listings/browser';
import { recognizePubli24PhoneWithoutBrowser } from '@/lib/owner-listings/publi24-phone-ocr';
import {
  extractImoradar24LastPage,
  extractImoradar24ListPageFromHtml,
} from '@/lib/owner-listings/sources/imoradar24';
import { extractOlxLastPage, extractOlxListPageFromHtml } from '@/lib/owner-listings/sources/olx';
import {
  extractPubli24LastPage,
  extractPubli24StructuredOffersFromHtml,
} from '@/lib/owner-listings/sources/publi24';
import { listOwnerListingScopes } from '@/lib/owner-listings/scope';
import { parseRomanianDateToUnix } from '@/lib/owner-listings/utils';

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
    });
    expect(cards[1]?.href).toBe('/link-extern/1942044');
    expect(extractImoradar24LastPage(html)).toBe(12);
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
  });

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
