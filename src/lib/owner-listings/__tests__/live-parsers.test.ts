import { describe, expect, it } from 'vitest';

import { fetchScraperHtml } from '@/lib/owner-listings/browser';
import {
  extractImoradar24ListPageFromHtml,
  scrapeImoradar24ListingDetail,
} from '@/lib/owner-listings/sources/imoradar24';
import { extractOlxListPageFromHtml } from '@/lib/owner-listings/sources/olx';
import {
  extractPubli24StructuredOffersFromHtml,
  scrapePubli24ListingDetail,
} from '@/lib/owner-listings/sources/publi24';

const liveDescribe = process.env.LIVE_SCRAPER_TEST === '1' ? describe : describe.skip;

liveDescribe('live owner-listing parser contracts', () => {
  it('parses the current Imoradar24 owner-listing DOM', async () => {
    const html = await fetchScraperHtml(
      'https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?sort=latest',
      60_000
    );
    const cards = extractImoradar24ListPageFromHtml(html);
    expect(html.length).toBeGreaterThan(10_000);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((card) => card.href.includes('/oferta/') || card.href.includes('/link-extern/'))).toBe(true);
    expect(cards.some((card) => Boolean(card.originSourceLabel))).toBe(true);
  }, 90_000);

  it('preserves the exact Imobiliare.ro redirect even when the portal blocks the response', async () => {
    const html = await fetchScraperHtml(
      'https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?sort=latest',
      60_000
    );
    const card = extractImoradar24ListPageFromHtml(html).find(
      (candidate) =>
        candidate.originSourceLabel === 'Imobiliare.ro' &&
        candidate.href.includes('/link-extern/')
    );
    expect(card).toBeTruthy();

    const detail = await scrapeImoradar24ListingDetail(card!.href);
    expect(detail.originSourceLabel).toBe('Imobiliare.ro');
    expect(detail.originSourceUrl).toMatch(/^https:\/\/(?:www\.)?imobiliare\.ro\/.+/);
    expect(new URL(detail.originSourceUrl!).pathname).not.toBe('/');
  }, 120_000);

  it('parses a nested county/city Imoradar24 owner route', async () => {
    const html = await fetchScraperHtml(
      'https://www.imoradar24.ro/case-de-vanzare/judetul-timis/timisoara/proprietar?sort=latest',
      60_000
    );
    const cards = extractImoradar24ListPageFromHtml(html);
    expect(html.length).toBeGreaterThan(10_000);
    expect(cards.length).toBeGreaterThan(0);
  }, 90_000);

  it('parses the current OLX private-owner cards', async () => {
    const html = await fetchScraperHtml(
      'https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/bucuresti-ilfov-judet/?currency=EUR&search%5Bprivate_business%5D=private&search%5Border%5D=created_at%3Adesc',
      60_000
    );
    const cards = extractOlxListPageFromHtml(html);
    expect(html.length).toBeGreaterThan(10_000);
    expect(cards.length).toBeGreaterThan(0);
  }, 90_000);

  it('parses the current OLX commercial rental category', async () => {
    const html = await fetchScraperHtml(
      'https://www.olx.ro/imobiliare/birouri-spatii-comerciale/bucuresti-ilfov-judet/?currency=EUR&search%5Bprivate_business%5D=private&search%5Border%5D=created_at%3Adesc&search%5Bfilter_enum_alege%5D%5B0%5D=inchiriere',
      60_000
    );
    const cards = extractOlxListPageFromHtml(html);
    expect(html.length).toBeGreaterThan(10_000);
    expect(cards.length).toBeGreaterThan(0);
  }, 90_000);

  it('parses the current Publi24 structured offers', async () => {
    const html = await fetchScraperHtml(
      'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/bucuresti/?commercial=false',
      60_000
    );
    const offers = extractPubli24StructuredOffersFromHtml(html);
    expect(html.length).toBeGreaterThan(10_000);
    expect(offers.length).toBeGreaterThan(0);
  }, 90_000);

  it('parses a Publi24 county/city route', async () => {
    const html = await fetchScraperHtml(
      'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/timis/timisoara/?commercial=false',
      60_000
    );
    const offers = extractPubli24StructuredOffersFromHtml(html);
    expect(html.length).toBeGreaterThan(10_000);
    expect(offers.length).toBeGreaterThan(0);
  }, 90_000);

  it('normalizes a relative Publi24 detail URL and hydrates its phone without Chromium', async () => {
    const html = await fetchScraperHtml(
      'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/bucuresti/?commercial=false',
      60_000
    );
    const offers = extractPubli24StructuredOffersFromHtml(html).slice(0, 3);
    expect(offers.length).toBeGreaterThan(0);
    const details = await Promise.all(offers.map((offer) => scrapePubli24ListingDetail(offer.url)));
    expect(details.some((detail) => /^0\d{9}$|^\d{8}$/.test(detail.contactPhone || ''))).toBe(true);
    expect(
      details
        .filter((detail) => detail.contactPhone)
        .every((detail) => detail.contactPhoneStatus === 'available')
    ).toBe(true);
  }, 120_000);
});
