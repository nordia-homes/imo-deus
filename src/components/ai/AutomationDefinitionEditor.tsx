'use client';
import { INSIGHT_NOTIFICATION_CAP_NOTE, WATCH_NOTIFICATION_CAP_NOTE } from '@/lib/ai-assistant/insight-notification-policy';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useAgency } from '@/context/AgencyContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { automationSchema, type AssistantAction } from '@/lib/ai-assistant/contracts';
import { briefSettingsSchema, nextBriefRun, validateBriefSettings } from '@/lib/ai-assistant/daily-brief-contract';
type Definition = z.infer<typeof automationSchema>;
type Kind = Exclude<Definition['type'], 'event_rule'>;
const names: Record<Kind, string> = { legal_source_watch: 'Schimbări în surse oficiale', daily_sales_brief: 'Prioritățile zilei', followup_task: 'Follow-up cu clientul', owner_watch: 'Căutare proprietăți', insight_report: 'Raport CRM', matching_watch: 'Matching pentru client', whatsapp_template: 'Șablon WhatsApp programat' };
const statuses = ['Nou', 'Contactat', 'Vizionare', 'În negociere', 'Câștigat', 'Pierdut'] as const;
const selectClass = 'w-full rounded-md border bg-background px-3 py-2 text-sm';
function localDate(iso?: string) { const date = new Date(iso || Date.now() + 5 * 60000); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function EntityPicker({ resource, label, value, onChange }: { resource: 'contacts' | 'conversations'; label: string; value: string; onChange: (id: string) => void }) {
  const { user } = useAgency();
  const [search, setSearch] = useState(''), [rows, setRows] = useState<Record<string, any>[]>([]), [error, setError] = useState(''), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(false);
  const load = async (more = false, signal?: AbortSignal) => {
    if (!user) return; setLoading(true); setError('');
    try {
      const headers = { Authorization: 'Bearer ' + await user.getIdToken(), 'Content-Type': 'application/json' };
      const read = async (query: Record<string, unknown>) => { const response = await fetch('/api/ai-assistant/workspace', { method: 'POST', headers, body: JSON.stringify({ kind: 'read', query: { resource, ...query } }), signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Înregistrările nu pot fi citite.'); return data; };
      const data = await read({ search, limit: 20, ...(more && cursor ? { cursor } : {}) });
      const selected = value && !data.rows.some((row: any) => row.id === value) ? (await read({ id: value })).rows : [];
      if (signal?.aborted) return;
      setRows(previous => [...new Map([...(more ? previous : []), ...selected, ...data.rows].map(row => [row.id, row])).values()]); setCursor(data.nextCursor);
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Citire nereușită.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(false, controller.signal), 300); return () => { clearTimeout(timer); controller.abort(); }; }, [search, user, resource]);
  return <div className="space-y-1"><label className="block text-sm">Caută {label.toLowerCase()}<Input value={search} onChange={e => setSearch(e.target.value)} maxLength={100} placeholder="Nume sau telefon" /></label><label className="block text-sm">{label}<select aria-label={label} className={selectClass} value={value} onChange={e => onChange(e.target.value)} required disabled={loading}><option value="">Selectează</option>{rows.map(row => <option key={row.id} value={row.id}>{row.name || row.contactName || row.title || 'Conversație'}{row.phone ? ' · ' + row.phone : ''}{row.channel ? ' · ' + row.channel : ''}</option>)}</select></label>{cursor && <Button size="sm" type="button" variant="ghost" disabled={loading} onClick={() => void load(true)}>Alte rezultate</Button>}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>;
}
export function AutomationDefinitionEditor({ row, disabled, onPrepare, onClose }: { row?: Record<string, any>; disabled: boolean; onPrepare: (actions: AssistantAction[]) => void | Promise<void>; onClose: () => void }) {
  const original = row?.automation as Exclude<Definition, { type: 'event_rule' }> | undefined;
  const [kind, setKind] = useState<Kind>(original?.type || 'followup_task');
  const [firstRun, setFirstRun] = useState(localDate(original?.nextRunAt)), [interval, setInterval] = useState(String(original?.intervalMinutes || 30)), [runs, setRuns] = useState(String(original?.maxRuns || 1)), [stopAfter, setStopAfter] = useState(original?.stopAfter ? localDate(original.stopAfter) : '');
  const [contactId, setContactId] = useState(original && 'contactId' in original ? original.contactId : ''), [conversationId, setConversationId] = useState(original?.type === 'whatsapp_template' ? original.conversationId : '');
  const [description, setDescription] = useState(original?.type === 'followup_task' ? original.description : ''), [threshold, setThreshold] = useState(String(original?.type === 'matching_watch' ? original.threshold : 60)), [limit, setLimit] = useState(String(original && 'limit' in original ? original.limit : original?.type === 'owner_watch' ? original.search.limit : 10));
  const search = original?.type === 'owner_watch' ? original.search : undefined;
  const [source, setSource] = useState(search?.source || 'owners'), [zone, setZone] = useState(search?.zone || ''), [rooms, setRooms] = useState(String(search?.rooms || '')), [priceMin, setPriceMin] = useState(String(search?.priceMin ?? '')), [priceMax, setPriceMax] = useState(String(search?.priceMax ?? '')), [propertyType, setPropertyType] = useState(search?.propertyType || ''), [transaction, setTransaction] = useState(search?.transactionType || 'sale');
  const [templateName, setTemplateName] = useState(original?.type === 'whatsapp_template' ? original.template.name : ''), [language, setLanguage] = useState(original?.type === 'whatsapp_template' ? original.template.language : 'ro'), [parameters, setParameters] = useState(original?.type === 'whatsapp_template' ? original.template.parameters : []), [stopOnReply, setStopOnReply] = useState(original?.type === 'whatsapp_template' ? original.stopOnReply : true);
  const [stopStatuses, setStopStatuses] = useState(original?.stopOnContactStatuses || []), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [sourceUrls, setSourceUrls] = useState(original?.type === 'legal_source_watch' ? original.sourceUrls.join('; ') : '');
  const [cooldown, setCooldown] = useState(String(original?.type === 'insight_report' ? original.cooldownMinutes ?? 1440 : 1440));
  const initialQuiet = original && 'quietHours' in original ? original.quietHours : undefined;
  const [quietEnabled, setQuietEnabled] = useState(original ? Boolean(initialQuiet) : true);
  const [quietTimezone, setQuietTimezone] = useState(initialQuiet?.timezone || 'Europe/Bucharest');
  const [reportQuietStart, setReportQuietStart] = useState(initialQuiet?.start || '22:00');
  const [reportQuietEnd, setReportQuietEnd] = useState(initialQuiet?.end || '08:00');
  const save = async () => {
    setError(''); setSaving(true);
    try {
      const nextRunAt = original?.nextRunAt && firstRun === localDate(original.nextRunAt) ? original.nextRunAt : new Date(firstRun).toISOString(), maxRuns = Number(runs);
      if (Date.parse(nextRunAt) <= Date.now()) throw new Error('Alege prima execuție în viitor.');
      if (row && maxRuns <= Number(row.runCount || 0)) throw new Error('Limita trebuie să depășească execuțiile deja efectuate.');
      if (stopAfter && new Date(stopAfter).getTime() <= Date.parse(nextRunAt)) throw new Error('Oprirea trebuie să fie după prima execuție.');
      if (priceMin && priceMax && Number(priceMin) > Number(priceMax)) throw new Error('Bugetul minim nu poate depăși maximul.');
      const timing = { nextRunAt, intervalMinutes: Number(interval), maxRuns, ...(stopAfter ? { stopAfter: original?.stopAfter && stopAfter === localDate(original.stopAfter) ? original.stopAfter : new Date(stopAfter).toISOString() } : {}), ...(['followup_task', 'matching_watch'].includes(kind) ? { stopOnContactStatuses: stopStatuses } : {}) };
      const config = kind === 'legal_source_watch' ? { sourceUrls: sourceUrls.split(';').map(value => value.trim()).filter(Boolean) } : kind === 'followup_task' ? { contactId, description } : kind === 'matching_watch' ? { contactId, threshold: Number(threshold), limit: Number(limit) } : kind === 'insight_report' ? { limit: Number(limit) } : kind === 'whatsapp_template' ? { conversationId, stopOnReply, template: { name: templateName.trim(), language: language.trim(), parameters } } : { search: { ...(search?.scopeKey ? { scopeKey: search.scopeKey } : {}), source, transactionType: transaction, limit: Number(limit), ...(zone.trim() ? { zone: zone.trim() } : {}), ...(rooms ? { rooms: Number(rooms) } : {}), ...(priceMin ? { priceMin: Number(priceMin) } : {}), ...(priceMax ? { priceMax: Number(priceMax) } : {}), ...(propertyType ? { propertyType } : {}) } };
      const automation = automationSchema.parse({ type: kind, ...timing, ...config, ...(kind === 'insight_report' ? { cooldownMinutes: Number(cooldown) } : {}), ...(['insight_report', 'owner_watch', 'matching_watch'].includes(kind) && quietEnabled ? { quietHours: { timezone: quietTimezone, start: reportQuietStart, end: reportQuietEnd } } : {}) });
      // Settings without editor controls must survive a quiet-hours-only edit.
      if (automation.type === 'owner_watch' && search) {
        for (const key of ['yearMin', 'yearMax', 'unknownYear', 'excludeImported', 'yearLabel'] as const) {
          if (search[key] !== undefined) Object.assign(automation.search, { [key]: search[key] });
        }
        if (!rooms && search.roomsAny) automation.search.roomsAny = search.roomsAny;
      }
      await onPrepare([row ? { kind: 'update_automation', automationId: row.id, automation } : { kind: 'create_automation', automation }]); onClose();
    } catch (e) { setError(e instanceof z.ZodError ? 'Completează câmpurile obligatorii și verifică limitele introduse.' : e instanceof Error ? e.message : 'Planul nu poate fi pregătit.'); }
    finally { setSaving(false); }
  };
  if (kind === 'daily_sales_brief') return <div><Button type="button" variant="ghost" size="sm" onClick={() => setKind('followup_task')}>Alt tip de automatizare</Button><DailyBriefEditor row={row} disabled={disabled} onPrepare={onPrepare} onClose={onClose} /></div>;
  return <form aria-label="Configurare automatizare" className="space-y-3 rounded-xl border p-3" onSubmit={e => { e.preventDefault(); void save(); }}>
    <label className="block text-sm">Tip automatizare<select aria-label="Tip automatizare" className={selectClass} value={kind} disabled={Boolean(row)} onChange={e => { setKind(e.target.value as Kind); if (e.target.value === 'legal_source_watch') setInterval('1440'); }}>{Object.entries(names).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    {['followup_task', 'matching_watch'].includes(kind) && <EntityPicker resource="contacts" label="Client" value={contactId} onChange={setContactId} />}
    {kind === 'legal_source_watch' && <label className="block text-sm">Surse oficiale (1–3 URL-uri, separate prin ;)<Input value={sourceUrls} onChange={e => setSourceUrls(e.target.value)} required maxLength={6002} /><span className="text-xs text-muted-foreground">Prima citire stabilește referința. Primești o notificare doar la schimbarea conținutului; aplicabilitatea juridică necesită revizuire.</span></label>}
    {kind === 'followup_task' && <label className="block text-sm">Sarcina de follow-up<Input value={description} onChange={e => setDescription(e.target.value)} required maxLength={2000} /></label>}
    {kind === 'matching_watch' && <label className="block text-sm">Scor minim matching<Input type="number" min="0" max="100" value={threshold} onChange={e => setThreshold(e.target.value)} required /></label>}
    {kind === 'insight_report' && <label className="block text-sm">Pauză între alertele aceleiași priorități, minute<Input type="number" min="30" max="43200" value={cooldown} onChange={e => setCooldown(e.target.value)} required /><span className="text-xs text-muted-foreground">Implicit 1440 minute (24 de ore). Pauza se aplică între rapoartele tale din această agenție. Verificările fără alertă nu o prelungesc; după expirare problema poate fi semnalată din nou dacă persistă.</span></label>}
    {['owner_watch', 'matching_watch'].includes(kind) && <p className="text-xs text-muted-foreground">{WATCH_NOTIFICATION_CAP_NOTE}</p>}
    {kind === 'insight_report' && <p className="text-xs text-muted-foreground">{INSIGHT_NOTIFICATION_CAP_NOTE}</p>}
    {['insight_report', 'owner_watch', 'matching_watch'].includes(kind) && <fieldset className="space-y-2"><label className="flex gap-2 text-sm"><input type="checkbox" checked={quietEnabled} onChange={e => setQuietEnabled(e.target.checked)} />Interval de liniște pentru alerte</label>{quietEnabled && <><label className="block text-sm">Fus orar pentru alerte<Input value={quietTimezone} onChange={e => setQuietTimezone(e.target.value)} required /></label><div className="grid grid-cols-2 gap-2"><label className="text-sm">Liniște de la<Input type="time" value={reportQuietStart} onChange={e => setReportQuietStart(e.target.value)} required /></label><label className="text-sm">Până la<Input type="time" value={reportQuietEnd} onChange={e => setReportQuietEnd(e.target.value)} required /></label></div><p className="text-xs text-muted-foreground">Verificarea se amână până la sfârșitul intervalului și recitește datele, fără să consume o execuție. Orele egale dezactivează intervalul de liniște.</p></>}</fieldset>}
    {kind === 'owner_watch' && <><label className="block text-sm">Sursa proprietăților<select className={selectClass} value={source} onChange={e => setSource(e.target.value as 'owners' | 'crm')}><option value="owners">Anunțuri proprietari</option><option value="crm">Portofoliul CRM</option></select></label><label className="block text-sm">Zona căutării<Input value={zone} onChange={e => setZone(e.target.value)} maxLength={100} /></label><label className="block text-sm">Tip proprietate<select className={selectClass} value={propertyType} onChange={e => setPropertyType(e.target.value as typeof propertyType)}><option value="">Oricare</option><option value="apartment">Apartament</option><option value="house">Casă</option><option value="land">Teren</option><option value="commercial">Spațiu comercial</option></select></label><label className="block text-sm">Tranzacție<select className={selectClass} value={transaction} onChange={e => setTransaction(e.target.value as 'sale' | 'rent')}><option value="sale">Vânzare</option><option value="rent">Închiriere</option></select></label><label className="block text-sm">Camere<Input type="number" min="1" max="30" value={rooms} onChange={e => setRooms(e.target.value)} /></label><label className="block text-sm">Buget minim EUR<Input type="number" min="0" value={priceMin} onChange={e => setPriceMin(e.target.value)} /></label><label className="block text-sm">Buget maxim EUR<Input type="number" min="1" value={priceMax} onChange={e => setPriceMax(e.target.value)} /></label></>}
    {['owner_watch', 'matching_watch', 'insight_report'].includes(kind) && <label className="block text-sm">Rezultate la fiecare verificare<Input type="number" min="1" max={kind === 'owner_watch' ? 100 : 30} value={limit} onChange={e => setLimit(e.target.value)} required /></label>}
    {kind === 'whatsapp_template' && <><EntityPicker resource="conversations" label="Conversație" value={conversationId} onChange={setConversationId} /><label className="block text-sm">Numele șablonului WhatsApp<Input value={templateName} onChange={e => setTemplateName(e.target.value)} required maxLength={200} /></label><label className="block text-sm">Limba șablonului<Input value={language} onChange={e => setLanguage(e.target.value)} required maxLength={20} /></label>{parameters.map((parameter, index) => <div key={index} className="flex gap-1"><label className="flex-1 text-sm">Variabila {index + 1}<Input value={parameter} maxLength={1000} onChange={e => setParameters(items => items.map((item, i) => i === index ? e.target.value : item))} /></label><Button type="button" variant="ghost" aria-label={`Elimină variabila ${index + 1}`} onClick={() => setParameters(items => items.filter((_, i) => i !== index))}>×</Button></div>)}<Button type="button" size="sm" variant="outline" disabled={parameters.length >= 20} onClick={() => setParameters(items => [...items, ''])}>Adaugă variabilă</Button><label className="flex gap-2 text-sm"><input type="checkbox" checked={stopOnReply} onChange={e => setStopOnReply(e.target.checked)} />Oprește dacă persoana răspunde</label><p className="text-xs text-muted-foreground">Programarea folosește un șablon aprobat. Acordul și eligibilitatea WhatsApp se verifică din nou la trimitere.</p></>}
    <label className="block text-sm">Prima execuție (ora dispozitivului)<Input type="datetime-local" value={firstRun} onChange={e => setFirstRun(e.target.value)} required /></label><label className="block text-sm">Interval dintre execuții, minute<Input type="number" min="30" max="43200" value={interval} onChange={e => setInterval(e.target.value)} required /></label><label className="block text-sm">Maximum execuții<Input type="number" min="1" max="365" value={runs} onChange={e => setRuns(e.target.value)} required /></label><label className="block text-sm">Oprește la (opțional)<Input type="datetime-local" value={stopAfter} onChange={e => setStopAfter(e.target.value)} /></label>
    {['followup_task', 'matching_watch'].includes(kind) && <fieldset className="space-y-1"><legend className="text-sm">Oprește când clientul ajunge în status</legend>{statuses.map(status => <label key={status} className="flex gap-2 text-xs"><input type="checkbox" checked={stopStatuses.includes(status)} onChange={e => setStopStatuses(previous => e.target.checked ? [...previous, status] : previous.filter(item => item !== status))} />{status}</label>)}</fieldset>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<p className="text-xs text-muted-foreground">Pregătirea nu activează automatizarea. Verifică planul în conversație înainte de confirmare.</p><div className="flex gap-2"><Button type="submit" size="sm" disabled={disabled || saving}>Pregătește automatizarea</Button><Button type="button" size="sm" variant="ghost" onClick={onClose}>Închide</Button></div>
  </form>;
}

function DailyBriefEditor({ row, disabled, onPrepare, onClose }: { row?: Record<string, any>; disabled: boolean; onPrepare: (actions: AssistantAction[]) => void | Promise<void>; onClose: () => void }) {
  const initial = row?.automation?.type === 'daily_sales_brief' ? row.automation : {};
  const [timezone, setTimezone] = useState(initial.timezone || 'Europe/Bucharest');
  const [time, setTime] = useState(initial.deliveryTime || '08:30');
  const [days, setDays] = useState<number[]>(initial.daysOfWeek || [1, 2, 3, 4, 5]);
  const [channel, setChannel] = useState<'app' | 'whatsapp'>(initial.deliveryChannel || 'app');
  const [conversation, setConversation] = useState(initial.conversationId || '');
  const [template, setTemplate] = useState(initial.templateName || '');
  const [quietStart, setQuietStart] = useState(initial.quietStart || '22:00'), [quietEnd, setQuietEnd] = useState(initial.quietEnd || '08:00');
  const [count, setCount] = useState(String(initial.maxItems || 5));
  const [runs, setRuns] = useState(String(initial.maxRuns || 30));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true); setError('');
    try {
      const settings = validateBriefSettings(briefSettingsSchema.parse({ timezone, deliveryTime: time, daysOfWeek: days, quietStart, quietEnd, maxItems: Number(count), deliveryChannel: channel, language: 'ro', ...(channel === 'whatsapp' ? { conversationId: conversation, templateName: template, templateLanguage: 'ro' } : {}) }));
      const automation = automationSchema.parse({ type: 'daily_sales_brief', ...settings, nextRunAt: nextBriefRun(settings), maxRuns: Number(runs) });
      if (row && automation.maxRuns <= Number(row.runCount || 0)) throw new Error('Numărul maxim trebuie să depășească execuțiile deja efectuate.');
      await onPrepare([row ? { kind: 'update_automation', automationId: row.id, automation } : { kind: 'create_automation', automation }]); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Setările nu sunt valide.'); }
    finally { setSaving(false); }
  };
  return <form aria-label="Prioritățile zilei" className="space-y-3 rounded-xl border p-3" onSubmit={event => { event.preventDefault(); void save(); }}>
    <h3 className="text-sm font-semibold">Prioritățile zilei</h3>
    <p className="text-sm">Priorități din leaduri, sarcini, vizionări, Sales, conversații și promovare. Verificările incomplete sunt marcate; nu trimite un rezumat gol.</p>
    <label className="block text-sm">Fus orar<Input value={timezone} onChange={event => setTimezone(event.target.value)} required /></label>
    <label className="block text-sm">Ora livrării<Input type="time" value={time} onChange={event => setTime(event.target.value)} required /></label>
    <fieldset><legend className="text-sm">Zile de livrare</legend><div className="flex flex-wrap gap-3">{['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'].map((name, index) => <label key={name} className="flex gap-1 text-sm"><input type="checkbox" checked={days.includes(index)} onChange={event => setDays(previous => event.target.checked ? [...previous, index] : previous.filter(day => day !== index))} />{name}</label>)}</div></fieldset>
    <div className="grid grid-cols-2 gap-2"><label className="text-sm">Liniște de la<Input type="time" value={quietStart} onChange={event => setQuietStart(event.target.value)} /></label><label className="text-sm">Până la<Input type="time" value={quietEnd} onChange={event => setQuietEnd(event.target.value)} /></label></div>
    <label className="block text-sm">Maximum priorități<Input type="number" min="1" max="10" value={count} onChange={event => setCount(event.target.value)} /></label>
    <label className="block text-sm">Maximum livrări<Input type="number" min="1" max="365" value={runs} onChange={event => setRuns(event.target.value)} /></label>
    <label className="block text-sm">Canal<select className={selectClass} value={channel} onChange={event => setChannel(event.target.value as 'app' | 'whatsapp')}><option value="app">Notificare în imoDeus</option><option value="whatsapp">WhatsApp</option></select></label>
    {channel === 'whatsapp' && <><EntityPicker resource="conversations" label="Conversația ta pentru brief" value={conversation} onChange={setConversation} /><label className="block text-sm">Șablon aprobat în limba română<Input value={template} onChange={event => setTemplate(event.target.value)} required /></label><p className="text-xs text-muted-foreground">Alege conversația numărului tău din profil și un șablon cu o variabilă pentru rezumat. Eligibilitatea se verifică la livrare.</p></>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">Setările devin active după confirmarea planului. Poți pune automatizarea în pauză din lista existentă.</p>
    <div className="flex gap-2"><Button type="submit" disabled={disabled || saving}>Pregătește brief-ul</Button><Button type="button" variant="ghost" onClick={onClose}>Închide</Button></div>
  </form>;
}



