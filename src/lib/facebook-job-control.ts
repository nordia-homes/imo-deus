import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { defaultFacebookGroups, filterFacebookGroupsForProperty } from './facebook-groups';
import type { FacebookGroup } from './types';
export function facebookControlError(message: string, status = 409): never { throw Object.assign(new Error(message), { status }); }
export function assertFacebookPropertyAvailable(row: Record<string, any> | undefined, agencyId: string) {
  if (!row || row.deletedAt || row.agencyId && row.agencyId !== agencyId) facebookControlError('Proprietatea nu mai este accesibilă pentru publicare.', 404);
  const status = String(row.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (['inactiv', 'vandut', 'inchiriat'].includes(status)) facebookControlError('Proprietatea nu mai este activă pentru publicare. Verifică starea din CRM.');
}
export function assertFacebookJobOwner(row: Record<string, any>, agencyId: string, uid: string) {
  if (row.agencyId !== agencyId || row.ownerUid !== uid || row.deletedAt) facebookControlError('Jobul nu este accesibil.', 403);
}
export function assertFacebookControlState(row: Record<string, any>, cancel: boolean) {
  if (cancel ? !['scheduled', 'queued', 'running', 'cooldown', 'error', 'needs_reauthentication', 'cancelled'].includes(row.status) : row.status !== 'scheduled' || Boolean(row.actualStartedAt) || Boolean(row.leaseToken) || !Array.isArray(row.groups) || row.groups.some((g: any) => g.status !== 'queued')) facebookControlError('Starea jobului nu mai permite această modificare.');
}
// External runner payloads never replace ownership, lease or property fields.
export function verifiedFacebookRunnerControl(raw: any, existing: Record<string, any>, jobId: string, expected: Record<string, any>, cancel: boolean) {
  if (!raw || raw.id !== jobId || raw.agencyId !== existing.agencyId || raw.ownerUid !== existing.ownerUid || raw.propertyId !== existing.propertyId || raw.connectionId !== (expected.connectionId || existing.connectionId)) facebookControlError('Runnerul nu a confirmat identitatea jobului.');
  if (cancel) {
    if (raw.status !== 'cancelled') facebookControlError('Runnerul nu a confirmat anularea.');
    return { status: 'cancelled', nextRunAt: null, updatedAt: new Date().toISOString() };
  }
  const urls = (groups: any) => Array.isArray(groups) ? groups.map(g => g.url).sort().join('\n') : '';
  if (raw.status !== 'scheduled' || raw.scheduledAt !== expected.scheduledAt || urls(raw.groups) !== urls(expected.groups) || raw.groups.some((g: any) => g.status !== 'queued')) facebookControlError('Runnerul nu a confirmat programarea cerută.');
  return expected;
}
export async function commitFacebookControl(db: Firestore, agencyId: string, uid: string, snapshot: DocumentSnapshot, patch: Record<string, any>, cancel: boolean) {
  return db.runTransaction(async tx => {
    const agency = db.collection('agencies').doc(agencyId);
    const current = await tx.get(snapshot.ref), profile = (await tx.get(db.collection('users').doc(uid))).data();
    if (!profile || profile.agencyId !== agencyId || !['agent', 'admin'].includes(profile.role)) facebookControlError('Acces revocat.', 403);
    const row = current.data(); if (!row) facebookControlError('Jobul nu mai există.', 404);
    assertFacebookJobOwner(row, agencyId, uid);
    if (!current.updateTime?.isEqual(snapshot.updateTime!)) facebookControlError('Jobul s-a schimbat între timp. Recitește starea înainte de reluare.');
    assertFacebookControlState(row, cancel);
    if (!cancel) {
      const connection = (await tx.get(agency.collection('facebookCloudConnections').doc(patch.connectionId))).data();
      if (!connection || connection.ownerUid !== uid || connection.agencyId !== agencyId || connection.deletedAt || connection.status !== 'connected') facebookControlError('Contul Facebook trebuie reconectat sau nu mai este accesibil.');
      if ((connection.runnerMode === 'local') !== (row.runnerMode === 'local')) facebookControlError('Tipul runnerului s-a schimbat.');
      if (connection.runnerMode === 'local') {
        if (!connection.deviceId || connection.deviceId !== patch.deviceId) facebookControlError('Laptopul asociat s-a schimbat.');
        const device = (await tx.get(agency.collection('facebookLocalRunnerDevices').doc(connection.deviceId))).data();
        if (!device || device.ownerUid !== uid || device.revokedAt) facebookControlError('Laptopul asociat nu este disponibil pentru acest cont.');
      }
      const property = (await tx.get(agency.collection('properties').doc(row.propertyId))).data();
      const agencyData = (await tx.get(agency)).data();
      if (!property || !agencyData) facebookControlError('Proprietatea sau agenția nu mai există.');
      assertFacebookPropertyAvailable(property, agencyId);
      const stored = agencyData.facebookGroups;
      const groups = filterFacebookGroupsForProperty(Array.isArray(stored) && stored.length ? stored as FacebookGroup[] : defaultFacebookGroups, property.transactionType);
      if (!patch.groups.every((group: any) => groups.some(g => g.url === group.url))) facebookControlError('Grupurile eligibile s-au schimbat.');
      if (Date.parse(patch.scheduledAt) < Date.now() + 60_000) facebookControlError('Ora programării nu mai este în viitor.');
    }
    tx.update(snapshot.ref, patch);
    return { ...row, ...patch, id: snapshot.id };
  });
}
