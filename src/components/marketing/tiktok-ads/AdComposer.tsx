'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, PhonePreview, StudioEyebrow } from './StudioPrimitives';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { emptyAdDraft, type AdDraft, type TikTokRow } from '@/lib/tiktok-ads/workspace-model';
import { approvalLabels, canEditApproval, isApprovalAdmin, type ApprovalDraft, type ApprovalStatus } from '@/lib/tiktok-ads/approval-model';
import type { PublishPreview } from '@/lib/tiktok-ads/approval-publishing';
import { inputClass, type Api, type Workspace } from './workspace-types';

export type SavedAdDraft = Pick<ApprovalDraft, 'id' | 'version' | 'data'> & Partial<Omit<ApprovalDraft, 'id' | 'version' | 'data'>>;
export function AdComposer({ api, workspace, advertiserId, initial, onClose, onCreated }: { api: Api; workspace: Workspace; advertiserId: string; initial: SavedAdDraft; onClose: () => void; onCreated: () => void }) {
  const [draft, setDraft] = useState<AdDraft>({ ...emptyAdDraft, ...initial.data });
  const [step, setStep] = useState(canEditApproval(initial) ? 0 : 3);
  const [existingGroup, setExistingGroup] = useState(!!initial.data.adgroupId || initial.data.mode === 'post');
  const [saving, setSaving] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [locations, setLocations] = useState<TikTokRow[]>([]);
  const [forms, setForms] = useState<TikTokRow[]>([]);
  const [posts, setPosts] = useState<TikTokRow[]>([]);
  const [groups, setGroups] = useState<TikTokRow[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<ApprovalStatus>(initial.status || 'draft');
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [note, setNote] = useState('');
  const [started, setStarted] = useState(initial.publishRevision != null);
  const locked = !canEditApproval({ status, publishRevision: started ? 1 : undefined });
  const version = useRef(initial.version);
  const [revision, setRevision] = useState(initial.version);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const lastSaved = useRef(initial.version > 0 ? JSON.stringify(initial.data) : '');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advertiser = workspace.advertisers.find(item => item.advertiserId === advertiserId);
  const asset = workspace.assets.find(item => item.id === draft.assetId && item.propertyId === draft.propertyId);
  const available = (capability: string) => workspace.capabilities.some(item => item.capability === capability && item.executionAllowed);
  const admin = isApprovalAdmin(workspace.role);
  function change(patch: Partial<AdDraft>) { if (busy || locked) return; setPreview(null); setDraft(current => ({ ...current, ...patch })); setResult(null); setError(''); }

  const save = useCallback((value: AdDraft) => {
    if (locked) return chain.current;
    const serialized = JSON.stringify(value);
    const next = chain.current.catch(() => undefined).then(async () => {
      if (serialized === lastSaved.current) return;
      setSaving('Se salvează…');
      const saved = await api<{ version: number }>('/api/marketing/tiktok-ads/drafts', { method: 'PUT', body: JSON.stringify({ id: initial.id, advertiserId, expectedVersion: version.current, data: value }) });
      version.current = saved.version; setRevision(saved.version); lastSaved.current = serialized; setSaving('Salvat');
    });
    chain.current = next;
    return next;
  }, [api, initial.id, advertiserId, locked]);

  useEffect(() => {
    const serialized = JSON.stringify(draft);
    if (locked || serialized === lastSaved.current) return;
    saveTimer.current = setTimeout(() => { void save(draft).catch(error => setSaving(error.message)); }, 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draft, save, locked]);

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
  const prerequisites = ['AD_CREATE', 'TIKTOK_PERMISSION_READ', ...(draft.mode === 'video' ? ['SPARK_NEW_VIDEO_AD_ONLY', 'CREATIVE_UPLOAD', ...(!draft.adgroupId ? ['CAMPAIGN_CREATE', 'ADGROUP_CREATE'] : [])] : ['SPARK_EXISTING_POST'])];
  const unavailable = prerequisites.filter(capability => !available(capability));
  function validate() {
    if (!draft.propertyId || !draft.identityId) throw new Error('Selectează proprietatea și profilul TikTok.');
    if (!draft.name.trim() || !draft.text.trim()) throw new Error('Completează numele și textul reclamei.');
    if (draft.mode === 'video' && !asset) throw new Error('Selectează un videoclip al proprietății.');
    if (draft.mode === 'post' && (!draft.postId || !draft.adgroupId)) throw new Error('Selectează postarea și grupul de reclame.');
    if (draft.objective === 'TRAFFIC' && !/^https:\/\//.test(draft.url)) throw new Error('Destinația trebuie să fie o adresă HTTPS.');
    if (draft.objective === 'LEAD_GENERATION' && !draft.formId) throw new Error('Selectează un formular TikTok existent.');
    if (draft.mode === 'video' && !draft.adgroupId && (!/^\d+(\.\d{1,4})?$/.test(draft.budget) || Number(draft.budget) <= 0 || !draft.locationIds.length || !draft.start)) throw new Error('Completează bugetul, locația și data de început.');
    if (existingGroup && !draft.adgroupId) throw new Error('Selectează grupul existent înainte de creare.');
    if (!draft.adgroupId && draft.end && draft.end <= draft.start) throw new Error('Sfârșitul trebuie să fie după început.');
    if (unavailable.length) throw new Error('Contul nu este pregătit pentru acest tip de reclamă. Verifică secțiunea Conturi.');
  }
  async function decide(action: 'submit' | 'withdraw' | 'request_changes' | 'reject' | 'delete') {
    setBusy(true); setError(''); setPreview(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await chain.current;
      if (action === 'submit') { validate(); await save(draft); }
      const response = await api<{ status: ApprovalStatus; version: number }>('/api/marketing/tiktok-ads/drafts', { method: 'PATCH', body: JSON.stringify({ id: initial.id, expectedVersion: version.current, action, note }) });
      version.current = response.version; setRevision(response.version); setStatus(response.status); setResult(approvalLabels[response.status]); onCreated();
      if (action === 'delete') onClose();
    } catch (error) { setError(error instanceof Error ? error.message : 'Decizia nu a fost salvată.'); }
    finally { setBusy(false); }
  }
  async function create() {
    setError(''); setBusy(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!locked) { validate(); await save(draft); }
      if (!preview) {
        setPreview(await api<PublishPreview>('/api/marketing/tiktok-ads/drafts/publication', { method: 'POST', body: JSON.stringify({ id: initial.id, expectedVersion: version.current, action: 'preview' }) }));
      } else {
        const response = await api<{ status: ApprovalStatus; version: number; message: string }>('/api/marketing/tiktok-ads/drafts/publication', { method: 'POST', body: JSON.stringify({ id: initial.id, expectedVersion: version.current, action: 'publish', token: preview.token }) });
        version.current = response.version; setRevision(response.version); setStatus(response.status); setStarted(true); setResult(response.message); setPreview(null); onCreated();
      }
    } catch (error) { setPreview(null); setError(error instanceof Error ? error.message : 'Publicarea nu a fost confirmată.'); }
    finally { setBusy(false); }
  }
  const stepLabels = ['Proprietate', 'Conținut', 'Audiență și buget', 'Verificare'];
  const stepHints = ['Alege ce promovezi', 'Construiește povestea', 'Definește distribuția', 'Pregătește lansarea'];
  const stepTitles = ['Începe cu proprietatea.', 'O reclamă care atrage priviri.', 'Ajungi la publicul potrivit.', 'Totul pregătit?'];
  const stepDescriptions = ['Alege proprietatea și profilul care va reprezenta agenția.', 'Selectează materialul și scrie mesajul pe care îl vor vedea oamenii.', 'Stabilește locația, bugetul și perioada campaniei.', 'Administratorul verifică versiunea și confirmă aprobarea cu publicare.'];
  return <DialogPrimitive.Root open onOpenChange={open => { if (!open && !busy) void close(); }}>
    <DialogPrimitive.Portal><DialogPrimitive.Overlay className="tt-composer-backdrop" />
    <DialogPrimitive.Content className="tt-design tt-composer" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
      <header className="tt-composer-header"><div><StudioEyebrow>AD STUDIO / TIKTOK</StudioEyebrow><DialogPrimitive.Title className="tt-composer-title">Creează reclamă</DialogPrimitive.Title><DialogPrimitive.Description className="tt-composer-subtitle">{advertiser?.name} · {approvalLabels[status]} · {saving || `Versiunea ${revision}`}</DialogPrimitive.Description></div><Button variant="outline" disabled={busy} onClick={() => void close()} >{locked ? 'Închide' : 'Salvează și închide'}</Button></header>
      <div className="tt-composer-progress" aria-hidden="true"><span style={{ width: `${(step + 1) * 25}%` }} /></div><div className="tt-composer-layout">
        <nav className="tt-steps" aria-label="Pașii reclamei">{stepLabels.map((label, index) => <button key={label} aria-label={`${index + 1}. ${label}`} aria-current={step === index ? 'step' : undefined} disabled={busy} onClick={() => setStep(index)} className="tt-step"><span className="tt-step-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{label}</strong><small>{stepHints[index]}</small></span></button>)}<p className="tt-step-tip"><ShieldCheck />Tu controlezi lansarea.<br />Nicio cheltuială fără activare explicită.</p></nav>
        <section className="tt-composer-form"><div className="tt-form-heading"><span>PASUL 0{step + 1} / 04</span><h3>{stepTitles[step]}</h3><p>{stepDescriptions[step]}</p></div><div className="tt-fields"><fieldset disabled={locked || busy} className="m-0 min-w-0 space-y-5 border-0 p-0">
          {step === 0 && <>
            <Field label="Structura reclamei"><select aria-label="Structura reclamei" className={inputClass} value={existingGroup ? 'existing' : 'new'} disabled={busy || locked || draft.mode === 'post'} onChange={event => { setExistingGroup(event.target.value === 'existing'); change({ adgroupId: '' }); }}><option value="new">Flux rapid · campanie + grup + reclamă</option><option value="existing">Adaugă reclama într-un grup existent</option></select></Field>
            {existingGroup && <><Button variant="outline" disabled={busy || locked} onClick={() => void loadOptions('adgroup')}>Încarcă grupurile disponibile</Button><select aria-label="Grup țintă" className={inputClass} value={draft.adgroupId} disabled={busy || locked} onChange={event => change({ adgroupId: event.target.value })}><option value="">Selectează grupul</option>{draft.adgroupId && !groups.some(row => row.id === draft.adgroupId) && <option value={draft.adgroupId}>Grup selectat · {draft.adgroupId}</option>}{groups.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><p className="text-xs text-slate-500">Se păstrează campania, audiența, programul și bugetul grupului.</p></>}
            <Field label="Caută proprietatea"><input className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Titlu sau localitate" /></Field>
            <Field label="Proprietate"><select className={inputClass} value={draft.propertyId} onChange={event => { const property = workspace.properties.find(item => item.id === event.target.value); change({ propertyId: event.target.value, assetId: '', name: property?.title.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '').trim() || '' }); }}><option value="">Selectează</option>{workspace.properties.filter(item => `${item.title} ${item.location}`.toLowerCase().includes(search.toLowerCase()) || item.id === draft.propertyId).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
            <Field label="Profil TikTok"><select className={inputClass} value={draft.identityId} onChange={event => change({ identityId: event.target.value, postId: '' })}><option value="">Selectează profilul autorizat</option>{workspace.permissions.map(item => <option key={item.tiktokAccountId} value={item.tiktokAccountId}>{item.username || item.tiktokAccountId}{!item.deliverAds ? ' · necesită autorizare' : ''}</option>)}</select></Field>
            <Field label="Numele reclamei"><input className={inputClass} value={draft.name} onChange={event => change({ name: event.target.value })} /></Field>
            <Field label="Obiectiv"><select className={inputClass} value={draft.objective} onChange={event => change({ objective: event.target.value as AdDraft['objective'] })}><option value="TRAFFIC">Vizite pe pagina proprietății</option><option value="VIDEO_VIEWS">Vizualizări video</option>{available('LEAD_FORM_READ') && <option value="LEAD_GENERATION">Cereri de informații prin formular</option>}</select></Field>
          </>}
          {step === 1 && <>
            <Field label="Material publicitar"><select className={inputClass} value={draft.mode} onChange={event => { change({ mode: event.target.value as AdDraft['mode'] }); if (event.target.value === 'post') setExistingGroup(true); }}><option value="video">Videoclip nou · doar în reclame</option><option value="post">Promovează o postare existentă</option></select></Field>
            {draft.mode === 'video' ? <Field label="Videoclipul proprietății"><select className={inputClass} value={draft.assetId} onChange={event => change({ assetId: event.target.value })}><option value="">Selectează un videoclip</option>{workspace.assets.filter(item => item.propertyId === draft.propertyId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="mt-2 text-xs text-slate-500">Creează sau asociază materialele în secțiunea Videoclipuri.</p></Field> : <>
              <Button variant="outline" disabled={busy || !draft.identityId} onClick={() => void loadOptions('post')}>Încarcă postările autorizate</Button><select aria-label="Postare" className={inputClass} value={draft.postId} onChange={event => change({ postId: event.target.value })}><option value="">Selectează postarea</option>{posts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <Button variant="outline" disabled={busy} onClick={() => void loadOptions('adgroup')}>Încarcă grupurile de reclame</Button><select aria-label="Grup de reclame" className={inputClass} value={draft.adgroupId} onChange={event => change({ adgroupId: event.target.value })}><option value="">Selectează grupul</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            </>}
            <Field label="Textul reclamei"><textarea className={inputClass} rows={4} value={draft.text} onChange={event => change({ text: event.target.value })} /></Field>
            <Field label="Buton"><select className={inputClass} value={draft.cta} onChange={event => change({ cta: event.target.value })}><option value="LEARN_MORE">Află mai multe</option><option value="CONTACT_US">Contactează-ne</option><option value="SIGN_UP">Înscrie-te</option></select></Field>
            {draft.objective === 'LEAD_GENERATION' ? <><Button variant="outline" disabled={busy} onClick={() => void loadOptions('form')}>Încarcă formularele</Button><select aria-label="Formular" className={inputClass} value={draft.formId} onChange={event => change({ formId: event.target.value })}><option value="">Selectează formularul aprobat</option>{forms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><a className="text-sm underline" href="https://ads.tiktok.com/" target="_blank" rel="noreferrer">Gestionează formularele în TikTok</a></> : <Field label="Pagina proprietății (HTTPS)"><input type="url" className={inputClass} value={draft.url} onChange={event => change({ url: event.target.value })} /></Field>}
          </>}
          {step === 2 && ((draft.mode === 'post' || !!draft.adgroupId) ? <p>Reclama va folosi audiența și bugetul grupului selectat. Le poți verifica și modifica din Reclame → Grupuri.</p> : <>
            <Field label="Locații"><div className="flex gap-2"><input className={inputClass} placeholder="Caută orașul sau regiunea" value={search} onChange={event => setSearch(event.target.value)} /><Button variant="outline" disabled={busy || !available('TARGETING_READ')} onClick={() => void loadOptions('location')}>Caută</Button></div>{!available('TARGETING_READ') && <p className="mt-2 text-sm text-amber-700">Contul nu permite momentan încărcarea locațiilor. Verifică integrarea în Conturi.</p>}{locations.map(item => <label key={item.id} className="my-2 flex gap-2 text-sm"><input type="checkbox" checked={draft.locationIds.includes(item.id)} onChange={event => change({ locationIds: event.target.checked ? [...draft.locationIds, item.id] : draft.locationIds.filter(id => id !== item.id) })} />{item.name}</label>)}<p className="text-xs text-slate-500">{draft.locationIds.length} locații selectate</p></Field>
            <Field label={`Buget zilnic (${advertiser?.currency || 'monedă nesincronizată'})`}><input className={inputClass} inputMode="decimal" value={draft.budget} onChange={event => change({ budget: event.target.value.replace(',', '.') })} /></Field>
            <p className="text-xs text-slate-500">Programul este exprimat în fusul contului: {advertiser?.timezone || 'nesincronizat'}.</p>
            <Field label="Început"><input type="datetime-local" className={inputClass} value={draft.start} onChange={event => change({ start: event.target.value })} /></Field><Field label="Sfârșit (opțional)"><input type="datetime-local" className={inputClass} value={draft.end} onChange={event => change({ end: event.target.value })} /></Field>
          </>)}
          </fieldset>
          {step === 3 && <><h3 className="text-lg font-semibold">Verifică înainte de aprobare</h3><dl className="tt-review"><dt>Proprietate</dt><dd className="font-semibold">{workspace.properties.find(item => item.id === draft.propertyId)?.title || 'Neselectată'}</dd><dt>Cont publicitar / profil</dt><dd>{advertiser?.name} / {workspace.permissions.find(item => item.tiktokAccountId === draft.identityId)?.username || 'Neselectat'}</dd><dt>Buget</dt><dd>{draft.mode === 'post' || draft.adgroupId ? 'Bugetul grupului existent' : `${draft.budget || '—'} ${advertiser?.currency || ''} / zi`}</dd><dt>Program</dt><dd>{draft.adgroupId ? `Programul grupului ${draft.adgroupId}` : `${draft.start || '—'} → ${draft.end || 'Fără dată de încheiere'} · ${advertiser?.timezone}`}</dd></dl><p className="rounded-xl bg-cyan-50 p-3 text-sm">Agentul trimite versiunea la verificare. Administratorul aprobă și publică printr-o singură confirmare; TikTok decide verificarea și livrarea.</p>{unavailable.length > 0 && <p className="text-sm text-amber-700">Crearea nu este disponibilă în configurația actuală a contului. Draftul poate fi păstrat.</p>}{!admin && <p className="text-sm text-slate-600">Draftul este pregătit pentru verificarea administratorului.</p>}{!locked && !admin && <Button disabled={busy} onClick={() => void decide('submit')}>Trimite spre aprobare</Button>}
            {admin && ['draft', 'submitted', 'publication_failed', 'publishing'].includes(status) && <Button disabled={busy || !workspace.status.writesEnabled || !workspace.status.spendMutationsEnabled} onClick={() => void create()}>{busy ? 'Se verifică / publică…' : preview ? 'Confirmă aprobarea și publicarea' : started ? 'Verifică și reia publicarea' : 'Aprobă și publică'}</Button>}
            {preview && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm" role="alert"><h4 className="font-semibold">Confirmarea cheltuielilor</h4><p>{preview.name} · {preview.budget} {preview.currency} · {preview.timezone}</p><p>{preview.start} → {preview.end}</p><p>{preview.createsHierarchy ? 'Se creează și se activează campania, grupul și reclama.' : 'Se activează reclama și nivelurile necesare din ierarhia existentă.'}</p>{preview.affectedAds.length > 0 && <><strong>Activarea permite livrarea și pentru {preview.affectedAds.length} alte reclame:</strong><ul>{preview.affectedAds.map(item => <li key={item.id}>{item.name} · {item.id}</li>)}</ul></>}<p>Livrarea poate consuma bugetul contului. Aprobarea TikTok nu este garantată.</p><Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Anulează confirmarea</Button></div>}
            {status === 'submitted' && <><Button variant="outline" disabled={busy} onClick={() => void decide('withdraw')}>Retrage pentru editare</Button>{admin && <><Field label="Motiv / modificări solicitate"><textarea className={inputClass} value={note} onChange={event => setNote(event.target.value)} maxLength={2000} /></Field><div className="flex gap-2"><Button disabled={busy || !note.trim()} variant="outline" onClick={() => void decide('request_changes')}>Cere modificări</Button><Button disabled={busy || !note.trim()} variant="outline" onClick={() => void decide('reject')}>Respinge</Button></div></>}</>}
            {!locked && initial.version > 0 && <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm('Ștergi acest draft? Reclamele din TikTok nu sunt șterse sau oprite.')) void decide('delete'); }}>Șterge draftul</Button>}
            {(initial.feedback || initial.publicationError) && <p className="rounded-xl bg-amber-50 p-3">{initial.feedback || initial.publicationError}</p>}
            {!!initial.history?.length && <details><summary>Istoricul versiunii</summary>{initial.history.map((event, index) => <p className="text-xs" key={index}>{new Date(event.at).toLocaleString('ro-RO')} · {event.actorUid} · {event.action} · v{event.version} {event.note}</p>)}</details>}</>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {result && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm">{result}</p>}
          </div><div className="tt-form-footer"><Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}><ArrowLeft size={15} />Înapoi</Button>{step < 3 && <Button disabled={busy} onClick={() => { setSearch(''); setStep(step + 1); }}>Continuă<ArrowRight size={15} /></Button>}</div>
        </section>
        <PhonePreview asset={draft.mode === 'video' ? asset : undefined} username={workspace.permissions.find(item => item.tiktokAccountId === draft.identityId)?.username} text={draft.text} cta={draft.cta === 'CONTACT_US' ? 'Contactează-ne' : draft.cta === 'SIGN_UP' ? 'Înscrie-te' : 'Află mai multe'} />
      </div>
    </DialogPrimitive.Content></DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="tt-field"><span>{label}</span>{children}</label>; }
