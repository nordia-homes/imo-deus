import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  extractImoradar24LastPage,
  extractImoradar24ListPageFromHtml,
} from '@/lib/owner-listings/sources/imoradar24';
import { extractOlxLastPage, extractOlxListPageFromHtml } from '@/lib/owner-listings/sources/olx';
import {
  extractPubli24LastPage,
  extractPubli24StructuredOffersFromHtml,
} from '@/lib/owner-listings/sources/publi24';
import { parseRomanianDateToUnix } from '@/lib/owner-listings/utils';

const fixtures = join(process.cwd(), 'src', 'lib', 'owner-listings', '__tests__', 'fixtures');
const fixture = (name: string) => readFileSync(join(fixtures, name), 'utf8');

afterEach(() => vi.useRealTimers());

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
});
