import { expect, it } from 'vitest';
import { searchPlaybooks } from '../knowledge';
import { officialUrl } from '../legal-source';
it('retrieves relevant playbooks with explicit non-legal provenance', () => {
  expect(searchPlaybooks('negociere contraoferta').rows[0]).toMatchObject({ id: 'negotiation', legalAuthority: false, category: 'INTERNAL_PLAYBOOK' });
  expect(searchPlaybooks('xyz-no-match').rows).toEqual([]);
});
it.each(['http://legislatie.just.ro/x', 'https://legislatie.just.ro.attacker.com/x', 'https://user:secret@www.ancpi.ro/x', 'https://127.0.0.1/x', 'https://www.anaf.ro:8443/x'])('rejects unofficial or credentialed source %s', url => {
  expect(() => officialUrl(url)).toThrow();
});
it('accepts exact official hosts without confusing retrieval with temporal validity', () => {
  expect(officialUrl('https://legislatie.just.ro/Public/DetaliiDocument/1').hostname).toBe('legislatie.just.ro');
});
