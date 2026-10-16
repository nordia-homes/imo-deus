import { describe, expect, it } from 'vitest';
import { propertyPostDraft, propertyPostRequest, selectedPropertyPost } from '../property-post-draft';
const property = { title: 'Apartament Cișmigiu', transactionType: 'Vânzare', location: 'București', price: 125000, rooms: 2, squareFootage: 54, bathrooms: 1, amenities: ['Balcon', 'balcon'] };
describe('CRM-grounded property posts', () => {
  it('uses only public facts and deduplicates listed amenities', () => {
    const draft = propertyPostDraft({ ...property, ownerPhone: 'PRIVATE', notes: 'PRIVATE', description: 'Piscină inventată', advertisingCosts: { currency: 'USD' } }, 'neutral')!;
    expect(draft.text).toContain('125.000 EUR'); expect(draft.text).toContain('54 m² utili'); expect(draft.text).toContain('1 baie');
    expect(draft.text.match(/Balcon/gi)).toHaveLength(1); expect(draft.text).not.toMatch(/PRIVATE|Piscină|USD/);
    expect(draft.usedFields).toEqual(['title', 'transactionType', 'location', 'rooms', 'squareFootage', 'bathrooms', 'price', 'amenities']);
  });
  it.each([0, -1, NaN, Infinity, '125000', null])('omits an invalid price %s', price => expect(propertyPostDraft({ ...property, price }, 'neutral')!.text).not.toContain('Preț:'));
  it.each(['EUR', 'RON', 'USD'])('preserves explicit price currency %s', priceCurrency => expect(propertyPostDraft({ ...property, priceCurrency }, 'neutral')!.text).toContain('125.000 ' + priceCurrency));
  it('does not guess an unsupported currency', () => expect(propertyPostDraft({ ...property, currency: 'XYZ' }, 'neutral')!.text).not.toContain('Preț:'));
  it('does not infer amenities from prose or missing attributes', () => {
    const draft = propertyPostDraft({ title: 'Proprietate', description: 'Lux, lift, metrou', nearMetro: true, parking: 'Da' }, 'neutral')!;
    expect(draft.text).not.toMatch(/Lux|lift|metrou|parcare/); expect(draft.omittedFields).toContain('amenities');
  });
  it('does not turn a rental into a sale in commercial wording', () => { const draft = propertyPostDraft({ ...property, transactionType: 'Închiriere' }, 'commercial')!; expect(draft.text).toContain('De închiriat'); expect(draft.text).not.toMatch(/De vânzare|cumpărat/); });
  it('does not invent urgency, negotiability, commission or yield', () => expect(propertyPostDraft(property, 'commercial')!.text).not.toMatch(/urgent|negociabil|comision|randament|garantat|disponibil/i));
  it('requires usable facts', () => expect(propertyPostDraft({ transactionType: 'Vanzare', price: 0 }, 'neutral')).toBeNull());
  it('sanitizes markup and bounds the amenity list', () => {
    const draft = propertyPostDraft({ ...property, title: '<b>Apartament</b>\nBucurești', amenities: Array.from({ length: 15 }, (_, i) => 'Dotare ' + i) }, 'neutral')!;
    expect(draft.text).not.toContain('<b>'); expect(draft.omittedAmenityCount).toBe(3); expect(draft.text).not.toContain('Dotare 14');
  });
  it('changes the revision only when published draft data changes', () => {
    const base = propertyPostDraft(property, 'neutral')!;
    expect(propertyPostDraft({ ...property, notes: 'internal' }, 'neutral')!.revision).toBe(base.revision);
    expect(propertyPostDraft({ ...property, price: 126000 }, 'neutral')!.revision).not.toBe(base.revision);
  });
  it('preserves commercial style when refreshing the same page and resets it for another property', () => {
    const history: any[] = [{ id: 'current-page-context', role: 'assistant', cards: [{ source: 'properties', rows: [{ id: 'p' }] }] }, { role: 'assistant', cards: [{ source: 'facebookPostDraft', rows: [{ propertyId: 'p', style: 'commercial' }] }] }];
    expect(selectedPropertyPost(history)).toEqual({ id: 'p', previousStyle: 'commercial' });
    history[0].cards[0].rows[0].id = 'q'; expect(selectedPropertyPost(history)).toEqual({ id: 'q', previousStyle: 'neutral' });
  });
  it('keeps a draft context after leaving the page, without falling back to old lists', () => {
    const page: any = { id: 'current-page-context', role: 'assistant', cards: [] };
    expect(selectedPropertyPost([page, { role: 'assistant', cards: [{ source: 'facebookPostDraft', rows: [{ propertyId: 'p' }] }] } as any]).id).toBe('p');
    expect(selectedPropertyPost([page, { role: 'assistant', cards: [{ source: 'properties', rows: [{ id: 'old' }] }] } as any]).id).toBeNull();
  });
  it('recognizes Romanian originals and does not treat publication as draft creation', () => { expect(propertyPostRequest('Nu inventa facilități în postare.')).toBe('amenities'); expect(propertyPostRequest('Publică postarea.')).toBeNull(); });
  it('keeps reservation status visible in the draft', () => expect(propertyPostDraft({ ...property, status: 'Rezervat' }, 'commercial')!.text).toContain('Status: rezervat'));
  it.each(['Vândut', 'Închiriat', 'Inactiv'])('does not draft an active offer for %s', status => expect(propertyPostDraft({ ...property, status }, 'neutral')).toBeNull());
});
