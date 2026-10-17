import { expect, it } from 'vitest';
import { socialCommentAction, socialCommentReceipt } from '../social-comment-actions';
import { explicitlyRequestedSafeAction } from '../autonomy';
const action = { kind: 'existing_operation', operation: 'social_like', params: { postId: 'post', commentId: '9' }, query: {}, body: { connectionId: 'connection' } } as const;
it('authorizes only the exact requested action with the strict shape', () => {
  expect(socialCommentAction(action)).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Dă like comentariului dacă funcția este suportată.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Nu da like comentariului.')).toBe(false);
  expect(socialCommentAction({ ...action, body: { ...action.body, extra: true } } as any)).toBe(false);
});
it('requires a provider receipt and projects only verified identifiers', () => {
  expect(() => socialCommentReceipt(action, {})).toThrow();
  expect(() => socialCommentReceipt(action, { success: false })).toThrow();
  expect(socialCommentReceipt(action, { success: true, token: 'SECRET' })).toMatchObject({ operation: 'social_like', executionState: 'succeeded' });
  const reply = { ...action, operation: 'social_reply', body: { connectionId: 'connection', text: 'Bună ziua' } } as any;
  expect(() => socialCommentReceipt(reply, { success: true })).toThrow();
  expect(socialCommentReceipt(reply, { id: '123_456' })).toMatchObject({ replyId: '123_456' });
});