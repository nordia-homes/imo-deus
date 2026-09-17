'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { emptyAdDraft, statusLabel, type TikTokRow } from '@/lib/tiktok-ads/workspace-model';
import type { TikTokCapability } from '@/lib/tiktok-ads/types';
import { AdComposer, type SavedAdDraft } from './AdComposer';
import { VideoLibrary } from './VideoLibrary';
import { inputClass, panelClass, type Api, type Workspace } from './workspace-types';

type Tab = 'overview' | 'ads' | 'videos' | 'accounts';
type Kind = 'campaign' | 'adgroup' | 'ad';
type Change = { kind: Kind; row: TikTokRow; action: 'name' | 'budget' | 'pause' | 'resume'; value: string; commandId: string };
const tabs: Array<[Tab, string]> = [['overview', 'Prezentare'], ['ads', 'Reclame'], ['videos', 'Videoclipuri'], ['accounts', 'Conturi']];
const kinds: Array<[Kind, string]> = [['campaign', 'Campanii'], ['adgroup', 'Grupuri de reclame'], ['ad', 'Reclame']];
const today = () => new Date().toISOString().slice(0, 10);

export default function TikTokWorkspace({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const { user } = useUser();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [advertiserId, setAdvertiserId] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Kind>('campaign');
  const [rows, setRows] = useState<TikTokRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [propertyId, setPropertyId] = useState(params?.get('propertyId') || '');
  const [parent, setParent] = useState<{ kind: Kind; id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<SavedAdDraft | null>(null);
  const [drafts, setDrafts] = useState<SavedAdDraft[]>([]);
  const [change, setChange] = useState<Change | null>(null);
  const [report, setReport] = useState<Record<string, unknown>[] | null>(null);
  const [start, setStart] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [end, setEnd] = useState(today);
  const [syncedAt, setSyncedAt] = useState('');
  const generation = useRef(0);
  const api: Api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!user) throw new Error('Autentifică-te pentru a administra TikTok.');
    const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}`, ...init?.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error?.message || 'Cererea nu a reușit. Încearcă din nou.');
    return data as T;
  }, [user]);
  const loadWorkspace = useCallback(async (id = '') => {
    const request = ++generation.current;
    const data = await api<Workspace>(`/api/marketing/tiktok-ads/workspace${id ? `?advertiserId=${encodeURIComponent(id)}` : ''}`);
    if (request === generation.current) { setWorkspace(data); setAdvertiserId(data.advertiserId || ''); }
    return data;
  }, [api]);
  useEffect(() => { let live = true; if (user) void loadWorkspace().catch(error => { if (live) setNotice(error.message); }); return () => { live = false; }; }, [user, loadWorkspace]);
  useEffect(() => {
    if (!advertiserId) return;
    let live = true;
    void api<{ drafts: SavedAdDraft[] }>(`/api/marketing/tiktok-ads/drafts?advertiserId=${encodeURIComponent(advertiserId)}`).then(data => { if (live) setDrafts(data.drafts); }).catch(error => { if (live) setNotice(error.message); });
    return () => { live = false; };
  }, [api, advertiserId, draft]);
  const advertiser = workspace?.advertisers.find(item => item.advertiserId === advertiserId);
  const admin = !!workspace && workspace.role !== 'agent';
  async function run(action: () => Promise<void>) { setBusy(true); setNotice(''); try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Operația a eșuat.'); } finally { setBusy(false); } }
  async function switchAdvertiser(id: string) {
    generation.current++; setRows([]); setLoaded(false); setReport(null); setDrafts([]); setParent(null); setPage(1); setSyncedAt('');
    await loadWorkspace(id);
    if (admin) await api('/api/marketing/tiktok-ads/advertisers', { method: 'POST', body: JSON.stringify({ action: 'select', advertiserId: id }) });
  }
  async function loadRows(nextKind = kind, nextParent = parent) {
    const request = generation.current;
    const data = await api<{ rows: TikTokRow[] }>(`/api/marketing/tiktok-ads/manager?${new URLSearchParams({ advertiserId, kind: nextKind })}`);
    if (request !== generation.current) return;
    setKind(nextKind); setParent(nextParent); setRows(data.rows); setLoaded(true); setPage(1); setSyncedAt(new Date().toLocaleString('ro-RO'));
  }
  async function reconcile() {
    const failures: string[] = [];
    for (const capability of ['ADVERTISER_STATUS', 'BILLING_READINESS', 'TIKTOK_PERMISSION_READ'] satisfies TikTokCapability[]) {
      try { await api('/api/marketing/tiktok-ads/operations', { method: 'POST', body: JSON.stringify({ advertiserId, capability, payload: {} }) }); }
      catch (error) { failures.push(error instanceof Error ? error.message : capability); }
    }
    await loadWorkspace(advertiserId);
    setNotice(failures.length ? failures.join(' • ') : 'Contul și permisiunile au fost reverificate.');
  }
  async function connect(organic = false) {
    const result = await api<{ authorizationUrl: string }>(organic ? '/api/marketing/tiktok/connect' : '/api/marketing/tiktok-ads/connect?returnTo=/marketing/tiktok-ads');
    if (window.imodeusDesktop?.openOAuthWindow) {
      const auth = await window.imodeusDesktop.openOAuthWindow(result);
      if (auth.error) throw new Error(auth.error);
      if (auth.completed) await loadWorkspace(advertiserId);
      return;
    }
    window.location.assign(result.authorizationUrl);
  }
  function newDraft(asset?: { id: string; propertyId?: string | null; name: string }) {
    if (!advertiserId) { setTab('accounts'); setNotice('Conectează și selectează un cont publicitar.'); return; }
    setDraft({ id: crypto.randomUUID(), version: 0, data: { ...emptyAdDraft, propertyId: asset?.propertyId || propertyId, assetId: asset?.id || '', name: asset?.name || '' } });
  }
  async function prepare(row: TikTokRow, action: Change['action']) {
    const commandId = crypto.randomUUID();
    const data = await api<{ current: TikTokRow }>('/api/marketing/tiktok-ads/resources', { method: 'POST', body: JSON.stringify({ advertiserId, resourceId: row.id, kind, action, commandId, confirm: false }) });
    setChange({ kind, row: data.current, action, commandId, value: action === 'budget' ? data.current.budget || '' : data.current.name });
  }
  async function confirmChange() {
    if (!change) return;
    const data = await api<{ message: string }>('/api/marketing/tiktok-ads/resources', { method: 'POST', body: JSON.stringify({ advertiserId, resourceId: change.row.id, kind: change.kind, action: change.action, value: change.value, commandId: change.commandId, confirm: true, previousValue: change.row.budget }) });
    setChange(null); await loadRows(); setNotice(data.message);
  }
  async function loadReport() {
    if (start > end) throw new Error('Intervalul raportului nu este valid.');
    const request = generation.current;
    const data = await api<{ rows: Record<string, unknown>[] }>(`/api/marketing/tiktok-ads/manager?${new URLSearchParams({ advertiserId, kind: 'report', start, end })}`);
    if (request === generation.current) { setReport(data.rows); setSyncedAt(new Date().toLocaleString('ro-RO')); }
  }
  const filtered = rows.filter(row => (!query || `${row.name} ${row.id}`.toLowerCase().includes(query.toLowerCase())) && (!propertyId || row.propertyId === propertyId) && (!parent || (parent.kind === 'campaign' ? row.campaignId : row.adgroupId) === parent.id));
  const metrics = (key: string) => {
    if (!report?.length) return '—';
    const values = report.map(row => row[key]).filter(value => value != null && value !== '' && Number.isFinite(Number(value)));
    return values.length ? values.reduce<number>((sum, value) => sum + Number(value), 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 }) : '—';
  };

  return <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-700">Marketing · Agenție</p><h1 className="text-3xl font-semibold">TikTok</h1><p className="mt-1 text-sm text-slate-500">De la proprietate la videoclip și reclamă, într-un singur loc.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTab('videos')}>Videoclipuri</Button><Button disabled={!workspace || busy} onClick={() => newDraft()}>Creează reclamă</Button></div></header>
    <div className={`${panelClass} flex flex-wrap items-center gap-4`}><label className="min-w-56 flex-1 text-xs font-medium">Cont publicitar<select aria-label="Cont publicitar" className={`${inputClass} mt-1`} value={advertiserId} disabled={busy || !!draft || !!change} onChange={event => void run(() => switchAdvertiser(event.target.value))}><option value="" disabled>Selectează contul</option>{workspace?.advertisers.map(item => <option key={item.advertiserId} value={item.advertiserId}>{item.name || item.advertiserId}</option>)}</select></label><p className="text-sm text-slate-500">{advertiser ? `${advertiser.currency || 'Monedă necunoscută'} · ${advertiser.timezone || 'Fus orar necunoscut'} · ${advertiser.authorized ? 'Autorizat' : 'Neautorizat'}` : 'Niciun cont selectat'}</p><Button variant="outline" disabled={busy || !advertiserId} onClick={() => void run(reconcile)}>Verifică accesul</Button></div>
    {notice && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{notice}</div>}
    <nav aria-label="Secțiuni TikTok" className="flex flex-wrap gap-2 border-b pb-3">{tabs.map(([key, label]) => <Button key={key} variant={tab === key ? 'default' : 'ghost'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</Button>)}</nav>
    {!workspace ? <p role="status">{notice ? 'Pagina nu a putut fi încărcată.' : 'Se încarcă spațiul TikTok…'}</p> : <>
      {tab === 'overview' && <div className="space-y-5"><section className={panelClass}><div className="flex flex-wrap items-end gap-3"><div className="mr-auto"><h2 className="text-lg font-semibold">Rezultate din TikTok</h2><p className="text-sm text-slate-500">Date reale pentru contul selectat. Lipsa datelor nu înseamnă zero rezultate.</p></div><label className="text-xs">De la<input type="date" className={inputClass} value={start} onChange={event => { setStart(event.target.value); setReport(null); }} /></label><label className="text-xs">Până la<input type="date" className={inputClass} value={end} onChange={event => { setEnd(event.target.value); setReport(null); }} /></label><Button disabled={busy || !advertiserId} onClick={() => void run(loadReport)}>Încarcă raportul</Button></div><div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{[['spend', `Cheltuieli (${advertiser?.currency || '—'})`], ['impressions', 'Afișări'], ['clicks', 'Clickuri'], ['conversion', 'Conversii']].map(([key, label]) => <div key={key} className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{metrics(key)}</p></div>)}</div><p className="mt-3 text-xs text-slate-500">{report ? `${report.length} înregistrări raportate. Actualizat: ${syncedAt}. Conversiile depind de configurarea urmăririi.` : 'Încarcă un raport pentru intervalul ales.'}</p></section><section className={panelClass}><h2 className="font-semibold">Următorul pas</h2><p className="my-3 text-sm text-slate-600">Alege proprietatea, pregătește un videoclip, apoi construiește reclama. Reclamele noi sunt create oprite; activarea este o acțiune separată, cu confirmare.</p><div className="flex gap-2"><Button variant="outline" onClick={() => setTab('videos')}>1. Pregătește videoclipul</Button><Button onClick={() => newDraft()}>2. Creează reclama</Button></div></section></div>}
      {tab === 'ads' && <div className="space-y-5"><section className={panelClass}><div className="flex flex-wrap gap-2">{kinds.map(([key, label]) => <Button key={key} variant={kind === key ? 'default' : 'outline'} disabled={busy || !advertiserId} onClick={() => void run(() => loadRows(key, null))}>{label}</Button>)}<Button className="ml-auto" variant="outline" disabled={busy || !advertiserId} onClick={() => void run(() => loadRows())}>Actualizează</Button></div><div className="my-4 flex flex-wrap gap-3"><input aria-label="Caută reclame" className={`${inputClass} max-w-sm`} placeholder="Caută după nume sau ID" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /><select aria-label="Filtru proprietate" className={`${inputClass} max-w-sm`} value={propertyId} onChange={event => { setPropertyId(event.target.value); setPage(1); }}><option value="">Toate proprietățile</option>{workspace.properties.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>{parent && <Button variant="ghost" onClick={() => { setParent(null); setPage(1); }}>× {parent.name}</Button>}
        {!loaded ? <p className="py-10 text-center text-slate-500">Alege nivelul sau apasă Actualizează pentru a citi datele din TikTok.</p> : !filtered.length ? <p className="py-10 text-center text-slate-500">Nu există rezultate în lista încărcată pentru aceste filtre.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Nume / proprietate</th><th className="p-3">Stare</th><th className="p-3">Buget</th><th className="p-3">Acțiuni</th></tr></thead><tbody>{filtered.slice((page - 1) * 15, page * 15).map(row => <tr key={row.id} className="border-b"><td className="p-3"><button className="text-left font-medium hover:underline" disabled={kind === 'ad' || busy} onClick={() => void run(() => loadRows(kind === 'campaign' ? 'adgroup' : 'ad', { kind, id: row.id, name: row.name }))}>{row.name}</button><p className="text-xs text-slate-500">{workspace.properties.find(item => item.id === row.propertyId)?.title || 'Neasociată unei proprietăți'} · {row.id}</p></td><td className="p-3">{statusLabel(row.status)}{row.rejection && <p className="text-xs text-red-700">{row.rejection}</p>}</td><td className="p-3">{row.budget ? `${row.budget} ${advertiser?.currency || ''}` : '—'}</td><td className="p-3"><div className="flex gap-1"><Button size="sm" variant="ghost" disabled={!admin || busy} onClick={() => void run(() => prepare(row, 'name'))}>Nume</Button>{kind !== 'ad' && <Button size="sm" variant="ghost" disabled={!admin || busy} onClick={() => void run(() => prepare(row, 'budget'))}>Buget</Button>}<Button size="sm" variant="outline" disabled={!admin || busy} onClick={() => void run(() => prepare(row, /^(STATUS_)?ENABLE$/.test(row.status) ? 'pause' : 'resume'))}>{/^(STATUS_)?ENABLE$/.test(row.status) ? 'Oprește' : 'Activează'}</Button></div></td></tr>)}</tbody></table></div>}
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-500"><Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Înapoi</Button><span>Pagina {page} · {filtered.length} înregistrări încărcate</span><Button size="sm" variant="ghost" disabled={page * 15 >= filtered.length} onClick={() => setPage(page + 1)}>Înainte</Button></div><p className="mt-2 text-xs text-slate-500">Activarea unei reclame necesită și campania și grupul active. Aprobarea și livrarea sunt stabilite de TikTok.</p>
      </section><section className={panelClass}><h2 className="font-semibold">Drafturi salvate</h2>{drafts.length ? <div className="mt-3 grid gap-3 md:grid-cols-3">{drafts.map(item => <button key={item.id} className="rounded-xl border p-4 text-left hover:bg-slate-50" onClick={() => setDraft(item)}><p className="font-medium">{item.data.name || 'Reclamă fără nume'}</p><p className="text-xs text-slate-500">Versiunea {item.version} · Continuă editarea</p></button>)}</div> : <p className="mt-3 text-sm text-slate-500">Drafturile sunt salvate în agenție, fără a cheltui buget.</p>}</section></div>}
      {tab === 'videos' && <VideoLibrary api={api} initialPropertyId={propertyId} onAd={asset => void run(async () => { await loadWorkspace(advertiserId); newDraft(asset); })} />}
      {tab === 'accounts' && <div className="space-y-5"><div className="grid gap-5 md:grid-cols-2"><section className={panelClass}><h2 className="text-lg font-semibold">Cont publicitar</h2><p className="my-3 text-sm text-slate-500">Gestionează campanii și bugete prin TikTok for Business.</p><dl className="space-y-2 text-sm"><div>Conexiune: {workspace.status.connected ? 'Conectată' : 'Neconectată'}</div><div>Facturare: {advertiser?.billingReadiness || 'Necunoscută'}</div><div>Stare cont: {advertiser?.status || 'Necunoscută'}</div><div>Scrieri: {workspace.status.writesEnabled ? 'Permise' : 'Dezactivate'}</div><div>Activări și bugete: {workspace.status.spendMutationsEnabled ? 'Permise cu confirmare' : 'Dezactivate'}</div></dl><div className="mt-4 flex flex-wrap gap-2"><Button disabled={!admin || busy} onClick={() => void run(() => connect())}>{workspace.status.connected ? 'Reautorizează' : 'Conectează'}</Button><Button variant="outline" disabled={!admin || busy} onClick={() => void run(async () => { await api('/api/marketing/tiktok-ads/capabilities', { method: 'POST' }); await api('/api/marketing/tiktok-ads/advertisers', { method: 'POST', body: JSON.stringify({ action: 'sync' }) }); await loadWorkspace(advertiserId); setNotice('Conturile și funcțiile disponibile au fost sincronizate.'); })}>Sincronizează conturile</Button></div></section><section className={panelClass}><h2 className="text-lg font-semibold">Profil pentru postări organice</h2><p className="my-3 text-sm text-slate-500">Conectarea profilului pentru publicare este separată de accesul la reclame. Publicarea organică nu activează reclame.</p><Button disabled={busy} variant="outline" onClick={() => void run(() => connect(true))}>Conectează profilul TikTok</Button></section></div><section className={panelClass}><h2 className="font-semibold">Identități disponibile pentru reclame</h2>{workspace.permissions.filter(item => item.advertiserId === advertiserId).map(item => <div key={item.tiktokAccountId} className="mt-3 rounded-xl border p-4"><p className="font-medium">{item.username || item.tiktokAccountId}</p><p className="text-sm text-slate-500">Verificare: {item.verificationStatus} · {item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleString('ro-RO') : 'Niciodată'}</p><p className="mt-2 text-sm">Livrare reclame: {item.deliverAds ? 'Da' : 'Nu'} · Postări existente: {item.existingPosts ? 'Da' : 'Nu'} · Videoclipuri noi: {item.publishAndManageNewVideos ? 'Da' : 'Nu'} · Exclusiv reclame: {item.onlyShowAsAds ? 'Da' : 'Nu'}</p>{item.identityAuthorizedBcId && <p className="text-xs text-slate-500">Business Center: {item.identityAuthorizedBcId}</p>}</div>)}{!workspace.permissions.some(item => item.advertiserId === advertiserId) && <p className="mt-3 text-sm text-slate-500">Nu există identități verificate. Verifică accesul contului.</p>}</section><details className={panelClass}><summary className="cursor-pointer font-semibold">Diagnostic și istoric operațiuni</summary><div className="mt-4 space-y-2 text-sm">{workspace.capabilities.filter(item => !item.executionAllowed).map(item => <p key={item.capability}>{item.capability}: indisponibilă în conexiunea curentă</p>)}{workspace.operations.map(item => <div key={item.operationId} className="border-t py-2"><p>{item.capability} · {statusLabel(item.status)}</p><p className="text-xs text-slate-500">{item.operationId} · {item.currentStep}</p>{item.remoteOutcomeUnknown && <p className="text-amber-700">Rezultat extern necunoscut. Verifică resursele în TikTok înainte de a relua; nu crea din nou aceeași reclamă.</p>}</div>)}</div></details></div>}
    </>}
    {draft && workspace && <AdComposer key={`${advertiserId}:${draft.id}`} api={api} workspace={workspace} advertiserId={advertiserId} initial={draft} onClose={() => setDraft(null)} onCreated={() => void loadWorkspace(advertiserId).catch(error => setNotice(error.message))} />}
    <Dialog open={!!change} onOpenChange={open => { if (!open && !busy) setChange(null); }}><DialogContent><DialogHeader><DialogTitle>Confirmă modificarea în TikTok</DialogTitle><DialogDescription>{change?.row.name} · {advertiser?.name || advertiserId}</DialogDescription></DialogHeader>{change && <div className="space-y-4"><p className="text-sm">Stare citită din TikTok: {statusLabel(change.row.status)}. {change.action === 'budget' && `Buget curent: ${change.row.budget || 'necunoscut'} ${advertiser?.currency || ''}.`}</p>{(change.action === 'budget' || change.action === 'name') && <label className="block text-sm">{change.action === 'budget' ? `Buget nou (${advertiser?.currency || 'monedă necunoscută'})` : 'Nume nou'}<input className={inputClass} value={change.value} disabled={busy} onChange={event => setChange({ ...change, value: event.target.value, commandId: crypto.randomUUID() })} /></label>}{change.action === 'resume' && <p className="rounded-xl bg-amber-50 p-3 text-sm">Activarea poate începe cheltuirea bugetului pentru această resursă. Verifică și celelalte niveluri ale campaniei.</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setChange(null)}>Anulează</Button><Button disabled={busy || ((change.action === 'name' || change.action === 'budget') && !change.value.trim())} onClick={() => void run(confirmChange)}>{busy ? 'Se verifică…' : 'Confirmă'}</Button></div></div>}</DialogContent></Dialog>
  </main>;
}
