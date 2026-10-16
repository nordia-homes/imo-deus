import { describe, expect, it } from 'vitest';
import { socialPostSearchRequest, socialPropertyMatches } from '../social-post-search';

describe('social property search', () => {
  it.each(['Cișmigiu', 'Cişmigiu', 'CISMIGIU', '„Cișmigiu”'])('recognizes %s', name => {
    expect(socialPostSearchRequest('Găsește postările proprietății din ' + name + '.')).toBe('cismigiu');
  });
  it('matches complete normalized words across title and address', () => {
    expect(socialPropertyMatches('Cişmigiu 12', ['Apartament Cișmigiu', 'Strada Știrbei-Vodă 12'])).toBe(true);
    expect(socialPropertyMatches('Titan', ['Titanic'])).toBe(false);
    expect(socialPropertyMatches('Cișmigiu 12', ['Cișmigiu 123'])).toBe(false);
    expect(socialPropertyMatches('???', ['Cișmigiu'])).toBe(false);
  });
  it('does not consume publication commands', () => {
    expect(socialPostSearchRequest('Publică proprietatea din Cișmigiu.')).toBeNull();
  });
});
