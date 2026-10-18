import { expect, it } from 'vitest';
import { displayReference, isInternalDisplayField } from '../display-names';
it('never displays unresolved identifiers or dependency syntax', () => {
 expect(displayReference('private-id', id=>id)).toBe('Denumire indisponibilă');
 expect(displayReference('@step:1:contactId', id=>id)).toBe('Creat într-un pas anterior');
 expect(displayReference('private-id', ()=>'Matei Alin')).toBe('Matei Alin');
});
it('hides internal revisions but preserves business fields',()=>{
 expect(isInternalDisplayField('expectedDraftRevision')).toBe(true);
 expect(isInternalDisplayField('requestId')).toBe(true);
 expect(isInternalDisplayField('propertyId')).toBe(false);
 expect(isInternalDisplayField('price')).toBe(false);
});
