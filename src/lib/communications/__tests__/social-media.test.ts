import { describe, expect, it } from 'vitest';
import { propertyImageUrls, selectPostImages } from '../social';

describe('social post media selection', () => {
  const available = Array.from({ length: 12 }, (_, index) => 'https://cdn.example.com/photo-' + index + '.jpg');

  it('uses the first ten property photographs when none are chosen explicitly', () => {
    expect(selectPostImages(available)).toEqual(available.slice(0, 10));
  });

  it('keeps the order selected in the studio, including an empty Facebook post', () => {
    expect(selectPostImages(available, [available[11], available[2]])).toEqual([available[11], available[2]]);
    expect(selectPostImages(available, [])).toEqual([]);
  });

  it('rejects foreign, repeated, and excessive photographs', () => {
    expect(() => selectPostImages(available, ['https://foreign.example/photo.jpg'])).toThrow();
    expect(() => selectPostImages(available, [available[0], available[0]])).toThrow();
    expect(() => selectPostImages(available, available.slice(0, 11))).toThrow();
  });

  it('only exposes unique HTTPS property photographs', () => {
    expect(propertyImageUrls([{ url: 'http://insecure.example/a.jpg' }, { url: available[0] }, { url: available[0] }, {}])).toEqual([available[0]]);
  });
});
