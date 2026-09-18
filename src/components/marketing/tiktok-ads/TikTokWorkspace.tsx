'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button, EmptyState, MetricCard, StatusBadge, StudioEyebrow, StudioScene } from './StudioPrimitives';
import { ArrowUpRight, Building2, Clapperboard, Eye, LayoutDashboard, Megaphone, MousePointer2, Plus, RefreshCw, Settings2, ShieldCheck, Target, Wallet } from 'lucide-react';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import './tiktok-workspace.css';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { emptyAdDraft, statusLabel, type TikTokRow } from '@/lib/tiktok-ads/workspace-model';
import type { TikTokCapability } from '@/lib/tiktok-ads/types';
import { approvalLabels, isApprovalAdmin, canEditApproval } from '@/lib/tiktok-ads/approval-model';
import { AdComposer, type SavedAdDraft } from './AdComposer';
import { AccountDiagnostics, DisconnectControl, IdentityProfiles } from './AccountDiagnostics';
import { VideoLibrary } from './VideoLibrary';
import { HierarchyComposer } from './HierarchyComposer';
import { inputClass, panelClass, type Api, type Workspace } from './workspace-types';

type Tab = 'overview' | 'ads' | 'videos' | 'accounts' | 'approvals';
type Kind = 'campaign' | 'adgroup' | 'ad';
type Change = { kind: Kind; row: TikTokRow; action: 'name' | 'budget' | 'pause' | 'resume'; value: string; commandId: string };
const tabs: Array<[Tab, string]> = [['overview', 'Prezentare'], ['ads', 'Reclame'], ['approvals', 'Aprobări'], ['videos', 'Videoclipuri'], ['accounts', 'Conturi']];
const kinds: Array<[Kind, string]> = [['campaign', 'Campanii'], ['adgroup', 'Grupuri de reclame'], ['ad', 'Reclame']];
const today = () => new Date().toISOString().slice(0, 10);

