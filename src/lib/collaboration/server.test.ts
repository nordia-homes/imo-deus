import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { CollaborationLink, CollaborationListing } from './model';

vi.mock('@/lib/firebase-app-hosting', () => ({ verifyTokenAgainstAvailableBackends: vi.fn() }));
import { createLead, getActiveLink, getActiveListing } from './server';

class MemoryDb {
  docs = new Map<string, Record<string, unknown>>();
  writes: string[] = [];
  sequence = 0;
  collection(name: string) { return new MemoryCollection(this, name); }
}

class MemoryCollection {
  constructor(private db: MemoryDb, private path: string) {}
  doc(id = `new-${++this.db.sequence}`) { return new MemoryDoc(this.db, `${this.path}/${id}`, id); }
  where(field: string, _operator: string, value: unknown) { return new MemoryQuery(this.db, this.path, field, value); }
  async add(value: Record<string, unknown>) { const ref = this.doc(); await ref.set(value); return ref; }
}

class MemoryDoc {
  constructor(private db: MemoryDb, public path: string, public id: string) {}
  collection(name: string) { return new MemoryCollection(this.db, `${this.path}/${name}`); }
  async get() { const value = this.db.docs.get(this.path); return { exists: Boolean(value), data: () => value, id: this.id, ref: this }; }
  async set(value: Record<string, unknown>) { this.db.docs.set(this.path, value); this.db.writes.push(this.path); }
}

class MemoryQuery {
  constructor(private db: MemoryDb, private path: string, private field: string, private value: unknown) {}
  limit(_count: number) { return this; }
  async get() { const docs = [...this.db.docs.entries()].filter(([path, data]) => path.startsWith(`${this.path}/`) && path.slice(this.path.length + 1).indexOf('/') < 0 && data[this.field] === this.value).map(([path, data]) => ({ id: path.split('/').at(-1), data: () => data })); return { empty: !docs.length, docs }; }
}

const listing: CollaborationListing = {
  id: 'listing', sourceAgencyId: 'owner-agency', propertyId: 'property', ownerAgentUid: 'owner', ownerAgencyName: 'Owner Agency', ownerAgentName: 'Owner', ownerAgentPhone: '0711111111', ownerAgentEmail: 'owner@example.com',
  title: 'Apartament', description: 'Fișă aprobată', city: 'București', zone: 'Central', price: 100000, rooms: 2, squareFootage: 50, propertyType: 'Apartament', transactionType: 'Vânzare', images: [], terms: 'Comision agreat', status: 'active', createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z',
};
const link: CollaborationLink = { id: 'link', listingId: 'listing', collaboratorUid: 'partner', collaboratorOrganizationId: 'partner-agency', collaboratorName: 'Partner', collaboratorPhone: '0722222222', collaboratorEmail: 'partner@example.com', status: 'active', createdAt: '', updatedAt: '' };

describe('collaboration lead routing', () => {
  it('writes a buyer request only to the collaborator and their own CRM agency', async () => {
    const memory = new MemoryDb();
    memory.docs.set('users/partner', { agencyId: 'partner-agency' });
    const lead = await createLead(memory as unknown as Firestore, link, listing, { name: 'Buyer', email: 'buyer@example.com', phone: '0733333333', message: 'Vreau o vizionare', kind: 'viewing' });
    expect(lead.collaboratorUid).toBe('partner');
    expect(memory.writes).toContain(`collaborationLeads/${lead.id}`);
    expect(memory.writes.some(path => path.startsWith('agencies/partner-agency/contacts/'))).toBe(true);
    expect(memory.writes.some(path => path.startsWith('agencies/owner-agency/'))).toBe(false);
    expect(memory.writes.some(path => path.startsWith('users/partner/notifications/'))).toBe(true);
  });

  it('keeps an external collaborator buyer outside every CRM agency', async () => {
    const memory = new MemoryDb();
    memory.docs.set('users/partner', { accountType: 'collaborator_only' });
    await createLead(memory as unknown as Firestore, link, listing, { name: 'Buyer', email: 'buyer@example.com', phone: '0733333333', message: 'Detalii', kind: 'message' });
    expect(memory.writes.some(path => path.startsWith('agencies/'))).toBe(false);
  });

  it('projects only approved listing fields and current public status', async () => {
    const memory = new MemoryDb();
    memory.docs.set('collaborationListings/listing', listing as unknown as Record<string, unknown>);
    memory.docs.set('agencies/owner-agency/properties/property', { status: 'Activ', price: 110000, title: 'Apartament actualizat', agentId: 'owner', ownerPhone: '0799999999', notes: 'Privat' });
    memory.docs.set('users/owner', { agencyId: 'owner-agency', name: 'Owner', phone: '0711111111' });
    const result = await getActiveListing(memory as unknown as Firestore, 'listing');
    expect(result.price).toBe(110000);
    expect(result).not.toHaveProperty('ownerPhone');
    expect(result).not.toHaveProperty('notes');
  });

  it('closes a buyer link when its collaborator account is suspended', async () => {
    const memory = new MemoryDb();
    const token = 'a'.repeat(43);
    memory.docs.set(`collaborationLinks/${token}`, { ...link, id: token });
    memory.docs.set('users/partner', { accountType: 'collaborator_only', collaborationOrganizationId: 'partner-agency', collaborationStatus: 'suspended' });
    await expect(getActiveLink(memory as unknown as Firestore, token)).rejects.toThrow('Linkul nu mai este disponibil');
  });
});
