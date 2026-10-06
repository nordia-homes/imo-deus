import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, getConversation: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection(name), getResource: vi.fn(), canReadResource: (ctx: any, resource: string, row: any) => resource !== 'sales' || ctx.role === 'admin' || row.agentId === ctx.uid || row.collaboratorIds?.includes(ctx.uid) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, invokeOperation: vi.fn() }));
import { actionSchema } from '../contracts';
import { executeAction } from '../actions';
import { selectActionTools, capabilityScore } from '../capability-discovery';
import type { AssistantContext } from '../access';

function database(initial: Record<string, any>) {
  const rows = new Map<string, Record<string, any>>(Object.entries({ 'users/u': { agencyId: 'a', role: 'agent', name: 'Agent' }, ...initial }));
  const ref = (path: string): any => {
    const filters: [string, any][] = [];
    return { path, id: path.split('/').at(-1), collection: (name: string) => ref(`${path}/${name}`), doc: (id: string) => ref(`${path}/${id}`),
      where(field: string, _op: string, value: any) { filters.push([field, value]); return this; },
      get: async () => { const docs = [...rows].filter(([key, value]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && filters.every(([field, wanted]) => value[field] === wanted)).map(([key, value]) => ({ id: key.split('/').at(-1), data: () => value, ref: ref(key) })); return { exists: rows.has(path), data: () => rows.get(path), docs, empty: docs.length === 0, size: docs.length }; },
    };
  };
  const db = { collection: ref, runTransaction: async (work: any) => {
    const writes: (() => void)[] = [], tx = { get: async (reference: any) => { if (writes.length) throw new Error('Read after write'); return reference.get(); },
      create: (reference: any, data: any) => writes.push(() => { if (rows.has(reference.path)) throw new Error('Duplicate'); rows.set(reference.path, data); }),
      update: (reference: any, data: any) => writes.push(() => rows.set(reference.path, { ...rows.get(reference.path), ...data })),
      set: (reference: any, data: any) => writes.push(() => rows.set(reference.path, data)), delete: (reference: any) => writes.push(() => rows.delete(reference.path)) };
    const result = await work(tx); writes.forEach(write => write()); return result;
  } };
  return { rows, ctx: { uid: 'u', role: 'agent', agencyId: 'a', adminDb: db } as unknown as AssistantContext };
}
describe('CRM parity and command execution', () => {
  it('assigns only an owned Facebook account from the same agency and audits through the common property action', async () => {
    const { ctx, rows } = database({ 'agencies/a/properties/p': { title: 'Home' }, 'agencies/a/facebookCloudConnections/own': { ownerUid: 'u' }, 'agencies/a/facebookCloudConnections/other': { ownerUid: 'other' }, 'agencies/b/facebookCloudConnections/foreign': { ownerUid: 'u' } });
    for (const [id, status] of [['other', 403], ['foreign', 404]] as const) {
      await expect(executeAction(ctx, { kind: 'update_property', propertyId: 'p', patch: { defaultFacebookConnectionId: id } }, `facebook-${id}`)).rejects.toMatchObject({ status });
      expect(rows.has(`agencies/a/assistantExecutions/facebook-${id}`)).toBe(false);
    }
    await executeAction(ctx, { kind: 'update_property', propertyId: 'p', expectedUpdatedAt: null, patch: { defaultFacebookConnectionId: 'own' } }, 'facebook-own');
    expect(rows.get('agencies/a/properties/p')?.defaultFacebookConnectionId).toBe('own');
    expect(rows.get('agencies/a/assistantExecutions/facebook-own')?.status).toBe('completed');
  });
  it('records notification reading only in the actor own collection and clears its date on unread', async () => {
    const { ctx, rows } = database({ 'users/u/notifications/n': { isRead: false }, 'users/other/notifications/private': { isRead: false } });
    await executeAction(ctx, { kind: 'notification_action', action: 'read', notificationId: 'n' }, 'read-n');
    expect(rows.get('users/u/notifications/n')).toMatchObject({ isRead: true, readAt: expect.any(String) });
    await executeAction(ctx, { kind: 'notification_action', action: 'unread', notificationId: 'n' }, 'unread-n');
    expect(rows.get('users/u/notifications/n')).toMatchObject({ isRead: false, readAt: null });
    await expect(executeAction(ctx, { kind: 'notification_action', action: 'read', notificationId: 'private' }, 'other-n')).rejects.toMatchObject({ status: 404 });
    expect(rows.get('users/other/notifications/private')).toEqual({ isRead: false });
  });
  it('rejects stale calendar edits/deletions atomically and permits a current edit only once', async () => {
    const revision = '2026-10-06T08:00:00Z';
    const { ctx, rows } = database({
      'agencies/a/tasks/t': { description: 'Current', status: 'completed', updatedAt: revision },
      'agencies/a/viewings/v': { status: 'scheduled', updatedAt: revision },
    });
    const staleActions = [
      { kind: 'update_task', taskId: 't', expectedUpdatedAt: null, description: 'Stale' },
      { kind: 'delete_task', taskId: 't', expectedUpdatedAt: null },
      { kind: 'update_viewing', viewingId: 'v', expectedUpdatedAt: null, status: 'cancelled' },
      { kind: 'delete_viewing', viewingId: 'v', expectedUpdatedAt: null },
    ];
    for (const [index, input] of staleActions.entries()) {
      await expect(executeAction(ctx, actionSchema.parse(input), `stale-calendar-${index}`)).rejects.toMatchObject({ status: 409 });
      expect(rows.has(`agencies/a/assistantExecutions/stale-calendar-${index}`)).toBe(false);
    }
    expect(rows.get('agencies/a/tasks/t')?.description).toBe('Current');
    expect(rows.get('agencies/a/viewings/v')?.status).toBe('scheduled');
    const action = actionSchema.parse({ kind: 'update_task', taskId: 't', expectedUpdatedAt: revision, description: 'Accepted' });
    await executeAction(ctx, action, 'current-calendar');
    expect(rows.get('agencies/a/tasks/t')).toMatchObject({ description: 'Accepted' });
    expect(rows.get('agencies/a/tasks/t')).not.toHaveProperty('expectedUpdatedAt');
    await expect(executeAction(ctx, { kind: 'delete_task', taskId: 't', expectedUpdatedAt: revision }, 'second-calendar')).rejects.toMatchObject({ status: 409 });
    await executeAction(ctx, action, 'current-calendar'); // Idempotent retry returns its ledger.
    expect(rows.get('agencies/a/tasks/t')?.description).toBe('Accepted');
  });
  it('prepares a tracked email once, retaining document versions without claiming delivery', async () => {
    const { ctx, rows } = database({ 'agencies/a/sales/s': { agentId: 'u', trackingCode: 'IMO-123', checklist: [{ id: 'doc', label: 'Act', fileName: 'Act.pdf', downloadUrl: 'https://storage.example/act.pdf', version: 1 }] } });
    const action = actionSchema.parse({ kind: 'prepare_sale_email', saleId: 's', to: ['owner@example.com'], subject: 'Documente', bodyText: 'Salut', questions: [{ id: 'q', text: 'Confirmi?', required: true }], documentIds: ['doc'] });
    const result = await executeAction(ctx, action, 'email');
    expect(result).toMatchObject({ status: 'prepared', messageId: 'email', gmailPrepared: true });
    expect(rows.get('agencies/a/sales/s/emailMessages/email')).toMatchObject({ subject: 'Documente [IMO-123]', bodyText: 'Salut\n\nÎntrebări pentru confirmare:\n1. Confirmi?', sendEvidence: { level: 'none' }, attachmentRefs: [{ documentId: 'doc', version: 1 }] });
    expect(await executeAction(ctx, action, 'email')).toEqual(result);
    rows.set('agencies/a/sales/s', { agentId: 'other', trackingCode: 'IMO-123' });
    await expect(executeAction(ctx, action, 'email')).rejects.toThrow('revocat');
    expect(rows.has('agencies/a/sales/s/emailMessages/other')).toBe(false);
  });
  it('cancels only undispatched calls and protects newer call state and opt-out', async () => {
    const { ctx, rows } = database({ 'agencies/a/aiOutreachCalls/c': { ownerListingId: 'l', status: 'scheduled' }, 'agencies/a/aiOutreachCalls/live': { ownerListingId: 'l', status: 'calling', vapiCallId: 'remote' } });
    await executeAction(ctx, { kind: 'outreach_call_action', callId: 'c', action: 'cancel', reason: 'Agent request' }, 'cancel');
    expect(rows.get('agencies/a/aiOutreachCalls/c')?.status).toBe('canceled');
    await expect(executeAction(ctx, { kind: 'outreach_call_action', callId: 'live', action: 'cancel', reason: 'Agent request' }, 'cancel-live')).rejects.toThrow('furnizor');
    rows.set('agencies/a/aiOutreachOwnerListingStatuses/l', { latestAiCallId: 'newer' });
    await expect(executeAction(ctx, { kind: 'outreach_call_action', callId: 'c', action: 'manual_outcome', outcome: 'collaborates', reason: 'Owner confirmed' }, 'old')).rejects.toThrow('mai nou');
    rows.set('agencies/a/aiOutreachOwnerListingStatuses/l', { latestAiCallId: 'c', aiDoNotCall: true });
    await executeAction(ctx, { kind: 'outreach_call_action', callId: 'c', action: 'manual_outcome', outcome: 'collaborates', reason: 'Owner confirmed' }, 'outcome');
    expect(rows.get('agencies/a/aiOutreachOwnerListingStatuses/l')?.aiDoNotCall).toBe(true);
    await executeAction(ctx, { kind: 'outreach_call_action', callId: 'c', action: 'revoke_do_not_call', reason: 'Agent explicitly confirms revocation' }, 'revoke');
    expect(rows.get('agencies/a/aiOutreachOwnerListingStatuses/l')?.aiDoNotCall).toBe(false);
  });
  it('keeps email overrides and enabled templates private to the requesting agent', async () => {
    const { ctx, rows } = database({ 'agencies/a/salesEmailTemplates/t': { version: 2, variables: ['agent.name'] }, 'users/other': { agencyId: 'a', role: 'agent', enabledSalesEmailTemplateIds: ['other'] } });
    await executeAction(ctx, { kind: 'email_template_preference', templateId: 't', action: 'enable' }, 'enable');
    expect(rows.get('users/u')?.enabledSalesEmailTemplateIds).toEqual(['t']);
    const data = { name: 'Personal', description: '', recipientRole: 'buyer' as const, stage: 'any' as const, subject: 'Salut', body: 'Mesaj', bodyHtml: '<p>Mesaj</p><script>alert(1)</script>', defaultCc: [], defaultQuestions: [] };
    await executeAction(ctx, { kind: 'email_template_preference', templateId: 't', action: 'override', data }, 'override');
    expect(rows.get('users/u/emailTemplateOverrides/t')).toMatchObject({ baseTemplateId: 't', baseVersion: 2, updatedByUid: 'u' });
    expect(rows.get('users/u/emailTemplateOverrides/t')?.bodyHtml).not.toContain('<script');
    expect(rows.get('users/other')?.enabledSalesEmailTemplateIds).toEqual(['other']);
    await executeAction(ctx, { kind: 'email_template_preference', templateId: 't', action: 'reset' }, 'reset');
    expect(rows.has('users/u/emailTemplateOverrides/t')).toBe(false);
    expect(rows.get('users/u')?.enabledSalesEmailTemplateIds).toEqual(['t']);
    await expect(executeAction(ctx, { kind: 'email_template_preference', templateId: 'missing', action: 'enable' }, 'missing-template')).rejects.toThrow('biblioteca');
  });
  it('rejects stale contact edits without committing a ledger or changing the client', async () => {
    const { ctx, rows } = database({ 'agencies/a/contacts/c': { name: 'Recent', updatedAt: '2026-10-05T10:00:00Z' } });
    await expect(executeAction(ctx, { kind: 'update_contact', contactId: 'c', expectedUpdatedAt: null, patch: { name: 'Old' } }, 'stale')).rejects.toThrow('modificat');
    expect(rows.get('agencies/a/contacts/c')?.name).toBe('Recent');
    expect(rows.has('agencies/a/assistantExecutions/stale')).toBe(false);
    await executeAction(ctx, { kind: 'update_contact', contactId: 'c', expectedUpdatedAt: '2026-10-05T10:00:00Z', patch: { name: 'Accepted' } }, 'current');
    expect(rows.get('agencies/a/contacts/c')?.name).toBe('Accepted');
  });
  it('initializes prospecting only from an available canonical owner listing', async () => {
    const { ctx, rows } = database({ 'ownerListings/l': { publicationStatus: 'ready', isCanonical: true }, 'ownerListings/hidden': { publicationStatus: 'ready', isCanonical: false } });
    await executeAction(ctx, { kind: 'update_prospect', listingId: 'l', patch: { state: 'reserved' } }, 'reserve-new');
    expect(rows.get('agencies/a/ownerListingFavorites/l')).toMatchObject({ ownerListingId: 'l', isFavoriteActive: true, reservedByAgentId: 'u' });
    await expect(executeAction(ctx, { kind: 'update_prospect', listingId: 'hidden', patch: { state: 'taken' } }, 'hidden')).rejects.toThrow('disponibil');
    await expect(executeAction(ctx, { kind: 'update_prospect', listingId: 'missing', patch: { ownerPhone: '0722334455' } }, 'missing')).rejects.toThrow('prospectare');
    expect(rows.has('agencies/a/ownerListingFavorites/hidden')).toBe(false);
  });
  it('updates own profile and public projection without changing membership', async () => {
    const { ctx, rows } = database({});
    await executeAction(ctx, { kind: 'update_profile', patch: { name: 'Nume nou', phone: '0722111222' } }, 'profile');
    expect(rows.get('users/u')).toMatchObject({ agencyId: 'a', role: 'agent', name: 'Nume nou' });
    expect(rows.get('publicAgentProfiles/u')).toMatchObject({ agencyId: 'a', name: 'Nume nou', phone: '0722111222' });
    expect(actionSchema.safeParse({ kind: 'update_profile', patch: { role: 'admin' } }).success).toBe(false);
  });
  it('merges notification categories and denies agent agency administration', async () => {
    const { ctx, rows } = database({ 'users/u/notificationPreferences/default': { categories: { inboxMessages: false, taskUpdates: true } } });
    await executeAction(ctx, { kind: 'update_notification_preferences', patch: { categories: { taskUpdates: false } } }, 'notifications');
    expect(rows.get('users/u/notificationPreferences/default')?.categories).toMatchObject({ inboxMessages: false, taskUpdates: false });
    await expect(executeAction(ctx, { kind: 'update_agency', patch: { name: 'Agenție' } }, 'agency')).rejects.toThrow('administratorul');
  });
  it('preserves the manual task date and all participant/time fields', async () => {
    const { ctx, rows } = database({});
    const action = actionSchema.parse({ kind: 'create_task', description: 'Sună clientul', dueDate: '2026-10-06', startTime: '14:30', duration: 30, participantName: 'Maria', participantPhone: '0722334455' });
    await executeAction(ctx, action, 'task');
    expect(rows.get('agencies/a/tasks/task')).toMatchObject({ dueDate: '2026-10-06', startTime: '14:30', duration: 30, participantName: 'Maria', participantPhone: '0722334455' });
    expect(actionSchema.safeParse({ ...action, dueDate: '2026-02-31' }).success).toBe(false);
  });
  it('validates assigned task agents within the agency and supports unassigned tasks', async () => {
    const { ctx, rows } = database({ 'users/peer': { agencyId: 'a', role: 'agent', name: 'Peer' }, 'users/foreign': { agencyId: 'other', role: 'agent' } });
    await executeAction(ctx, { kind: 'create_task', description: 'Follow-up', dueDate: '2026-10-06', agentId: 'peer' }, 'assigned');
    expect(rows.get('agencies/a/tasks/assigned')).toMatchObject({ agentId: 'peer', agentName: 'Peer' });
    await expect(executeAction(ctx, { kind: 'create_task', description: 'Follow-up', dueDate: '2026-10-06', agentId: 'foreign' }, 'invalid')).rejects.toThrow('Agent invalid');
    await executeAction(ctx, { kind: 'create_task', description: 'Follow-up', dueDate: '2026-10-06', agentId: null }, 'unassigned');
    expect(rows.get('agencies/a/tasks/unassigned')?.agentId).toBeNull();
  });
  it('accepts full property fields but not role/status/ownership injection through a patch', () => {
    expect(actionSchema.parse({ kind: 'update_property', propertyId: 'p', patch: { floor: '3', constructionYear: 2018, totalFloors: 8, city: 'București', nearMetro: true } }).kind).toBe('update_property');
    for (const patch of [{ agentId: 'other' }, { status: 'Activ' }, { latitude: 100 }, { constructionYear: 1700 }]) expect(actionSchema.safeParse({ kind: 'update_property', propertyId: 'p', patch }).success).toBe(false);
  });
  it('saves the property form and lifecycle atomically, preserves portal metadata and rejects stale changes', async () => {
    const { ctx, rows } = database({ 'agencies/a/properties/p': { status: 'Activ', title: 'Old', updatedAt: '2026-01-01T00:00:00Z', agentId: 'u', portalProfiles: { imobiliare: { customReference: 'REMOTE', lastPayloadHash: 'original' }, storia: { remoteUuid: 'STORIA' } } } });
    const action = actionSchema.parse({ kind: 'update_property', propertyId: 'p', expectedUpdatedAt: '2026-01-01T00:00:00Z', patch: { title: 'New', portalProfiles: { imobiliare: { locationId: 100, locationLabel: 'Titan' } } }, statusChange: { status: 'Rezervat', reason: 'reservation_documents_pending' } });
    await executeAction(ctx, action, 'form');
    expect(rows.get('agencies/a/properties/p')).toMatchObject({ title: 'New', status: 'Rezervat', portalProfiles: { imobiliare: { customReference: 'REMOTE', lastPayloadHash: 'original', locationId: 100 }, storia: { remoteUuid: 'STORIA' } } });
    expect(rows.get('agencies/a/propertyStatusEvents/form')?.propertySnapshot.title).toBe('New');
    await expect(executeAction(ctx, action, 'stale')).rejects.toThrow('între timp');
  });
  it('matches manual agency assignment rights while refusing another tenant agent', async () => {
    const { ctx, rows } = database({ 'agencies/a/properties/p': { title: 'Property' }, 'users/other': { agencyId: 'a', role: 'agent', name: 'Other' }, 'users/outsider': { agencyId: 'b', role: 'agent' } });
    await executeAction(ctx, { kind: 'assign_record', resource: 'properties', id: 'p', agentId: 'other' }, 'assign');
    expect(rows.get('agencies/a/properties/p')?.agentId).toBe('other');
    await expect(executeAction(ctx, { kind: 'assign_record', resource: 'properties', id: 'p', agentId: 'outsider' }, 'bad')).rejects.toThrow('agenției');
  });
  it('discovers Romanian field names and destructive verbs with a bounded native catalog', () => {
    expect(selectActionTools('Schimbă etajul apartamentului', ['update_property', 'create_task', 'schedule_viewing'])).toContain('update_property');
    expect(selectActionTools('Șterge oferta clientului', ['delete_offer', 'create_property'])).toEqual(['delete_offer']);
    expect(capabilityScore('telefonează proprietarului', 'outreach_start')).toBeGreaterThan(0);
  });
  it('rejects the alternate activation path when mandatory property data is missing', async () => {
    const { ctx, rows } = database({ 'agencies/a/properties/p': { status: 'Inactiv', title: 'Draft' } });
    await expect(executeAction(ctx, { kind: 'update_property_status', propertyId: 'p', status: 'Activ', notes: '' }, 'activate')).rejects.toThrow('Completează');
    expect(rows.get('agencies/a/properties/p')?.status).toBe('Inactiv');
  });
  it('creates the same budget defaults as the manual contact form and refuses an existing phone', async () => {
    const { ctx, rows } = database({});
    const action = actionSchema.parse({ kind: 'create_contact', name: 'Maria', phone: '0722334455', budget: 100000, city: 'București' });
    await executeAction(ctx, action, 'contact');
    expect(rows.get('agencies/a/contacts/contact')?.preferences).toMatchObject({ desiredPriceRangeMin: 80000, desiredPriceRangeMax: 120000, locationPreferences: 'București' });
    await expect(executeAction(ctx, action, 'other')).rejects.toThrow('există deja');
    await expect(executeAction(ctx, actionSchema.parse({ ...action, phone: '+40 722 334 455' }), 'formatted')).rejects.toThrow('există deja');
  });
  it('releases an old identity only after replacing it and prevents an email collision', async () => {
    const { ctx, rows } = database({});
    await executeAction(ctx, actionSchema.parse({ kind: 'create_contact', name: 'Maria', email: 'Maria@EXAMPLE.com' }), 'first');
    await expect(executeAction(ctx, actionSchema.parse({ kind: 'create_contact', name: 'Second', email: 'maria@example.com' }), 'second')).rejects.toThrow('există deja');
    await executeAction(ctx, { kind: 'update_contact', contactId: 'first', patch: { email: 'new@example.com' } }, 'replace');
    await executeAction(ctx, actionSchema.parse({ kind: 'create_contact', name: 'Second', email: 'maria@example.com' }), 'second');
    expect(rows.get('agencies/a/contacts/first')?.normalizedEmail).toBe('new@example.com');
  });
  it('converts a Storia lead once with source metadata and initialized preferences', async () => {
    const { ctx, rows } = database({ 'agencies/a/storiaInboxLeads/l': { senderName: 'Maria', senderPhone: '0722334455', senderEmail: 'maria@example.com', propertyId: 'p', conversationId: 'remote', latestMessage: 'Vreau o vizionare' }, 'agencies/a/properties/p': { title: 'Apartament', city: 'București', zone: 'Titan' } });
    await executeAction(ctx, { kind: 'storia_lead_action', action: 'convert', leadId: 'l' }, 'convert');
    const repeat = await executeAction(ctx, { kind: 'storia_lead_action', action: 'convert', leadId: 'l' }, 'repeat');
    expect(rows.get('agencies/a/contacts/convert')).toMatchObject({ source: 'Storia', sourceLeadId: 'l', sourcePropertyId: 'p', sourceMetadata: { conversationId: 'remote' }, preferences: { locationPreferences: 'București' }, normalizedPhone: '40722334455' });
    expect(repeat).toMatchObject({ contactId: 'convert', reused: true });
    expect(rows.has('agencies/a/contacts/repeat')).toBe(false);
  });
  it('links a Storia lead to the existing contact without overwriting its preferences', async () => {
    const { ctx, rows } = database({ 'agencies/a/storiaInboxLeads/l': { senderName: 'Maria', senderPhone: '+40 722334455' }, 'agencies/a/contacts/c': { phone: '0722334455', normalizedPhone: '40722334455', name: 'Existing', preferences: { desiredRooms: 3 } } });
    expect(await executeAction(ctx, { kind: 'storia_lead_action', action: 'convert', leadId: 'l' }, 'convert')).toMatchObject({ contactId: 'c', reused: true });
    expect(rows.get('agencies/a/contacts/c')).toMatchObject({ name: 'Existing', preferences: { desiredRooms: 3 } });
  });
  it('allows an unchanged legacy duplicate identity during editing and rejects changing it to another identity', async () => {
    const { ctx, rows } = database({ 'agencies/a/contacts/c': { phone: '0722334455' }, 'agencies/a/contacts/other': { phone: '0722334455' }, 'agencies/a/contacts/third': { phone: '0733333333', normalizedPhone: '40733333333' } });
    await executeAction(ctx, { kind: 'update_contact', contactId: 'c', patch: { phone: '0722334455', name: 'Updated' } }, 'edit');
    expect(rows.get('agencies/a/contacts/c')?.name).toBe('Updated');
    await expect(executeAction(ctx, { kind: 'update_contact', contactId: 'c', patch: { phone: '+40 733333333' } }, 'bad')).rejects.toThrow('există deja');
  });
  it('changes/removes the identified offer and binds replays to the original payload', async () => {
    const { ctx, rows } = database({ 'agencies/a/contacts/c': { offers: [{ id: 'o', price: 100, status: 'În așteptare' }] } });
    const action = actionSchema.parse({ kind: 'update_offer', contactId: 'c', offerId: 'o', patch: { status: 'Acceptată' } });
    await executeAction(ctx, action, 'offer'); await executeAction(ctx, action, 'offer');
    expect(rows.get('agencies/a/contacts/c')?.offers[0].status).toBe('Acceptată');
    await expect(executeAction(ctx, { ...action, patch: { price: 200 } } as any, 'offer')).rejects.toThrow('altei comenzi');
    await executeAction(ctx, { kind: 'delete_offer', contactId: 'c', offerId: 'o' }, 'delete');
    expect(rows.get('agencies/a/contacts/c')?.offers).toEqual([]);
  });
  it('denies prospect modification reserved by another agent', async () => {
    const { ctx } = database({ 'agencies/a/ownerListingFavorites/l': { reservedByAgentId: 'other', isFavoriteActive: true } });
    await expect(executeAction(ctx, { kind: 'update_prospect', listingId: 'l', patch: { contactOutcome: 'negative' } }, 'prospect')).rejects.toThrow('alt agent');
  });
  it('allows taking an expired reservation and replaces all stale ownership metadata', async () => {
    const { ctx, rows } = database({ 'agencies/a/ownerListingFavorites/l': { reservedByAgentId: 'other', reservedByAgentName: 'Other', reservedAt: '2020-01-01T00:00:00Z', isFavoriteActive: true, contactOutcomeAt: 'old' } });
    await executeAction(ctx, { kind: 'update_prospect', listingId: 'l', patch: { state: 'taken' } }, 'take');
    expect(rows.get('agencies/a/ownerListingFavorites/l')).toMatchObject({ reservedByAgentId: 'u', reservedByAgentName: 'Agent', takenByAgentId: 'u', contactOutcomeAt: null, contactOutcomeByAgentId: null });
  });
  it('protects a taken prospect even when its original reservation has expired', async () => {
    const { ctx } = database({ 'agencies/a/ownerListingFavorites/l': { reservedByAgentId: 'u', reservedAt: '2020-01-01T00:00:00Z', takenByAgentId: 'other', isFavoriteActive: true } });
    await expect(executeAction(ctx, { kind: 'update_prospect', listingId: 'l', patch: { state: 'reserved' } }, 'take')).rejects.toThrow('alt agent');
  });
  it('accepts the rental lifecycle and canonical location fields', async () => {
    const { ctx, rows } = database({ 'agencies/a/properties/p': { status: 'Activ', title: 'Apartament' } });
    const action = actionSchema.parse({ kind: 'update_property_status', propertyId: 'p', status: 'Închiriat' });
    await executeAction(ctx, action, 'rented');
    expect(rows.get('agencies/a/properties/p')?.status).toBe('Închiriat');
    expect(actionSchema.safeParse({ kind: 'update_property', propertyId: 'p', patch: { amenities: ['Metrou'], cadastralNumber: '123', locationProfile: { primary: { provider: 'imobiliare', locationId: 100, depth: 3, county: 'București', locality: 'București', zone: 'Titan', display: 'Titan' }, source: 'manual' } } }).success).toBe(true);
  });
  it('creates a Sales dossier through the existing constructor and rejects duplicate creation', async () => {
    const { ctx, rows } = database({ 'agencies/a/properties/p': { title: 'Apartament', address: 'Titan', status: 'Activ', agentId: 'u', price: 130000 } });
    await executeAction(ctx, { kind: 'create_sale', propertyId: 'p' }, 'sale');
    expect(rows.get('agencies/a/sales/p')).toMatchObject({ agencyId: 'a', propertyId: 'p', agentId: 'u', agreedPrice: 130000 });
    await expect(executeAction(ctx, { kind: 'create_sale', propertyId: 'p' }, 'second')).rejects.toThrow('există deja');
  });
  it('revalidates membership even for an already completed action', async () => {
    const { ctx, rows } = database({ 'agencies/a/contacts/c': { offers: [{ id: 'o' }] } });
    const action = { kind: 'update_offer', contactId: 'c', offerId: 'o', patch: { price: 100 } } as const;
    await executeAction(ctx, action, 'offer'); rows.set('users/u', { agencyId: 'other', role: 'agent' });
    await expect(executeAction(ctx, action, 'offer')).rejects.toThrow('revocat');
  });
});
