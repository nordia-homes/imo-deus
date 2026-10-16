import { expect, it } from 'vitest';
import { socialCommentRows, socialCommentsRequest, socialCommentsSelection, socialDiagnosticRows, socialDiagnosticsRequest } from '../social-comments';
it('recognizes only reading and explicit paired selection', () => {
  expect(socialCommentsRequest('Arată-mi comentariile recente.')).toBe(true);
  expect(socialCommentsRequest('Răspunde comentariului selectat.')).toBe(false);
  expect(socialCommentsSelection('Postare socială: p; Cont social: c')?.slice(1)).toEqual(['p', 'c']);
  expect(socialCommentsSelection('Postare socială: ../p; Cont social: c')).toBeNull();
});
it('distinguishes a valid empty page from malformed provider data', () => {
  expect(socialCommentRows({ data: [] })).toEqual({ rows: [], complete: true });
  expect(() => socialCommentRows({ error: 'invalid' })).toThrow();
  expect(() => socialCommentRows({ data: [null] })).toThrow();
});
it('sorts dates and handles missing author and invalid date', () => {
  const result = socialCommentRows({ data: [{ id: '1', text: 'old', timestamp: 'invalid' }, { id: '2', text: 'new', timestamp: '2026-01-01T04:00:00Z' }] });
  expect(result.rows.map(row => row.id)).toEqual(['2', '1']);
  expect(result.rows[0].description).toContain('06:00');
  expect(result.rows[1].name).toBe('Autor necunoscut');
  expect(result.rows[1].createdAt).toBeNull();
});

it('projects diagnostic facts without raw secrets or fabricated comment conclusions', () => {
  expect(socialDiagnosticsRequest('Rulează diagnosticul social.')).toBe(true);
  const rows = socialDiagnosticRows({ tokenValid: false, appMatches: false, postInAccountList: null, directPostReadable: false, missingScopes: ['SECRET'], expectedPageId: 'one', tokenPageId: 'two', conclusion: 'SECRET', directPostError: 'SECRET' } as any);
  expect(rows.find(row => row.id === 'token')?.description).toBe('neconfirmat');
  expect(rows.find(row => row.id === 'account')?.description).toBe('necunoscut');
  expect(rows.find(row => row.id === 'identity')?.description).toContain('diferă');
  expect(JSON.stringify(rows)).not.toContain('SECRET');
});