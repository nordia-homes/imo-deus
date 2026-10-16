import { createHash } from 'node:crypto';
import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';
import { defaultFacebookGroups, filterFacebookGroupsForProperty } from '@/lib/facebook-groups';
import { agencyPatchSchema } from '@/lib/crm/settings-fields';

export type FacebookSetupMode = 'accounts' | 'property-account' | 'groups' | 'sale' | 'rent' | 'blocked';
export function facebookSetupRequest(prompt: string): FacebookSetupMode | null {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  const commands: Record<string, FacebookSetupMode> = {
    'arata-mi conturile facebook conectate': 'accounts',
    'care cont facebook este setat pentru proprietatea aceasta': 'property-account',
    'arata-mi grupurile facebook configurate in agentie': 'groups',
    'gaseste grupurile eligibile pentru vanzare': 'sale',
    'gaseste grupurile eligibile pentru inchiriere': 'rent',
    'spune-mi exact ce conexiune facebook este blocata': 'blocked',
  };
  return commands[text] || null;
}
export function selectedFacebookProperty(history: AssistantMessage[]) {
  const page = history.find(row => row.id === 'current-page-context');
  const message = page || history.filter(row => row.role === 'assistant').at(-1);
  const rows = message?.cards?.filter(card => card.source === 'properties').flatMap(card => card.rows) || [];
  return rows.length === 1 && typeof rows[0].id === 'string' ? rows[0].id : null;
}
export function facebookConnectionSummary(id: string, row: Record<string, any>) {
  const status = ['connecting', 'connected', 'needs_reauthentication', 'error', 'disconnected'].includes(row.status) ? row.status : 'unknown';
  const reasons: Record<string, string> = { connected: 'Conexiune marcată conectată în aplicație', connecting: 'Autentificare încă în curs', needs_reauthentication: 'Necesită reconectare Facebook', error: 'Eroare de conexiune înregistrată; cauza exactă nu este verificată', disconnected: 'Cont deconectat', unknown: 'Starea conexiunii nu poate fi confirmată' };
  return { id, label: String(row.label || row.displayName || 'Cont Facebook'), status, reason: reasons[status], runnerMode: row.runnerMode === 'local' ? 'local' : 'cloud', lastVerifiedAt: Number.isFinite(Date.parse(row.lastVerifiedAt)) ? row.lastVerifiedAt : null };
}
export function facebookGroupSelection(stored: unknown, mode: FacebookSetupMode) {
  const configured = Array.isArray(stored) && stored.length > 0;
  const source = configured ? stored : defaultFacebookGroups;
  const valid = source.map(row => agencyPatchSchema.shape.facebookGroups.unwrap().element.safeParse(row));
  const groups = valid.flatMap(result => result.success ? [result.data] : []);
  const eligible = mode === 'sale' || mode === 'rent' ? filterFacebookGroupsForProperty(groups, mode === 'sale' ? 'Vanzare' : 'Inchiriere') : groups;
  const seen = new Set<string>();
  const rows = eligible.filter(group => !seen.has(group.url) && Boolean(seen.add(group.url))).map(group => ({ id: createHash('sha256').update(group.url).digest('hex').slice(0, 24), name: group.name, url: group.url, purpose: group.purpose, source: configured ? 'agency' : 'application_default' }));
  return { rows, configured, invalid: valid.filter(result => !result.success).length };
}
export async function readFacebookSetup(ctx: AssistantContext, mode: FacebookSetupMode, history: AssistantMessage[]) {
  const propertyId = mode === 'property-account' ? selectedFacebookProperty(history) : null;
  if (mode === 'property-account' && !propertyId) return { source: 'facebookSetup', rows: [], needsSelection: true, text: 'Deschide sau selectează o singură proprietate pentru a verifica setarea contului Facebook.' };
  return ctx.adminDb.runTransaction(async tx => {
    const agencyRef = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat.');
    if (['groups', 'sale', 'rent'].includes(mode)) {
      const agency = (await tx.get(agencyRef)).data();
      if (!agency) throw new Error('Agenție inexistentă.');
      const selected = facebookGroupSelection(agency.facebookGroups, mode);
      return { source: 'facebookGroups', rows: selected.rows, needsSelection: false, text: (selected.configured ? 'Grupuri din configurația agenției' : 'Agenția nu are grupuri configurate; aplicația folosește lista implicită') + ': ' + selected.rows.length + '. ' + (mode === 'groups' ? '' : 'Filtrare pentru ' + (mode === 'sale' ? 'vânzare' : 'închiriere') + ', inclusiv grupurile pentru ambele tipuri. ') + (selected.invalid ? selected.invalid + ' înregistrări invalide au fost excluse. ' : '') + 'Eligibilitatea este conform configurației, nu o confirmare a accesului sau aprobării administratorilor Facebook. Nu am creat joburi sau postări.' };
    }
    const snapshot = await tx.get(agencyRef.collection('facebookCloudConnections').where('ownerUid', '==', ctx.uid));
    const connections = await Promise.all(snapshot.docs.filter(doc => doc.data().agencyId === ctx.agencyId && !doc.data().deletedAt).map(async doc => {
      const raw = doc.data(), summary = facebookConnectionSummary(doc.id, raw);
      let localDeviceBlocked = false, runnerState = 'not_checked';
      if (summary.runnerMode === 'local') {
        const deviceId = typeof raw.deviceId === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(raw.deviceId) ? raw.deviceId : null;
        const device = deviceId ? (await tx.get(agencyRef.collection('facebookLocalRunnerDevices').doc(deviceId))).data() : null;
        localDeviceBlocked = !device || device.ownerUid !== ctx.uid || Boolean(device.revokedAt);
        runnerState = localDeviceBlocked ? 'unavailable' : ['online', 'offline', 'on_battery', 'error'].includes(device!.status) ? device!.status : 'unknown';
      }
      return { ...summary, publishingBlocked: summary.status !== 'connected' || localDeviceBlocked, runnerState, reason: localDeviceBlocked ? summary.reason + '; laptopul asociat lipsește, a fost revocat sau nu îți aparține' : summary.reason };
    }));
    connections.sort((a, b) => a.label.localeCompare(b.label, 'ro') || a.id.localeCompare(b.id));
    if (mode === 'property-account') {
      const property = (await tx.get(agencyRef.collection('properties').doc(propertyId!))).data();
      if (!property) throw new Error('Proprietate inexistentă.');
      const explicit = typeof property.defaultFacebookConnectionId === 'string' && property.defaultFacebookConnectionId;
      const target = explicit || profile.defaultFacebookCloudConnectionId;
      const connection = connections.find(row => row.id === target);
      if (!connection) return { source: 'facebookPropertyAccount', rows: [{ id: propertyId!, propertyId, configured: Boolean(target), accessible: false }], needsSelection: false, text: target ? 'Contul configurat nu este disponibil între conturile Facebook proprii active în aplicație. Nu am ales un alt cont.' : 'Proprietatea nu are un cont Facebook setat și profilul nu are un cont implicit. Nu am ales automat un cont.' };
      return { source: 'facebookPropertyAccount', rows: [{ ...connection, propertyId, selectionSource: explicit ? 'property' : 'profile_default' }], needsSelection: false, text: (explicit ? 'Cont setat pe proprietate: ' : 'Proprietatea nu are cont propriu setat. Contul implicit din profil este: ') + connection.label + ' (' + connection.id + '). ' + connection.reason + '. Stare salvată în aplicație; nu am verificat o sesiune Facebook în timp real și nu am publicat.' };
    }
    const rows = connections.filter(row => mode === 'accounts' ? row.status === 'connected' : row.publishingBlocked);
    return { source: 'facebookConnections', rows, needsSelection: false, text: (mode === 'accounts' ? 'Conturi proprii marcate conectate: ' : 'Conexiuni proprii blocate conform configurației: ') + rows.length + '.\n' + rows.map(row => row.label + ' (' + row.id + '): ' + row.reason).join('\n') + '\nStare salvată în aplicație. Nu am testat sesiunea, disponibilitatea laptopului/runnerului sau publicarea în grupuri.' };
  });
}