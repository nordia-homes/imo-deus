import { expect, it } from 'vitest';
import { recommendSocialFormats, socialAdviceRequest } from '../social-advice';
import { socialPostFormat } from '../social-performance';
import { INSTAGRAM_POST_LIMITS, validateInstagramPost } from '@/lib/communications/social';
const row = (format: string, likes = 2, connectionId = 'one') => ({ connectionId, channel: 'messenger', format, available: true, likes, comments: 0 });
it('routes the original requests without consuming publication', () => {
  expect(socialAdviceRequest('Recomandă ce tip de postare să fac data viitoare.')).toBe('recommend');
  expect(socialAdviceRequest('Nu presupune că regulile celor două platforme sunt identice.')).toBe('rules');
  expect(socialAdviceRequest('Publică acum.')).toBeNull();
});
it('keeps unknown media distinct from text-only posts', () => {
  expect(socialPostFormat(undefined)).toBe('unknown'); expect(socialPostFormat([])).toBe('text');
  expect(socialPostFormat(['https://example.test/a'])).toBe('photo'); expect(socialPostFormat(['bad'])).toBe('unknown');
});
it('compares observed formats only inside the same account with at least two samples each', () => {
  const result = recommendSocialFormats([row('photo', 6), row('photo', 4), row('text', 0), row('text', 2), row('gallery', 100, 'other')], true);
  expect(result[0]).toMatchObject({ recommendedFormat: 'photo', evidence: 'observed_sample' });
  expect(result[0].samples.find(x => x.format === 'photo')).toMatchObject({ count: 2, meanInteractions: 5 });
  expect(result[1].recommendedFormat).toBeNull();
});
it('does not rank ties, missing counters, unsupported formats or failures', () => {
  const rows = [row('photo'), row('photo'), row('text'), row('text'), { ...row('gallery'), likes: null }, { ...row('gallery'), available: false }, row('unknown')];
  expect(recommendSocialFormats(rows, false)[0]).toMatchObject({ recommendedFormat: null, excluded: 3, complete: false });
});
it('excludes overflowing counters instead of reporting an invalid mean', () => {
  expect(recommendSocialFormats([{ ...row('photo', Number.MAX_SAFE_INTEGER), comments: 1 }], true)[0].excluded).toBe(1);
});
it('uses the same Instagram limits as the publication validator', () => {
  expect(() => validateInstagramPost('x'.repeat(INSTAGRAM_POST_LIMITS.text), ['https://example.test/a'])).not.toThrow();
  expect(() => validateInstagramPost('x'.repeat(INSTAGRAM_POST_LIMITS.text + 1), ['https://example.test/a'])).toThrow();
  expect(() => validateInstagramPost('x', [])).toThrow();
});