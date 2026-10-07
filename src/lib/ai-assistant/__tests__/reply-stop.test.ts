import { expect, it } from 'vitest';
import { assertNoReplySince } from '../reply-stop';
const cutoff = '2026-10-07T10:00:00Z';
it.each(['2026-10-07T10:00:00Z', '2026-10-07T13:00:00+03:00', '2026-10-07T10:00:01Z'])('stops replies at or after activation: %s', lastInboundAt => {
  expect(() => assertNoReplySince({ lastInboundAt }, cutoff)).toThrow('a răspuns');
});
it.each([undefined, null, '2026-10-07T12:59:59+03:00'])('permits no reply or an earlier reply: %s', lastInboundAt => {
  expect(() => assertNoReplySince({ lastInboundAt }, cutoff)).not.toThrow();
});
it.each([{ cutoff: 'bad', lastInboundAt: undefined }, { cutoff, lastInboundAt: 'bad' }, { cutoff: null, lastInboundAt: undefined }])('fails closed for invalid dates: %j', input => {
  expect(() => assertNoReplySince(input, input.cutoff)).toThrow('nu poate fi verificat');
});
it('preserves explicit opt-out', () => {
  expect(() => assertNoReplySince({ lastInboundAt: 'bad' }, undefined)).not.toThrow();
});
