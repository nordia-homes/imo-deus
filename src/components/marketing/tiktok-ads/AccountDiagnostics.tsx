'use client';
import { useEffect, useState } from 'react';
import type { TikTokAccountPermissionRecord } from '@/lib/tiktok-ads/types';
import { statusLabel } from '@/lib/tiktok-ads/workspace-model';
import { Button, PermissionChip } from './StudioPrimitives';
import { panelClass, type Api, type Workspace } from './workspace-types';

export const identityRouteLabel = (item: TikTokAccountPermissionRecord) => item.identityAuthorizedBcId ? `Business Center · ${item.identityAuthorizedBcId}` : 'Autorizare directă TikTok';
export function IdentityProfiles({ permissions }: { permissions: TikTokAccountPermissionRecord[] }) {
  // Two authorization routes may refer to one profile. Keep their permissions separate.
  const profiles = new Map<string, TikTokAccountPermissionRecord[]>();
  for (const item of permissions) {
    const key = `${item.advertiserId}:${item.username?.trim().toLowerCase() || item.tiktokAccountId}`;
    const routes = profiles.get(key) || [];
    if (!routes.some(route => route.tiktokAccountId === item.tiktokAccountId && route.identityAuthorizedBcId === item.identityAuthorizedBcId && route.identityType === item.identityType)) routes.push(item);
    profiles.set(key, routes);
  }
  return <section className={panelClass}><h2 className="font-semibold">Identități disponibile pentru reclame</h2>{[...profiles.entries()].map(([key, routes]) => <article key={key} className="tt-identity"><h3 className="font-semibold">@{routes[0].username || routes[0].tiktokAccountId}</h3>{routes.length > 1 && <p className="mt-1 text-sm text-slate-500">Un singur profil, {routes.length} căi de autorizare. Permisiunile se aplică separat fiecărei căi.</p>}{routes.map((item, index) => <div key={`${item.tiktokAccountId}:${index}`} className="mt-3 border-t pt-3"><p className="text-sm font-medium">{identityRouteLabel(item)}</p><p className="text-xs text-slate-500">{item.verificationStatus === 'verified' ? 'Verificat' : 'De verificat'} · {item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleString('ro-RO') : 'Niciodată'}</p><div className="tt-permissions"><PermissionChip allowed={!!item.deliverAds}>Livrare reclame</PermissionChip><PermissionChip allowed={!!item.existingPosts}>Postări existente</PermissionChip><PermissionChip allowed={!!item.publishAndManageNewVideos}>Videoclipuri noi</PermissionChip><PermissionChip allowed={!!item.onlyShowAsAds}>Exclusiv reclame</PermissionChip></div></div>)}</article>)}{!profiles.size && <p className="mt-3 text-sm text-slate-500">Nu există identități verificate. Verifică accesul contului.</p>}</section>;
}
const optionalFunctions: Record<string, [string, string]> = {
  ACCOUNT_REVIEW_READ: ['Verificarea detaliată a contului', 'Verifică starea contului prin „Verifică accesul” sau în TikTok Ads Manager.'],
  ADVERTISER_DISCOVERY: ['Descoperirea extinsă a conturilor', 'Folosește sincronizarea conturilor deja autorizate.'],
  ADVERTISER_PROVISION: ['Crearea unui cont publicitar nou', 'Creează contul în TikTok for Business, apoi autorizează-l aici.'],
  AD_REVIEW_READ: ['Motive detaliate de moderare', 'Consultă rezultatul verificării în TikTok Ads Manager.'],
  EVENT_SUBSCRIBE: ['Actualizări prin evenimente TikTok', 'Folosește Actualizează pentru citirea stării curente.'],
  LEAD_FORM_CREATE: ['Crearea formularelor TikTok', 'Creează formularul în TikTok Ads Manager; îl poți selecta aici dacă citirea formularelor este disponibilă.'],
  TIKTOK_ACCOUNT_AUTHORIZE: ['Autorizarea profilului prin integrare', 'Gestionează autorizarea identității în TikTok Business Center, apoi verifică accesul.'],
};
export function AccountDiagnostics({ workspace, onRefresh, refreshing = false }: { workspace: Workspace; onRefresh?: () => void; refreshing?: boolean }) {
  const unavailable = workspace.capabilities.filter(item => !item.executionAllowed);
  const failures = workspace.operations.filter(item => ['failed', 'partial', 'pending_recovery'].includes(item.status));
  return <details className={panelClass}><summary className="cursor-pointer font-semibold">Diagnostic și istoric operațiuni{failures.length ? ` · ${failures.length} de verificat` : ''}</summary><div className="mt-4 space-y-4 text-sm">{onRefresh && <Button variant="outline" disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Se reverifică…' : 'Reverifică funcțiile conexiunii'}</Button>}
    {unavailable.length > 0 && <div className="rounded-xl bg-slate-50 p-4"><h3 className="font-semibold">Funcții indisponibile în această conexiune</h3><p className="mt-1 text-slate-600">Acestea sunt limitări ale funcțiilor expuse sau ale autorizării, nu erori ale unor reclame. Nu toate funcțiile sunt necesare pentru publicare.</p>{unavailable.map(item => <div key={item.capability} className="mt-3"><strong>{optionalFunctions[item.capability]?.[0] || item.capability}</strong><p className="text-slate-500">{optionalFunctions[item.capability]?.[1] || 'Sincronizează funcțiile și verifică autorizarea contului. Operațiile care depind de această funcție rămân blocate.'}</p><p className="mt-1 text-xs text-slate-700">Diagnostic: {item.reason || 'Conexiunea nu a furnizat un motiv detaliat.'}</p><small className="text-slate-400">{item.capability} · {item.schemaStatus}{item.toolName ? ` · ${item.toolName}` : ' · fără endpoint detectat'}</small></div>)}</div>}
    <h3 className="font-semibold">Operații executate</h3>{!workspace.operations.length && <p className="text-slate-500">Nu există operații recente pentru acest cont. Lista de funcții de mai sus nu reprezintă operații eșuate.</p>}{workspace.operations.map(item => <article key={item.operationId} className="border-t py-2"><p>{item.capability} · {statusLabel(item.status)}</p><p className="text-xs text-slate-500">{item.operationId} · {item.currentStep} · {item.updatedAt ? new Date(item.updatedAt).toLocaleString('ro-RO') : ''}</p>{item.lastErrorCode && <p className="mt-1 text-rose-700">Cod eroare: {item.lastErrorCode}. Verifică accesul, permisiunile și detaliile operației înainte de reluare.</p>}{item.remoteOutcomeUnknown && <p className="text-amber-700">Rezultatul extern este necunoscut. Verifică resursele în TikTok înainte de a relua; nu crea din nou aceeași reclamă.</p>}</article>)}
  </div></details>;
}

export function DisconnectControl({ api, organic = false, connected, disabled, refreshToken, onDisconnected }: { api: Api; organic?: boolean; connected?: boolean; disabled?: boolean; refreshToken?: unknown; onDisconnected: () => Promise<unknown> }) {
  const [profileConnected, setProfileConnected] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { if (!organic) return; let live = true; void api<{ status: { connected: boolean } }>('/api/marketing/tiktok/status').then(data => { if (live) setProfileConnected(!!data.status.connected); }).catch(() => { if (live) setMessage('Starea profilului nu a putut fi verificată.'); }); return () => { live = false; }; }, [api, organic, refreshToken]);
  async function disconnect() {
    setBusy(true); setMessage('');
    try { await api(organic ? '/api/marketing/tiktok/disconnect' : '/api/marketing/tiktok-ads/disconnect', { method: 'POST' }); setProfileConnected(false); setConfirm(false); await onDisconnected(); setMessage('Conexiunea a fost eliminată din Imodeus.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Deconectarea nu a reușit.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 space-y-2">{(organic ? profileConnected : connected) && <Button variant="outline" disabled={disabled || busy} onClick={() => setConfirm(true)}>{organic ? 'Deconectează profilul TikTok' : 'Deconectează TikTok Ads'}</Button>}{confirm && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm"><p>{organic ? 'Se deconectează profilul personal pentru postări organice.' : 'Se elimină conexiunea TikTok Ads a întregii agenții, pentru toate conturile autorizate.'} Reclamele deja active în TikTok nu sunt oprite și pot continua să consume buget.</p><div className="mt-3 flex gap-2"><Button disabled={busy} variant="outline" onClick={() => setConfirm(false)}>Anulează deconectarea</Button><Button disabled={busy} onClick={() => void disconnect()}>Confirmă deconectarea</Button></div></div>}{message && <p role="status" className="text-sm">{message}</p>}</div>;
}
