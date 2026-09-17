'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, PhonePreview, StudioEyebrow } from './StudioPrimitives';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { buildAdInputs, emptyAdDraft, schemaMissing, type AdDraft, type TikTokRow } from '@/lib/tiktok-ads/workspace-model';
import type { TikTokOperationResult } from '@/lib/tiktok-ads/types';
import { inputClass, type Api, type Workspace } from './workspace-types';

export type SavedAdDraft = { id: string; version: number; data: AdDraft; updatedAt?: string };
export function AdComposer({ api, workspace, advertiserId, initial, onClose, onCreated }: { api: Api; workspace: Workspace; advertiserId: string; initial: SavedAdDraft; onClose: () => void; onCreated: () => void }) {
  const [draft, setDraft] = useState<AdDraft>({ ...emptyAdDraft, ...initial.data });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [locations, setLocations] = useState<TikTokRow[]>([]);
  const [forms, setForms] = useState<TikTokRow[]>([]);
  const [posts, setPosts] = useState<TikTokRow[]>([]);
  const [groups, setGroups] = useState<TikTokRow[]>([]);
  const [result, setResult] = useState<TikTokOperationResult | null>(null);
  const version = useRef(initial.version);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  // Stable across closing/reopening the draft: an uncertain response must never
  // result in another campaign merely because the dialog was remounted.
  const command = useRef(`draft-${initial.id}`);
  const lastSaved = useRef(initial.version > 0 ? JSON.stringify(initial.data) : '');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advertiser = workspace.advertisers.find(item => item.advertiserId === advertiserId);
  const asset = workspace.assets.find(item => item.id === draft.assetId && item.propertyId === draft.propertyId);
  const available = (capability: string) => workspace.capabilities.some(item => item.capability === capability && item.executionAllowed);
  const admin = workspace.role !== 'agent';
  function change(patch: Partial<AdDraft>) { if (busy || result) return; setDraft(current => ({ ...current, ...patch })); setResult(null); setError(''); }

  const save = useCallback((value: AdDraft) => {
    const serialized = JSON.stringify(value);
    const next = chain.current.catch(() => undefined).then(async () => {
      if (serialized === lastSaved.current) return;
      setSaving('Se salvează…');
      const saved = await api<{ version: number }>('/api/marketing/tiktok-ads/drafts', { method: 'PUT', body: JSON.stringify({ id: initial.id, advertiserId, expectedVersion: version.current, data: value }) });
      version.current = saved.version; lastSaved.current = serialized; setSaving('Salvat');
    });
    chain.current = next;
    return next;
  }, [api, initial.id, advertiserId]);

  useEffect(() => {
    const serialized = JSON.stringify(draft);
    if (serialized === lastSaved.current) return;
    saveTimer.current = setTimeout(() => { void save(draft).catch(error => setSaving(error.message)); }, 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draft, save]);

  async function close() {
    setBusy(true); setError('');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try { await save(draft); onClose(); } catch (error) { setError(error instanceof Error ? error.message : 'Draftul nu a fost salvat.'); }
    finally { setBusy(false); }
  }

  async function loadOptions(kind: 'location' | 'form' | 'post' | 'adgroup') {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ advertiserId, kind, search, identityId: draft.identityId });
      const data = await api<{ rows: TikTokRow[] }>(`/api/marketing/tiktok-ads/manager?${params}`);
      ({ location: setLocations, form: setForms, post: setPosts, adgroup: setGroups })[kind](data.rows);
    } catch (error) { setError(error instanceof Error ? error.message : 'Lista nu a putut fi încărcată.'); }
    finally { setBusy(false); }
  }
  const prerequisites = ['AD_CREATE', 'TIKTOK_PERMISSION_READ', ...(draft.mode === 'video' ? ['SPARK_NEW_VIDEO_AD_ONLY', 'CAMPAIGN_CREATE', 'ADGROUP_CREATE', 'CREATIVE_UPLOAD'] : ['SPARK_EXISTING_POST'])];
  const unavailable = prerequisites.filter(capability => !available(capability));
  function validate() {
    if (!draft.propertyId || !draft.identityId) throw new Error('Selectează proprietatea și profilul TikTok.');
    if (!draft.name.trim() || !draft.text.trim()) throw new Error('Completează numele și textul reclamei.');
    if (draft.mode === 'video' && !asset) throw new Error('Selectează un videoclip al proprietății.');
    if (draft.mode === 'post' && (!draft.postId || !draft.adgroupId)) throw new Error('Selectează postarea și grupul de reclame.');
    if (draft.objective === 'TRAFFIC' && !/^https:\/\//.test(draft.url)) throw new Error('Destinația trebuie să fie o adresă HTTPS.');
    if (draft.objective === 'LEAD_GENERATION' && !draft.formId) throw new Error('Selectează un formular TikTok existent.');
    if (draft.mode === 'video' && (!/^\d+(\.\d{1,4})?$/.test(draft.budget) || Number(draft.budget) <= 0 || !draft.locationIds.length || !draft.start)) throw new Error('Completează bugetul, locația și data de început.');
    if (draft.end && draft.end <= draft.start) throw new Error('Sfârșitul trebuie să fie după început.');
    if (unavailable.length) throw new Error('Contul nu este pregătit pentru acest tip de reclamă. Verifică secțiunea Conturi.');
  }
  async function create() {
    setError(''); setBusy(true);
    try {
      validate();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await save(draft);
      if (draft.mode === 'video' && !advertiser?.timezone) throw new Error('Sincronizează fusul orar al contului înainte de creare.');
      const inputs = buildAdInputs(draft, workspace.schemas, advertiser?.timezone || 'UTC');
      const supplied = ['advertiser_id', 'advertiser_ids', 'campaign_id', 'adgroup_id', 'video_id', 'identity_id', 'identity_type', 'identity_authorized_bc_id', 'video_url', 'operation_status', 'dark_post_status'];
      const missing = (draft.mode === 'video' ? [['CAMPAIGN_CREATE', inputs.campaign], ['ADGROUP_CREATE', inputs.adGroup], ['CREATIVE_UPLOAD', inputs.video], ['AD_CREATE', inputs.ad]] as const : [['AD_CREATE', inputs.ad]] as const).flatMap(([cap, value]) => schemaMissing(workspace.schemas[cap], value, supplied));
      if (missing.length) throw new Error(`Configurația acestui cont cere informații suplimentare: ${missing.join(', ')}. Draftul rămâne salvat.`);
      const payload = draft.mode === 'video' ? { adsOnly: true, tiktokAccountId: draft.identityId, permissionToolInput: {}, campaign: inputs.campaign, adGroup: inputs.adGroup, video: { mediaAssetId: draft.assetId, toolInput: inputs.video }, ad: inputs.ad } : { tiktokAccountId: draft.identityId, permissionToolInput: {}, ad: inputs.ad };
      const created = await api<TikTokOperationResult>('/api/marketing/tiktok-ads/operations', { method: 'POST', body: JSON.stringify({ advertiserId, propertyId: draft.propertyId, capability: draft.mode === 'video' ? 'SPARK_NEW_VIDEO_AD_ONLY' : 'SPARK_EXISTING_POST', payload, idempotencyKey: command.current, expectedVersion: advertiser?.version }) });
      setResult(created); onCreated();
    } catch (error) { setError(error instanceof Error ? error.message : 'Crearea nu a reușit. Verifică istoricul înainte de a relua.'); }
    finally { setBusy(false); }
  }
  const stepLabels = ['Proprietate', 'Conținut', 'Audiență și buget', 'Verificare'];
  const stepHints = ['Alege ce promovezi', 'Construiește povestea', 'Definește distribuția', 'Pregătește lansarea'];
  const stepTitles = ['Începe cu proprietatea.', 'O reclamă care atrage priviri.', 'Ajungi la publicul potrivit.', 'Totul pregătit?'];
  const stepDescriptions = ['Alege proprietatea și profilul care va reprezenta agenția.', 'Selectează materialul și scrie mesajul pe care îl vor vedea oamenii.', 'Stabilește locația, bugetul și perioada campaniei.', 'Verifică detaliile. Reclama va fi creată oprită, fără activare automată.'];
  return <DialogPrimitive.Root open onOpenChange={open => { if (!open && !busy) void close(); }}>
    <DialogPrimitive.Portal><DialogPrimitive.Overlay className="tt-composer-backdrop" />
    <DialogPrimitive.Content className="tt-design tt-composer" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
      <header className="tt-composer-header"><div><StudioEyebrow>AD STUDIO / TIKTOK</StudioEyebrow><DialogPrimitive.Title>Creează reclamă</DialogPrimitive.Title><DialogPrimitive.Description>{advertiser?.name} · {saving || 'Draft nou'}</DialogPrimitive.Description></div><Button variant="outline" disabled={busy} onClick={() => void close()}>Salvează și închide</Button></header>
      <div className="tt-composer-layout">
        <nav className="tt-steps" aria-label="Pașii reclamei">{stepLabels.map((label, index) => <button key={label} aria-label={`${index + 1}. ${label}`} aria-current={step === index ? 'step' : undefined} disabled={busy || !!result} onClick={() => setStep(index)} className="tt-step"><span className="tt-step-number">{index + 1}</span><span><strong>{label}</strong><small>{stepHints[index]}</small></span></button>)}<p className="tt-step-tip"><ShieldCheck />Tu controlezi lansarea.<br />Nicio cheltuială fără activare explicită.</p></nav>
        <section className="tt-composer-form"><div className="tt-form-heading"><span>PASUL 0{step + 1} / 04</span><h3>{stepTitles[step]}</h3><p>{stepDescriptions[step]}</p></div><div className="tt-fields">
          {step === 0 && <>
            <Field label="Caută proprietatea"><input className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Titlu sau localitate" /></Field>
            <Field label="Proprietate"><select className={inputClass} value={draft.propertyId} onChange={event => { const property = workspace.properties.find(item => item.id === event.target.value); change({ propertyId: event.target.value, assetId: '', name: property?.title.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '').trim() || '' }); }}><option value="">Selectează</option>{workspace.properties.filter(item => `${item.title} ${item.location}`.toLowerCase().includes(search.toLowerCase()) || item.id === draft.propertyId).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
            <Field label="Profil TikTok"><select className={inputClass} value={draft.identityId} onChange={event => change({ identityId: event.target.value, postId: '' })}><option value="">Selectează profilul autorizat</option>{workspace.permissions.map(item => <option key={item.tiktokAccountId} value={item.tiktokAccountId}>{item.username || item.tiktokAccountId}{!item.deliverAds ? ' · necesită autorizare' : ''}</option>)}</select></Field>
            <Field label="Numele campaniei"><input className={inputClass} value={draft.name} onChange={event => change({ name: event.target.value })} /></Field>
            <Field label="Obiectiv"><select className={inputClass} value={draft.objective} onChange={event => change({ objective: event.target.value as AdDraft['objective'] })}><option value="TRAFFIC">Vizite pe pagina proprietății</option><option value="VIDEO_VIEWS">Vizualizări video</option>{available('LEAD_FORM_READ') && <option value="LEAD_GENERATION">Cereri de informații prin formular</option>}</select></Field>
          </>}
          {step === 1 && <>
            <Field label="Material publicitar"><select className={inputClass} value={draft.mode} onChange={event => change({ mode: event.target.value as AdDraft['mode'] })}><option value="video">Videoclip nou · doar în reclame</option><option value="post">Promovează o postare existentă</option></select></Field>
            {draft.mode === 'video' ? <Field label="Videoclipul proprietății"><select className={inputClass} value={draft.assetId} onChange={event => change({ assetId: event.target.value })}><option value="">Selectează un videoclip</option>{workspace.assets.filter(item => item.propertyId === draft.propertyId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="mt-2 text-xs text-slate-500">Creează sau asociază materialele în secțiunea Videoclipuri.</p></Field> : <>
              <Button variant="outline" disabled={busy || !draft.identityId} onClick={() => void loadOptions('post')}>Încarcă postările autorizate</Button><select aria-label="Postare" className={inputClass} value={draft.postId} onChange={event => change({ postId: event.target.value })}><option value="">Selectează postarea</option>{posts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <Button variant="outline" disabled={busy} onClick={() => void loadOptions('adgroup')}>Încarcă grupurile de reclame</Button><select aria-label="Grup de reclame" className={inputClass} value={draft.adgroupId} onChange={event => change({ adgroupId: event.target.value })}><option value="">Selectează grupul</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            </>}
            <Field label="Textul reclamei"><textarea className={inputClass} rows={4} value={draft.text} onChange={event => change({ text: event.target.value })} /></Field>
            <Field label="Buton"><select className={inputClass} value={draft.cta} onChange={event => change({ cta: event.target.value })}><option value="LEARN_MORE">Află mai multe</option><option value="CONTACT_US">Contactează-ne</option><option value="SIGN_UP">Înscrie-te</option></select></Field>
            {draft.objective === 'LEAD_GENERATION' ? <><Button variant="outline" disabled={busy} onClick={() => void loadOptions('form')}>Încarcă formularele</Button><select aria-label="Formular" className={inputClass} value={draft.formId} onChange={event => change({ formId: event.target.value })}><option value="">Selectează formularul aprobat</option>{forms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><a className="text-sm underline" href="https://ads.tiktok.com/" target="_blank" rel="noreferrer">Gestionează formularele în TikTok</a></> : <Field label="Pagina proprietății (HTTPS)"><input type="url" className={inputClass} value={draft.url} onChange={event => change({ url: event.target.value })} /></Field>}
          </>}
          {step === 2 && (draft.mode === 'post' ? <p>Reclama va folosi audiența și bugetul grupului selectat. Le poți verifica și modifica din Reclame → Grupuri.</p> : <>
            <Field label="Locații"><div className="flex gap-2"><input className={inputClass} placeholder="Caută orașul sau regiunea" value={search} onChange={event => setSearch(event.target.value)} /><Button variant="outline" disabled={busy || !available('TARGETING_READ')} onClick={() => void loadOptions('location')}>Caută</Button></div>{!available('TARGETING_READ') && <p className="mt-2 text-sm text-amber-700">Contul nu permite momentan încărcarea locațiilor. Verifică integrarea în Conturi.</p>}{locations.map(item => <label key={item.id} className="my-2 flex gap-2 text-sm"><input type="checkbox" checked={draft.locationIds.includes(item.id)} onChange={event => change({ locationIds: event.target.checked ? [...draft.locationIds, item.id] : draft.locationIds.filter(id => id !== item.id) })} />{item.name}</label>)}<p className="text-xs text-slate-500">{draft.locationIds.length} locații selectate</p></Field>
            <Field label={`Buget zilnic (${advertiser?.currency || 'monedă nesincronizată'})`}><input className={inputClass} inputMode="decimal" value={draft.budget} onChange={event => change({ budget: event.target.value.replace(',', '.') })} /></Field>
            <p className="text-xs text-slate-500">Programul este exprimat în fusul contului: {advertiser?.timezone || 'nesincronizat'}.</p>
            <Field label="Început"><input type="datetime-local" className={inputClass} value={draft.start} onChange={event => change({ start: event.target.value })} /></Field><Field label="Sfârșit (opțional)"><input type="datetime-local" className={inputClass} value={draft.end} onChange={event => change({ end: event.target.value })} /></Field>
          </>)}
          {step === 3 && <><h3 className="text-lg font-semibold">Verifică înainte de creare</h3><dl className="tt-review"><dt>Proprietate</dt><dd className="font-semibold">{workspace.properties.find(item => item.id === draft.propertyId)?.title || 'Neselectată'}</dd><dt>Cont publicitar / profil</dt><dd>{advertiser?.name} / {workspace.permissions.find(item => item.tiktokAccountId === draft.identityId)?.username || 'Neselectat'}</dd><dt>Buget</dt><dd>{draft.mode === 'post' ? 'Bugetul grupului existent' : `${draft.budget || '—'} ${advertiser?.currency || ''} / zi`}</dd><dt>Program</dt><dd>{draft.start || '—'} → {draft.end || 'Fără dată de încheiere'} · {advertiser?.timezone}</dd></dl><p className="rounded-xl bg-cyan-50 p-3 text-sm">Reclama se creează oprită. Activarea se confirmă separat din lista de reclame.</p>{unavailable.length > 0 && <p className="text-sm text-amber-700">Crearea nu este disponibilă în configurația actuală a contului. Draftul poate fi păstrat.</p>}{!admin && <p className="text-sm text-slate-600">Draftul este pregătit pentru verificarea administratorului.</p>}<Button disabled={busy || !!result || !admin || !!unavailable.length || !workspace.status.writesEnabled} onClick={() => void create()}>{busy ? 'Se creează…' : 'Creează reclama oprită'}</Button></>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {result && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm">{result.status === 'succeeded' ? 'Reclama a fost creată oprită. Verifică rezultatul în lista de reclame.' : 'Operația necesită verificare. Deschide istoricul din Conturi.'}</p>}
          </div><div className="tt-form-footer"><Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}><ArrowLeft size={15} />Înapoi</Button>{step < 3 && <Button disabled={busy} onClick={() => { setSearch(''); setStep(step + 1); }}>Continuă<ArrowRight size={15} /></Button>}</div>
        </section>
        <PhonePreview asset={draft.mode === 'video' ? asset : undefined} username={workspace.permissions.find(item => item.tiktokAccountId === draft.identityId)?.username} text={draft.text} cta={draft.cta === 'CONTACT_US' ? 'Contactează-ne' : draft.cta === 'SIGN_UP' ? 'Înscrie-te' : 'Află mai multe'} />
      </div>
    </DialogPrimitive.Content></DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="tt-field"><span>{label}</span>{children}</label>; }
