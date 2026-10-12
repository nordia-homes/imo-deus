import { expect, it, vi } from 'vitest';
import { readOutreachConfiguration } from '../outreach-configuration';
import type { AssistantContext } from '../access';

it.each(['agent', 'admin'])('reads only agency configuration and reports %s edit rights', async role => {
  const path: string[] = [];
  const ref: any = { collection: (id: string) => { path.push(id); return ref; }, doc: (id: string) => { path.push(id); return ref; }, get: vi.fn(async () => ({ exists: true, data: () => ({ enabled: true, timezone: 'UTC', maxDailyCalls: 12, secret: 'private' }) })) };
  const result = await readOutreachConfiguration({ agencyId: 'agency-a', role, adminDb: ref } as AssistantContext);
  expect(path).toEqual(['agencies', 'agency-a', 'aiOutreach', 'settings']);
  expect(result).toMatchObject({ canEdit: role === 'admin', persisted: true, complete: true, rows: [{ enabled: true, maxDailyCalls: 12, timezone: 'Europe/Bucharest' }] });
  expect(JSON.stringify(result)).not.toContain('private');
});

it('reports missing settings as disabled without creating a configuration', async () => {
  const ref: any = { collection: () => ref, doc: () => ref, get: async () => ({ exists: false, data: () => undefined }), set: vi.fn() };
  expect(await readOutreachConfiguration({ agencyId: 'agency-a', role: 'agent', adminDb: ref } as AssistantContext)).toMatchObject({ persisted: false, rows: [{ enabled: false, timezone: 'Europe/Bucharest' }] });
  expect(ref.set).not.toHaveBeenCalled();
});
