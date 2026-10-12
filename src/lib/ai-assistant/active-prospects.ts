import { prospectOwner } from '@/lib/crm/prospect';

/** Use the CRM ownership rules, including the four-hour reservation expiry. */
export function ownActiveProspects(rows: Record<string, unknown>[], uid: string, at: number) {
  return rows.filter(row => row.isFavoriteActive === true && prospectOwner(row, at) === uid).map(row => ({
    id: row.id, title: row.title || null, ownerName: row.ownerName || null,
    ownerPhone: row.ownerPhone || null, isFavoriteActive: true, agentId: uid,
    ownership: row.takenByAgentId ? 'taken' : row.contactOutcome && row.contactOutcomeByAgentId ? 'contact_outcome' : 'reserved',
    contactOutcome: row.contactOutcome || null, collaborationStatus: row.collaborationStatus || null,
  }));
}
