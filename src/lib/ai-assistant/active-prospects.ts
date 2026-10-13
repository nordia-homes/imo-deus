import { prospectOwner, OWNER_RESERVATION_TTL_MS } from '@/lib/crm/prospect';
import { zonedParts } from './zoned-time';

export function otherAssignedProspects(rows: Record<string, unknown>[], uid: string, at: number) {
  return rows.flatMap(row => {
    const owner = prospectOwner(row, at);
    if (!owner || owner === uid) return [];
    const taken = !!row.takenByAgentId;
    const outcome = !taken && !!row.contactOutcome && !!row.contactOutcomeByAgentId;
    const reservedAt = typeof row.reservedAt === 'string' ? Date.parse(row.reservedAt) : NaN;
    const expires = !taken && !outcome && Number.isFinite(reservedAt) ? zonedParts(new Date(reservedAt + OWNER_RESERVATION_TTL_MS), 'Europe/Bucharest') : null;
    return [{ id: row.id, title: row.title || null, agentId: owner,
      agentName: (taken ? row.takenByAgentName : outcome ? row.contactOutcomeByAgentName : row.reservedByAgentName) || null,
      reservationState: taken || outcome ? 'not_applicable' : expires ? 'valid' : 'expiration_unknown',
      expiresLocal: expires ? `${expires.date} ${expires.time} (ora București)` : null,
      ownership: taken ? 'taken' : outcome ? 'contact_outcome' : 'reserved', isFavoriteActive: row.isFavoriteActive === true }];
  });
}

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
