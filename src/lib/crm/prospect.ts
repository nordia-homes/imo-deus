export const OWNER_RESERVATION_TTL_MS = 4 * 60 * 60 * 1000;

export function prospectOwner(row: Record<string, any>, at: number): string | null {
  if (row.takenByAgentId) return row.takenByAgentId;
  if (row.contactOutcome && row.contactOutcomeByAgentId) return row.contactOutcomeByAgentId;
  const reservedAt = Date.parse(row.reservedAt || '');
  if (row.reservedByAgentId && Number.isFinite(reservedAt) && at >= reservedAt + OWNER_RESERVATION_TTL_MS) return null;
  return row.reservedByAgentId || null;
}

export function prospectPatch(row: Record<string, any>, patch: Record<string, any>, uid: string, name: string, now: string) {
  const { state, ...fields } = patch;
  const resetOutcome = { contactOutcome: null, contactOutcomeAt: null, contactOutcomeByAgentId: null, contactOutcomeByAgentName: null };
  const resetTaken = { takenByAgentId: null, takenByAgentName: null, takenAt: null };
  const ownershipChanged = prospectOwner(row, Date.parse(now)) !== uid;
  return {
    ...fields, updatedAt: now, updatedBy: uid,
    ...(fields.contactOutcome !== undefined ? { ...resetTaken, contactOutcomeAt: fields.contactOutcome ? now : null, contactOutcomeByAgentId: fields.contactOutcome ? uid : null, contactOutcomeByAgentName: fields.contactOutcome ? name : null } : {}),
    ...(state ? { isFavoriteActive: true, ...resetOutcome,
      reservedByAgentId: ownershipChanged || state === 'reserved' ? uid : row.reservedByAgentId || uid,
      reservedByAgentName: ownershipChanged || state === 'reserved' ? name : row.reservedByAgentName || name,
      reservedAt: ownershipChanged || state === 'reserved' ? now : row.reservedAt || now,
      ...(state === 'reserved' ? { ...resetTaken, removedAt: null, removedBy: null, removedByName: null } : { takenByAgentId: uid, takenByAgentName: name, takenAt: now }),
    } : {}),
  };
}
