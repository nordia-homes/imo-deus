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
import { recognizePubli24PhonePure } from '@/lib/owner-listings/publi24-phone-ocr-pure';

const liveDescribe = process.env.LIVE_SCRAPER_TEST === '1' ? describe : describe.skip;
const exactPubli24PhoneUrl = process.env.PUBLI24_PHONE_TEST_URL;

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

  it('normalizes a relative Publi24 detail URL and hydrates its phone only when explicitly requested', async () => {
    const html = await fetchScraperHtml(
      'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/bucuresti/?commercial=false',
      60_000
    );
    const offers = extractPubli24StructuredOffersFromHtml(html).slice(0, 3);
    expect(offers.length).toBeGreaterThan(0);
    const details = await Promise.all(
      offers.map((offer) =>
        scrapePubli24ListingDetail(offer.url, { requirePhone: true })
      )
    );
    expect(
      details.some((detail) =>
        /^0[237]\d{8}$|^[237]\d{7}$/.test(detail.contactPhone || '')
      )
    ).toBe(true);
    expect(
      details
        .filter((detail) => detail.contactPhone)
        .every((detail) => detail.contactPhoneStatus === 'available')
    ).toBe(true);
  }, 120_000);

  it.skipIf(!exactPubli24PhoneUrl)(
    'hydrates the phone for an exact Publi24 prospecting URL',
    async () => {
      const detail = await scrapePubli24ListingDetail(exactPubli24PhoneUrl!, {
        requirePhone: true,
      });

      expect(detail.contactPhoneStatus).toBe('available');
      expect(detail.contactPhone).toMatch(/^0[237]\d{8}$|^[237]\d{7}$/);
    },
    120_000
  );

  it.skipIf(!exactPubli24PhoneUrl)(
    'hydrates an exact Publi24 phone with the cloud-safe pure JavaScript OCR',
    async () => {
      const html = await fetchScraperHtml(exactPubli24PhoneUrl!, 60_000);
      const formAction = html.match(
        /<form action="([^"]*PhoneNumberImages[^"]*)"/i
      )?.[1];
      const encryptedPhone = html.match(
        /name="EncryptedPhone"[^>]*value="([^"]+)"/i
      )?.[1];
      expect(Boolean(formAction && encryptedPhone)).toBe(true);

      const endpoint = new URL(formAction!, exactPubli24PhoneUrl!).toString();
      const hintedLength = Number(endpoint.match(/Length=(\d+)/i)?.[1] || 0);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          Origin: 'https://www.publi24.ro',
          Referer: exactPubli24PhoneUrl!,
        },
        body: new URLSearchParams({ EncryptedPhone: encryptedPhone! }).toString(),
      });
      expect(response.ok).toBe(true);

      const base64 = (await response.text()).trim();
      const recognized = await recognizePubli24PhonePure(
        base64,
        hintedLength || null
      );
      expect(/^0[237]\d{8}$|^[237]\d{7}$/.test(recognized)).toBe(true);
    },
    120_000
  );
});
