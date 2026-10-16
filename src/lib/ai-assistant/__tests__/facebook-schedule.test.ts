import { describe, expect, it, vi } from 'vitest';
import { facebookCreateSchema, reserveFacebookTransaction } from '@/lib/facebook-job-create';
import { facebookScheduleRequest, facebookScheduleExecutionPrompt } from '../facebook-schedule';
describe('Facebook schedule command', () => {
  it.each(['Cișmigiu', 'Cişmigiu', 'Cismigiu'])('normalizes %s', title => expect(facebookScheduleRequest('Programează apartamentul din ' + title + ' în toate grupurile Facebook eligibile mâine la 07:00.')).toEqual({ query: 'cismigiu', time: '07:00' }));
  it.each(['Nu programa apartamentul din Cișmigiu în toate grupurile Facebook eligibile mâine la 07:00.', 'Programează apartamentul din Cișmigiu în toate grupurile Facebook eligibile mâine la 27:00.'])('rejects %s', prompt => expect(facebookScheduleRequest(prompt)).toBeNull());
  it('validates immutable request identity and group URLs', () => {
    const input = { propertyId: 'p', connectionId: 'c', groupUrls: ['https://www.facebook.com/groups/a'], requestId: 'not-a-uuid' };
    expect(facebookCreateSchema.safeParse(input).success).toBe(false);
    expect(facebookCreateSchema.safeParse({ ...input, requestId: undefined, propertyId: '../p' }).success).toBe(false);
  });
  it('does not revive an old pending selection', () => {
    const prompt = 'Proprietate: p';
    expect(facebookScheduleExecutionPrompt(prompt, [{ role: 'assistant', cards: [] }] as any)).toBe(prompt);
  });
});

it('retries only a closed database transaction, with a finite bound', async () => {
  const closed = Object.assign(new Error('Transaction is invalid or closed.'), { code: 3 });
  const db = { runTransaction: vi.fn().mockRejectedValueOnce(closed).mockResolvedValueOnce('saved') };
  expect(await reserveFacebookTransaction(db as any, async () => 'saved')).toBe('saved'); expect(db.runTransaction).toHaveBeenCalledTimes(2);
  db.runTransaction.mockReset().mockRejectedValue(closed);
  await expect(reserveFacebookTransaction(db as any, async () => 'saved')).rejects.toThrow('closed'); expect(db.runTransaction).toHaveBeenCalledTimes(3);
  db.runTransaction.mockReset().mockRejectedValue(new Error('Access revoked'));
  await expect(reserveFacebookTransaction(db as any, async () => 'saved')).rejects.toThrow('Access'); expect(db.runTransaction).toHaveBeenCalledTimes(1);
});