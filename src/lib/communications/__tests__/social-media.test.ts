import { describe, expect, it } from 'vitest';
import { propertyImageUrls, selectPostImages, validateInstagramPost } from '../social';

describe('social post media selection', () => {
  const available = Array.from({ length: 12 }, (_, index) => 'https://cdn.example.com/photo-' + index + '.jpg');

  it('keeps every property photograph when none are chosen explicitly', () => {
    expect(selectPostImages(available)).toEqual(available);
  });

  it('keeps the order selected in the studio, including an empty Facebook post', () => {
    expect(selectPostImages(available, [available[11], available[2]])).toEqual([available[11], available[2]]);
    expect(selectPostImages(available, [])).toEqual([]);
  });

  it('rejects foreign and repeated photographs', () => {
    expect(() => selectPostImages(available, ['https://foreign.example/photo.jpg'])).toThrow();
    expect(() => selectPostImages(available, [available[0], available[0]])).toThrow();
    expect(selectPostImages(available, available)).toHaveLength(12);
  });

  it('enforces Instagram API limits without changing the saved content', () => {
    expect(() => validateInstagramPost('x'.repeat(2200), available.slice(0, 10))).not.toThrow();
    expect(() => validateInstagramPost('x'.repeat(2201), available.slice(0, 10))).toThrow();
    expect(() => validateInstagramPost('caption', available.slice(0, 11))).toThrow();
    expect(() => validateInstagramPost('caption', [])).toThrow();
    expect(selectPostImages(available, available)).toHaveLength(12);
  });

  it('only exposes unique HTTPS property photographs', () => {
    expect(propertyImageUrls([{ url: 'http://insecure.example/a.jpg' }, { url: available[0] }, { url: available[0] }, {}])).toEqual([available[0]]);
  });
});
