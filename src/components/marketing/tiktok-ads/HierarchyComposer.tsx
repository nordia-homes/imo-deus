'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Layers3, Megaphone, ShieldCheck } from 'lucide-react';
import { Button, StudioEyebrow } from './StudioPrimitives';
import { Field } from './AdComposer';
import { buildAdGroupInput, buildCampaignInput, emptyAdDraft, records, schemaMissing, type AdDraft, type TikTokRow } from '@/lib/tiktok-ads/workspace-model';
import type { TikTokOperationResult } from '@/lib/tiktok-ads/types';
import { inputClass, type Api, type Workspace } from './workspace-types';

export function HierarchyComposer({ kind, initialCampaign, api, workspace, advertiserId, onClose, onCreated }: {
  kind: 'campaign' | 'adgroup'; initialCampaign?: TikTokRow; api: Api; workspace: Workspace; advertiserId: string;
  onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState<AdDraft>({ ...emptyAdDraft });
  const [campaignId, setCampaignId] = useState(initialCampaign?.id || '');
  const [campaigns, setCampaigns] = useState<TikTokRow[]>(initialCampaign ? [initialCampaign] : []);
  const [locations, setLocations] = useState<TikTokRow[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(kind === 'adgroup');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<TikTokOperationResult | null>(null);
  const command = useRef(crypto.randomUUID());
  const submittedPayload = useRef<Record<string, unknown> | null>(null);
  const advertiser = workspace.advertisers.find(item => item.advertiserId === advertiserId);
  const capability = kind === 'campaign' ? 'CAMPAIGN_CREATE' : 'ADGROUP_CREATE';
  const available = workspace.role !== 'agent' && workspace.status.writesEnabled && workspace.capabilities.some(item => item.capability === capability && item.executionAllowed);
  const selectedCampaign = campaigns.find(item => item.id === campaignId);
  const objective = selectedCampaign?.objectiveType;
  const supportedObjective = !objective || ['TRAFFIC', 'VIDEO_VIEWS', 'LEAD_GENERATION'].includes(objective);
  const locked = busy || submitted;
  const title = kind === 'campaign' ? 'Creează campanie' : 'Creează grup de reclame';
  const edit = (patch: Partial<AdDraft>) => { if (!locked) setForm(current => ({ ...current, ...patch })); };

  useEffect(() => {
    if (kind !== 'adgroup') return;
    let live = true;
    void api<{ rows: TikTokRow[] }>(`/api/marketing/tiktok-ads/manager?advertiserId=${encodeURIComponent(advertiserId)}&kind=campaign`)
      .then(data => { if (live) setCampaigns(data.rows); })
      .catch(error => { if (live) setError(error.message); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [api, advertiserId, kind]);

  async function searchLocations() {
    setBusy(true); setError('');
    try {
      const data = await api<{ rows: TikTokRow[] }>(`/api/marketing/tiktok-ads/manager?${new URLSearchParams({ advertiserId, kind: 'location', search })}`);
      setLocations(current => [...new Map([...current, ...data.rows].map(row => [row.id, row])).values()]);
    } catch (error) { setError(error instanceof Error ? error.message : 'Locațiile nu au putut fi încărcate.'); }
    finally { setBusy(false); }
  }

  async function create() {
    setBusy(true); setError('');
    try {
      if (!available) throw new Error('Crearea nu este permisă în configurația actuală. Verifică secțiunea Conturi.');
      if (!submittedPayload.current) {
        if (!form.name.trim()) throw new Error('Completează numele.');
        if (kind === 'adgroup') {
          if (!selectedCampaign) throw new Error('Selectează o campanie din contul curent.');
          if (!supportedObjective) throw new Error('Obiectivul acestei campanii nu este acceptat de acest formular.');
          if (!advertiser?.timezone || !advertiser.currency) throw new Error('Sincronizează moneda și fusul orar al contului.');
          if (!/^\d+(\.\d{1,4})?$/.test(form.budget) || Number(form.budget) <= 0 || !form.locationIds.length || !form.start) throw new Error('Completează bugetul zilnic, locațiile și începutul programului.');
          if (form.end && form.end <= form.start) throw new Error('Sfârșitul trebuie să fie după început.');
        }
        const values = { ...form, name: form.name.trim(), objective: (objective || form.objective) as AdDraft['objective'] };
        const payload = kind === 'campaign'
          ? buildCampaignInput(values, workspace.schemas.CAMPAIGN_CREATE)
          : buildAdGroupInput(values, workspace.schemas.ADGROUP_CREATE, advertiser!.timezone!, campaignId);
        if (kind === 'adgroup' && !records(payload).some(row => row.campaign_id === campaignId || row.campaignId === campaignId)) throw new Error('Configurația TikTok nu permite asocierea sigură cu această campanie.');
        const missing = schemaMissing(workspace.schemas[capability], payload, ['advertiser_id', 'advertiser_ids', 'operation_status', 'opt_status']);
        if (missing.length) throw new Error(`Configurația contului cere informații suplimentare: ${missing.join(', ')}.`);
        submittedPayload.current = payload; setSubmitted(true);
      }
      const response = await api<TikTokOperationResult>('/api/marketing/tiktok-ads/operations', { method: 'POST', body: JSON.stringify({ advertiserId, capability, payload: submittedPayload.current, idempotencyKey: command.current, expectedVersion: advertiser?.version }) });
      setResult(response); onCreated();
    } catch (error) { setError(error instanceof Error ? error.message : 'Crearea a eșuat. Verifică istoricul operațiunilor.'); }
    finally { setBusy(false); }
  }

  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}><Dialog.Portal><Dialog.Overlay className="tt-composer-backdrop" />
    <Dialog.Content className="tt-design tt-hierarchy-composer" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
      <header className="tt-composer-header"><div><StudioEyebrow>{kind === 'campaign' ? '01 / CAMPANIE' : '02 / GRUP DE RECLAME'}</StudioEyebrow><Dialog.Title className="tt-composer-title">{title}</Dialog.Title><Dialog.Description className="tt-composer-subtitle">{advertiser?.name} · {kind === 'campaign' ? 'Definește obiectivul. Adaugă grupurile ulterior.' : 'Alege campania, audiența și bugetul.'}</Dialog.Description></div><Button variant="outline" disabled={busy} onClick={onClose}>Închide</Button></header>
      <div className="tt-hierarchy-body"><fieldset disabled={locked} className="tt-fields">
        <div className="tt-hierarchy-intro">{kind === 'campaign' ? <Megaphone /> : <Layers3 />}<p>{kind === 'campaign' ? 'O campanie poate conține mai multe grupuri și reclame. Bugetele vor fi stabilite la nivel de grup.' : 'Acest grup va aparține campaniei selectate. Reclamele adăugate ulterior îi vor folosi audiența și bugetul.'}</p></div>
        {kind === 'adgroup' && <Field label="Campanie"><select aria-label="Campanie" className={inputClass} value={campaignId} onChange={event => setCampaignId(event.target.value)}><option value="">Selectează campania</option>{campaigns.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{!busy && !campaigns.length && <p className="text-sm text-slate-500">Nu există campanii în lista încărcată. Creează mai întâi o campanie.</p>}</Field>}
        <Field label={kind === 'campaign' ? 'Numele campaniei' : 'Numele grupului'}><input aria-label={kind === 'campaign' ? 'Numele campaniei' : 'Numele grupului'} className={inputClass} value={form.name} onChange={event => edit({ name: event.target.value })} maxLength={512} /></Field>
        <Field label="Obiectiv"><select aria-label="Obiectiv" className={inputClass} disabled={!!objective} value={objective || form.objective} onChange={event => edit({ objective: event.target.value as AdDraft['objective'] })}><option value="TRAFFIC">Vizite pe pagina proprietății</option><option value="VIDEO_VIEWS">Vizualizări video</option><option value="LEAD_GENERATION">Cereri prin formular TikTok</option>{!supportedObjective && <option value={objective}>{objective} · nesuportat</option>}</select>{kind === 'adgroup' && <p className="text-xs text-slate-500">{objective ? 'Obiectiv moștenit din campanie.' : 'Obiectivul nu a fost returnat de TikTok. Alege obiectivul campaniei existente.'}</p>}</Field>
        {kind === 'adgroup' && <>
          <Field label="Locații"><div className="flex gap-2"><input aria-label="Caută locații" className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Oraș sau regiune" /><Button variant="outline" onClick={() => void searchLocations()}>Caută locații</Button></div></Field>
          <div className="tt-hierarchy-locations">{locations.map(row => <label key={row.id}><input type="checkbox" checked={form.locationIds.includes(row.id)} onChange={event => edit({ locationIds: event.target.checked ? [...form.locationIds, row.id] : form.locationIds.filter(id => id !== row.id) })} />{row.name}</label>)}</div>
          <Field label={`Buget zilnic (${advertiser?.currency || '—'})`}><input aria-label="Buget zilnic" className={inputClass} inputMode="decimal" value={form.budget} onChange={event => edit({ budget: event.target.value.replace(',', '.') })} /></Field>
          <p className="text-xs text-slate-500">Program în fusul contului: {advertiser?.timezone || 'nesincronizat'}. Limitele de buget sunt validate de TikTok.</p>
          <Field label="Început"><input aria-label="Început" className={inputClass} type="datetime-local" value={form.start} onChange={event => edit({ start: event.target.value })} /></Field>
          <Field label="Sfârșit (opțional)"><input className={inputClass} type="datetime-local" value={form.end} onChange={event => edit({ end: event.target.value })} /></Field>
        </>}
      </fieldset>
      <p className="tt-hierarchy-safety"><ShieldCheck />Se creează oprită. Nicio reclamă nu este creată sau activată prin această acțiune.</p>
      {!available && <p role="status">Crearea necesită acces de administrator și permisiunea contului pentru această operație.</p>}
      {error && <p role="alert" className="tt-voice-error">{error}</p>}
      {submitted && !result && !busy && <p className="text-sm text-slate-500">Cererea a fost trimisă. Reîncercarea folosește aceeași cheie, fără a genera intenționat o resursă nouă. Verifică istoricul înainte de a începe alt formular.</p>}
      {result && <p role="status">{result.status === 'succeeded' ? 'Creat cu succes, în stare oprită. Actualizează lista pentru verificare.' : 'Operația necesită verificare în Conturi → Istoric. Nu o recrea.'}</p>}
      <div className="tt-form-footer"><Button variant="outline" disabled={busy} onClick={onClose}>{result ? 'Gata' : 'Anulează'}</Button><Button disabled={busy || !!result || !available || !supportedObjective} onClick={() => void create()}>{busy ? 'Se procesează…' : submitted ? 'Reverifică aceeași cerere' : kind === 'campaign' ? 'Creează campania oprită' : 'Creează grupul oprit'}</Button></div>
      </div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
