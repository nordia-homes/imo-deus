import { describe, expect, it } from 'vitest';
import { operationCards } from '../operation-cards';
describe('Domain result cards', () => {
  it('renders individual provider records instead of one opaque object', () => {
    const cards = operationCards('tiktok_drafts', 'Drafturi TikTok. Din modulul existent.', { drafts: [{ id: 'a', name: 'Apartament Titan', status: 'draft', accessToken: 'hidden' }, { id: 'b', name: 'Pipera', status: 'scheduled' }] });
    expect(cards[0].rows).toHaveLength(2); expect(cards[0].rows[0].title).toBe('Apartament Titan');
    expect(cards[0].rows[0]).not.toHaveProperty('accessToken'); expect(cards[0]).not.toHaveProperty('complete');
  });
  it('preserves pending business state and actual notes for a single job', () => {
    const card = operationCards('video_job', 'Progres video.', { job: { id: 'j', status: 'processing' }, note: 'Randarea continuă.' })[0];
    expect(card.rows[0]).toMatchObject({ id: 'j', status: 'processing', description: 'Randarea continuă.' });
  });
});