export default function TikTokWorkspace({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const { user } = useUser();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params?.get('tab') === 'approvals' ? 'approvals' : initialTab);
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
  const [hierarchy, setHierarchy] = useState<{ kind: 'campaign' | 'adgroup'; campaign?: TikTokRow } | null>(null);
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
    if (!response.ok) throw new Error(data.message || data.error?.message || (typeof data.error === 'string' ? data.error : '') || 'Cererea nu a reușit. Încearcă din nou.');
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
    const refresh = () => void api<{ drafts: SavedAdDraft[] }>(`/api/marketing/tiktok-ads/drafts?advertiserId=${encodeURIComponent(advertiserId)}`).then(data => { if (live) setDrafts(data.drafts); }).catch(error => { if (live) setNotice(error.message); });
    return () => { live = false; };
  }, [api, advertiserId, draft]);
  const advertiser = workspace?.advertisers.find(item => item.advertiserId === advertiserId);
  const admin = !!workspace && isApprovalAdmin(workspace.role);
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
  function newDraft(asset?: { id: string; propertyId?: string | null; name: string }, group?: TikTokRow) {
    if (!advertiserId) { setTab('accounts'); setNotice('Conectează și selectează un cont publicitar.'); return; }
    setDraft({ id: crypto.randomUUID(), version: 0, data: { ...emptyAdDraft, propertyId: asset?.propertyId || propertyId, assetId: asset?.id || '', name: asset?.name || '', adgroupId: group?.id || '' } });
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

  return <main className="tt-design tt-workspace space-y-6">
    <header className="tt-hero"><div><div className="tt-hero-kicker"><TikTokIcon /><StudioEyebrow>SPAȚIUL TĂU DE CREAȚIE</StudioEyebrow></div><h1>TikTok <em>Studio</em></h1><p className="tt-hero-lead">Nu doar proprietăți.<br /><strong>Povești care se fac remarcate.</strong></p><p>De la primul cadru la următoarea campanie. Totul, aici.</p><div className="tt-hero-actions"><Button disabled={!workspace || busy} onClick={() => newDraft()}><Plus size={17} />Creează reclamă</Button><Button variant="outline" onClick={() => setTab('videos')}><Clapperboard size={17} />Videoclipuri</Button></div></div><StudioScene /></header>
    <div className="tt-context"><span className="tt-context-avatar"><Building2 size={19} /></span><label>Cont publicitar<select aria-label="Cont publicitar" className={`${inputClass} mt-1`} value={advertiserId} disabled={busy || !!draft || !!change || !!hierarchy} onChange={event => void run(() => switchAdvertiser(event.target.value))}><option value="" disabled>Selectează contul</option>{workspace?.advertisers.map(item => <option key={item.advertiserId} value={item.advertiserId}>{item.name || item.advertiserId}</option>)}</select></label><p className="tt-context-meta">{advertiser ? `${advertiser.currency || 'Monedă necunoscută'} · ${advertiser.timezone || 'Fus orar necunoscut'}` : 'Niciun cont selectat'}</p><StatusBadge active={!!advertiser?.authorized}>{advertiser?.authorized ? "Autorizat" : "Acces de verificat"}</StatusBadge><Button variant="outline" disabled={busy || !advertiserId} onClick={() => void run(reconcile)}><ShieldCheck size={15} />Verifică accesul</Button></div>
    {notice && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{notice}</div>}
    <nav aria-label="Secțiuni TikTok" className="tt-nav">{tabs.map(([key, label]) => <Button key={key} variant={tab === key ? 'default' : 'ghost'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{key === "overview" ? <LayoutDashboard /> : key === "ads" ? <Megaphone /> : key === "videos" ? <Clapperboard /> : <Settings2 />}{label}{key === 'approvals' && <span className="ml-2 rounded-full bg-teal-100 px-2 text-xs text-teal-800">{drafts.filter(item => item.status === 'submitted').length}</span>}</Button>)}</nav>
    {!workspace ? <p role="status">{notice ? 'Pagina nu a putut fi încărcată.' : 'Se încarcă spațiul TikTok…'}</p> : <>
      {tab === 'overview' && <div className="space-y-5">
        <section className={panelClass}><div className="tt-panel-heading"><div><h2>Performanța campaniilor</h2><p>Date reale din TikTok, pentru contul selectat.</p></div><div className="tt-report-tools"><label>De la<input type="date" className={inputClass} value={start} onChange={event => { setStart(event.target.value); setReport(null); }} /></label><label>Până la<input type="date" className={inputClass} value={end} onChange={event => { setEnd(event.target.value); setReport(null); }} /></label><Button variant="outline" disabled={busy || !advertiserId} onClick={() => void run(loadReport)}><RefreshCw size={14} />Încarcă raportul</Button></div></div>
        <div className="tt-metrics"><MetricCard label={`Cheltuieli (${advertiser?.currency || '—'})`} value={metrics('spend')} icon={<Wallet />} /><MetricCard label="Afișări" value={metrics('impressions')} icon={<Eye />} accent="violet" /><MetricCard label="Clickuri" value={metrics('clicks')} icon={<MousePointer2 />} accent="pink" /><MetricCard label="Conversii" value={metrics('conversion')} icon={<Target />} accent="amber" /></div><p className="mt-4 text-xs text-slate-500">{report ? `${report.length} înregistrări raportate. Actualizat: ${syncedAt}. Conversiile depind de configurarea urmăririi.` : 'Încarcă raportul pentru intervalul ales. Lipsa datelor nu înseamnă zero rezultate.'}</p></section>
        <div className="tt-launchpad"><section className="tt-feature tt-feature--video"><span className="tt-icon-tile"><Clapperboard /></span><span className="tt-eyebrow">01 / CREAȚIE</span><h2>O proprietate. O poveste.</h2><p>Transformă imaginile proprietății într-un videoclip pregătit să iasă în evidență.</p><Button variant="outline" onClick={() => setTab('videos')}>Deschide studioul video<ArrowUpRight size={16} /></Button></section><section className="tt-feature"><span className="tt-icon-tile"><Megaphone /></span><span className="tt-eyebrow">02 / PROMOVARE</span><h2>Din vizualizări, în oportunități.</h2><p>Alege conținutul, definește audiența și pregătește reclama. Tu decizi când o activezi.</p><Button variant="outline" onClick={() => newDraft()}>Construiește reclama<ArrowUpRight size={16} /></Button></section></div>
      </div>}
      {tab === 'ads' && <div className="space-y-5"><section className={panelClass}><div className="tt-panel-heading"><div><h2>{kind === 'campaign' ? 'Campaniile tale' : kind === 'adgroup' ? 'Grupurile tale de reclame' : 'Reclamele tale'}</h2><p>Un singur spațiu pentru fiecare nivel al promovării.</p></div><StatusBadge>Control manual al activării</StatusBadge></div><div className="tt-toolbar"><Button disabled={busy || !advertiserId || (kind !== 'ad' && (!admin || !workspace.status.writesEnabled))} onClick={() => kind === 'ad' ? newDraft(undefined, parent?.kind === 'adgroup' ? { id: parent.id, name: parent.name, status: 'UNKNOWN' } : undefined) : setHierarchy({ kind, campaign: parent?.kind === 'campaign' ? { id: parent.id, name: parent.name, status: 'UNKNOWN' } : undefined })}><Plus size={15} />{kind === 'campaign' ? 'Creează campanie' : kind === 'adgroup' ? 'Creează grup de reclame' : 'Adaugă reclamă'}</Button><div className="tt-segments">{kinds.map(([key, label]) => <Button key={key} variant={kind === key ? 'default' : 'outline'} disabled={busy || !advertiserId} onClick={() => void run(() => loadRows(key, null))}>{label}</Button>)}</div><Button className="ml-auto" variant="outline" disabled={busy || !advertiserId} onClick={() => void run(() => loadRows())}><RefreshCw size={14} />Actualizează</Button></div><div className="my-4 flex flex-wrap gap-3"><input aria-label="Caută reclame" className={`${inputClass} max-w-sm`} placeholder="Caută după nume sau ID" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /><select aria-label="Filtru proprietate" className={`${inputClass} max-w-sm`} value={propertyId} onChange={event => { setPropertyId(event.target.value); setPage(1); }}><option value="">Toate proprietățile</option>{workspace.properties.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>{parent && <Button variant="ghost" onClick={() => { setParent(null); setPage(1); }}>× {parent.name}</Button>}
        {!loaded ? <EmptyState title="Campaniile tale, într-un singur loc" description="Alege nivelul sau apasă Actualizează pentru a citi datele din TikTok." /> : !filtered.length ? <EmptyState title={kind === 'campaign' ? 'Pregătește prima campanie' : kind === 'adgroup' ? 'Construiește audiența campaniei' : 'Adaugă următoarea reclamă'} description="Nu există rezultate pentru filtrele selectate. Folosește butonul de creare de mai sus sau schimbă filtrele." /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Nume / proprietate</th><th className="p-3">Stare</th><th className="p-3">Buget</th><th className="p-3">Acțiuni</th></tr></thead><tbody>{filtered.slice((page - 1) * 15, page * 15).map(row => <tr key={row.id} className="border-b"><td className="p-3"><button className="text-left font-medium hover:underline" disabled={kind === 'ad' || busy} onClick={() => void run(() => loadRows(kind === 'campaign' ? 'adgroup' : 'ad', { kind, id: row.id, name: row.name }))}>{row.name}</button><p className="text-xs text-slate-500">{workspace.properties.find(item => item.id === row.propertyId)?.title || 'Neasociată unei proprietăți'} · {row.id}</p></td><td className="p-3">{statusLabel(row.status)}{row.rejection && <p className="text-xs text-red-700">{row.rejection}</p>}</td><td className="p-3">{row.budget ? `${row.budget} ${advertiser?.currency || ''}` : '—'}</td><td className="p-3"><div className="flex flex-wrap gap-1">{kind === 'campaign' && <Button size="sm" variant="outline" disabled={!admin || busy} onClick={() => setHierarchy({ kind: 'adgroup', campaign: row })}>Adaugă grup</Button>}{kind === 'adgroup' && <Button size="sm" variant="outline" disabled={!admin || busy} onClick={() => newDraft(undefined, row)}>Adaugă reclamă</Button>}<Button size="sm" variant="ghost" disabled={!admin || busy} onClick={() => void run(() => prepare(row, 'name'))}>Nume</Button>{kind !== 'ad' && <Button size="sm" variant="ghost" disabled={!admin || busy} onClick={() => void run(() => prepare(row, 'budget'))}>Buget</Button>}<Button size="sm" variant="outline" disabled={!admin || busy} onClick={() => void run(() => prepare(row, /^(STATUS_)?ENABLE$/.test(row.status) ? 'pause' : 'resume'))}>{/^(STATUS_)?ENABLE$/.test(row.status) ? 'Oprește' : 'Activează'}</Button></div></td></tr>)}</tbody></table></div>}
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-500"><Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Înapoi</Button><span>Pagina {page} · {filtered.length} înregistrări încărcate</span><Button size="sm" variant="ghost" disabled={page * 15 >= filtered.length} onClick={() => setPage(page + 1)}>Înainte</Button></div><p className="mt-2 text-xs text-slate-500">Activarea unei reclame necesită și campania și grupul active. Aprobarea și livrarea sunt stabilite de TikTok.</p>
      </section><section className={panelClass}><h2 className="font-semibold">Drafturi salvate</h2>{drafts.length ? <div className="mt-3 grid gap-3 md:grid-cols-3">{drafts.map(item => <button key={item.id} className="tt-draft-card" onClick={() => setDraft(item)}><p className="font-medium">{item.data.name || 'Reclamă fără nume'}</p><p className="text-xs text-slate-500">{approvalLabels[item.status || 'draft']} · v{item.version}</p></button>)}</div> : <p className="mt-3 text-sm text-slate-500">Drafturile sunt salvate în agenție, fără a cheltui buget.</p>}</section></div>}
      {tab === 'approvals' && <section className={panelClass}><div className="tt-panel-heading"><div><h2>{admin ? 'Centrul de aprobare' : 'Reclamele trimise spre aprobare'}</h2><p>Contul {advertiser?.name} · versiuni, decizii și publicări. Lista se actualizează automat.</p></div><StatusBadge>{drafts.filter(item => item.status === 'submitted').length} de verificat</StatusBadge></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[...drafts].sort((a, b) => Number(b.status === 'submitted') - Number(a.status === 'submitted')).map(item => <article key={item.id} className="tt-draft-card"><StatusBadge active={item.status === 'published'}>{approvalLabels[item.status || 'draft']}</StatusBadge><h3 className="mt-3 font-semibold">{item.data.name || 'Reclamă fără nume'}</h3><p className="text-sm text-slate-500">{item.ownerName || item.ownerUid || 'Agent'} · versiunea {item.version}</p><p className="mt-2 text-sm">{workspace.properties.find(property => property.id === item.data.propertyId)?.title || 'Proprietate neselectată'}</p><p className="text-sm">{item.data.adgroupId ? 'Bugetul și programul grupului existent' : `${item.data.budget || '—'} ${advertiser?.currency || ''} / zi · ${item.data.start || 'Nespecificat'} → ${item.data.end || 'Fără termen'}`}</p>{item.feedback && <p className="mt-2 text-sm text-amber-800">{item.feedback}</p>}{item.publicationError && <p className="mt-2 text-sm text-rose-800">{item.publicationError}</p>}<Button className="mt-4" variant="outline" onClick={() => setDraft(item)}>{canEditApproval(item) ? 'Deschide draftul' : admin && item.status === 'submitted' ? 'Verifică și decide' : 'Vezi detalii / istoric'}</Button></article>)}</div>{!drafts.length && <EmptyState title="Nicio cerere de verificat" description="Drafturile și cererile acestui cont vor apărea aici. Pregătește prima reclamă din Creează reclamă." />}</section>}
      {tab === 'videos' && <VideoLibrary api={api} initialPropertyId={propertyId} onAd={asset => void run(async () => { await loadWorkspace(advertiserId); newDraft(asset); })} />}
      {tab === 'accounts' && <div className="space-y-5"><div className="grid gap-5 md:grid-cols-2"><section className={panelClass}><h2 className="text-lg font-semibold">Cont publicitar</h2><p className="my-3 text-sm text-slate-500">Gestionează campanii și bugete prin TikTok for Business.</p><dl className="tt-account-details"><div>Conexiune: {workspace.status.connected ? 'Conectată' : 'Neconectată'}</div><div>Facturare: {advertiser?.billingReadiness === 'ready' ? 'Pregătită' : advertiser?.billingReadiness === 'unknown' || !advertiser?.billingReadiness ? 'Neverificată' : advertiser.billingReadiness}</div><div>Stare cont: {advertiser?.status ? statusLabel(advertiser.status) : 'Neverificată'}</div><div>Scrieri: {workspace.status.writesEnabled ? 'Permise' : 'Dezactivate'}</div><div>Activări și bugete: {workspace.status.spendMutationsEnabled ? 'Permise cu confirmare' : 'Dezactivate'}</div></dl><div className="mt-4 flex flex-wrap gap-2"><Button disabled={!admin || busy} onClick={() => void run(() => connect())}>{workspace.status.connected ? 'Reautorizează' : 'Conectează'}</Button><Button variant="outline" disabled={!admin || busy} onClick={() => void run(async () => { await api('/api/marketing/tiktok-ads/capabilities', { method: 'POST' }); await api('/api/marketing/tiktok-ads/advertisers', { method: 'POST', body: JSON.stringify({ action: 'sync' }) }); await loadWorkspace(advertiserId); setNotice('Conturile și funcțiile disponibile au fost sincronizate.'); })}>Sincronizează conturile</Button></div><DisconnectControl api={api} connected={workspace.status.connected} disabled={!admin || busy} onDisconnected={() => loadWorkspace(advertiserId)} /></section><section className={panelClass}><h2 className="text-lg font-semibold">Profil pentru postări organice</h2><p className="my-3 text-sm text-slate-500">Conectarea profilului pentru publicare este separată de accesul la reclame. Publicarea organică nu activează reclame.</p><Button disabled={busy} variant="outline" onClick={() => void run(() => connect(true))}>Conectează profilul TikTok</Button><DisconnectControl api={api} organic refreshToken={workspace} disabled={busy} onDisconnected={() => loadWorkspace(advertiserId)} /></section></div><IdentityProfiles permissions={workspace.permissions.filter(item => item.advertiserId === advertiserId)} /><AccountDiagnostics workspace={workspace} /></div>}
    </>}
    {hierarchy && workspace && <HierarchyComposer kind={hierarchy.kind} initialCampaign={hierarchy.campaign} api={api} workspace={workspace} advertiserId={advertiserId} onClose={() => { setHierarchy(null); void run(() => loadRows()); }} onCreated={() => { void loadWorkspace(advertiserId).catch(error => setNotice(error.message)); }} />}
    {draft && workspace && <AdComposer key={`${advertiserId}:${draft.id}`} api={api} workspace={workspace} advertiserId={advertiserId} initial={draft} onClose={() => setDraft(null)} onCreated={() => void loadWorkspace(advertiserId).catch(error => setNotice(error.message))} />}
    <Dialog open={!!change} onOpenChange={open => { if (!open && !busy) setChange(null); }}><DialogContent className="tt-design tt-confirmation"><DialogHeader><DialogTitle>Confirmă modificarea în TikTok</DialogTitle><DialogDescription>{change?.row.name} · {advertiser?.name || advertiserId}</DialogDescription></DialogHeader>{change && <div className="space-y-4"><p className="text-sm">Stare citită din TikTok: {statusLabel(change.row.status)}. {change.action === 'budget' && `Buget curent: ${change.row.budget || 'necunoscut'} ${advertiser?.currency || ''}.`}</p>{(change.action === 'budget' || change.action === 'name') && <label className="block text-sm">{change.action === 'budget' ? `Buget nou (${advertiser?.currency || 'monedă necunoscută'})` : 'Nume nou'}<input className={inputClass} value={change.value} disabled={busy} onChange={event => setChange({ ...change, value: event.target.value, commandId: crypto.randomUUID() })} /></label>}{change.action === 'resume' && <p className="rounded-xl bg-amber-50 p-3 text-sm">Activarea poate începe cheltuirea bugetului pentru această resursă. Verifică și celelalte niveluri ale campaniei.</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setChange(null)}>Anulează</Button><Button disabled={busy || ((change.action === 'name' || change.action === 'budget') && !change.value.trim())} onClick={() => void run(confirmChange)}>{busy ? 'Se verifică…' : 'Confirmă'}</Button></div></div>}</DialogContent></Dialog>
  </main>;
}
