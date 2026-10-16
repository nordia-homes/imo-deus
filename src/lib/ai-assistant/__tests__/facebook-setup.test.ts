import { expect, it } from 'vitest';
import { facebookSetupRequest, selectedFacebookProperty, facebookConnectionSummary, facebookGroupSelection } from '../facebook-setup';
it.each([
  ['Arată-mi conturile Facebook conectate.', 'accounts'], ['Care cont Facebook este setat pentru proprietatea aceasta?', 'property-account'],
  ['Arată-mi grupurile Facebook configurate în agenție.', 'groups'], ['Găsește grupurile eligibile pentru vânzare.', 'sale'],
  ['Găsește grupurile eligibile pentru închiriere.', 'rent'], ['Spune-mi exact ce conexiune Facebook este blocată.', 'blocked'],
])('recognizes %s', (text, mode) => expect(facebookSetupRequest(text)).toBe(mode));
it.each(['Publică acum pe Facebook', 'Nu arăta conturile Facebook', 'Arată conturile Meta Ads'])('does not confuse %s', text => expect(facebookSetupRequest(text)).toBeNull());
it('uses current page only when provided and never substitutes a previous property', () => {
  const selected: any = { role: 'assistant', cards: [{ source: 'properties', rows: [{ id: 'p' }] }] };
  expect(selectedFacebookProperty([selected])).toBe('p');
  expect(selectedFacebookProperty([selected, { id: 'current-page-context', role: 'assistant', cards: [] } as any])).toBeNull();
  expect(selectedFacebookProperty([{ ...selected, cards: [{ source: 'properties', rows: [{ id: 'p' }, { id: 'q' }] }] }])).toBeNull();
});
it('projects only verified configuration fields and never raw session/error data', () => {
  const result = facebookConnectionSummary('own', { label: 'Cont', status: 'error', lastError: 'secret', currentUrl: 'secret', token: 'secret', cookies: 'secret', lastVerifiedAt: 'invalid' });
  expect(JSON.stringify(result)).not.toContain('secret'); expect(result.lastVerifiedAt).toBeNull(); expect(result.status).toBe('error');
  expect(facebookConnectionSummary('c', { status: 'arbitrary' }).status).toBe('unknown');
});
const groups = [
  { name: 'Vânzări', url: 'https://www.facebook.com/groups/sale', purpose: 'sale' },
  { name: 'Chirii', url: 'https://www.facebook.com/groups/rent', purpose: 'rent' },
  { name: 'Mixte', url: 'https://www.facebook.com/groups/both', purpose: 'both' },
];
it.each([['groups', ['Vânzări', 'Chirii', 'Mixte']], ['sale', ['Vânzări', 'Mixte']], ['rent', ['Chirii', 'Mixte']]] as const)('filters %s using domain purposes', (mode, expected) => expect(facebookGroupSelection(groups, mode).rows.map(row => row.name)).toEqual(expected));
it('excludes invalid links, deduplicates exact URLs and labels fallback defaults', () => {
  const result = facebookGroupSelection([...groups, groups[0], { name: 'Bad', url: 'https://facebook.com.evil.example/groups/x', purpose: 'both' }], 'groups');
  expect(result.rows).toHaveLength(3); expect(result.invalid).toBe(1); expect(result.configured).toBe(true);
  expect(facebookGroupSelection([], 'groups')).toMatchObject({ configured: false, invalid: 0 });
  expect(facebookGroupSelection([], 'groups').rows.every(row => row.source === 'application_default')).toBe(true);
});