import { prospectOwner, OWNER_RESERVATION_TTL_MS } from '@/lib/crm/prospect';
import { zonedParts } from './zoned-time';

/** Use the CRM ownership rules, including the four-hour reservation expiry. */
export function ownActiveProspects(rows: Record<string, unknown>[], uid: string, at: number) {
  return rows.filter(row => row.isFavoriteActive === true && prospectOwner(row, at) === uid).map(row => ({
    id: row.id, title: row.title || null, ownerName: row.ownerName || null,
    ownerPhone: row.ownerPhone || null, isFavoriteActive: true, agentId: uid,
    ownership: row.takenByAgentId ? 'taken' : row.contactOutcome && row.contactOutcomeByAgentId ? 'contact_outcome' : 'reserved',
    contactOutcome: row.contactOutcome || null, collaborationStatus: row.collaborationStatus || null,
  }));
}

export function otherReservedProspects(rows: Record<string, unknown>[], uid: string, at: number) {
  return rows.filter(row => row.isFavoriteActive === true && !row.takenByAgentId && !row.contactOutcome &&
    typeof row.reservedByAgentId === 'string' && row.reservedByAgentId !== uid && prospectOwner(row, at) === row.reservedByAgentId
  ).map(row => {
    const date = typeof row.reservedAt === 'string' ? Date.parse(row.reservedAt) : NaN;
    const local = Number.isFinite(date) ? zonedParts(new Date(date), 'Europe/Bucharest') : null;
    const expires = Number.isFinite(date) ? zonedParts(new Date(date + OWNER_RESERVATION_TTL_MS), 'Europe/Bucharest') : null;
    return { id: row.id, title: row.title || null, agentId: row.reservedByAgentId,
      agentName: row.reservedByAgentName || null, ownership: 'reserved',
      reservedLocal: local ? `${local.date} ${local.time} (ora București)` : null,
      expiresLocal: expires ? `${expires.date} ${expires.time} (ora București)` : null,
      expirationKnown: local !== null };
  });
}
