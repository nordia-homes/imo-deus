'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CHANNEL_LABELS, withinResponseWindow, type Connection, type Conversation, type Message } from '@/lib/communications/model';
import { useCommunications } from './useCommunications';

const field = 'rounded-lg border border-slate-200 bg-white p-2 text-sm';
const date = (value: string) => new Date(value).toLocaleString('ro-RO');
export default function InboxWorkspace() {
  const api = useCommunications(); const firestore = useFirestore(); const { agencyId, userProfile, user } = useAgency();
  const [rows, setRows] = useState<Conversation[]>([]); const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); const [notes, setNotes] = useState<Array<{ id: string; text: string }>>([]);
  const [channel, setChannel] = useState('all'); const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [results, setResults] = useState<Array<{ conversationId: string; messageId: string; text: string; name: string }>>([]);
  const [text, setText] = useState(''); const [note, setNote] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const sendAttempt = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const [cursor, setCursor] = useState<string | null>(null); const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ name: string; language: string; status: string }>>([]);
  const [template, setTemplate] = useState(''); const [parameters, setParameters] = useState('');
  const [propertyId, setPropertyId] = useState(''); const [contactType, setContactType] = useState('Cumparator');
  const [estimate, setEstimate] = useState(''); const [migration, setMigration] = useState('');
  const [attachment, setAttachment] = useState<{ attachmentId: string; name: string } | null>(null);
  const [consentEvidence, setConsentEvidence] = useState(''); const [consentPurpose, setConsentPurpose] = useState('marketing');
  const [newContactId, setNewContactId] = useState(''); const [newConnectionId, setNewConnectionId] = useState(''); const [connections, setConnections] = useState<Connection[]>([]);
  const load = useCallback(async (after?: string) => {
    const filters = new URLSearchParams(window.location.search);
    const data = await api(`conversations?channel=${channel}&status=${stateFilter}${after ? `&cursor=${after}` : ''}${filters.get('contactId') ? `&contactId=${encodeURIComponent(filters.get('contactId')!)}` : ''}${filters.get('propertyId') ? `&propertyId=${encodeURIComponent(filters.get('propertyId')!)}` : ''}`);
    setRows(prev => after ? [...prev, ...data.conversations] : data.conversations); setCursor(data.cursor);
  }, [api, channel, stateFilter]);
  useEffect(() => { api('dashboard').then(d => { setConnections(d.connections.filter((c: Connection) => c.channel === 'whatsapp' && c.status === 'connected')); setNewContactId(new URLSearchParams(window.location.search).get('contactId') || ''); }).catch(e => setError(e.message)); }, [api]);
  const open = useCallback(async (id: string, more?: string, target?: string) => {
    const data = await api(`conversations/${id}/messages${more ? `?cursor=${more}` : target ? `?target=${target}` : ''}`);
    setSelected(data.conversation); setMessages(prev => more ? [...prev, ...data.messages] : data.messages); setMessageCursor(data.cursor);
    if (!more) { const payload = await api(`conversations/${id}/notes`); setNotes(payload.notes); }
    if (target) setTimeout(() => document.getElementById(`message-${target}`)?.scrollIntoView({ block: 'center' }), 100);
  }, [api]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('conversationId'); if (id) open(id).catch(e => setError(e.message)); }, [open]);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => {
    if (!agencyId || !user) return;
    const base = collection(firestore, 'agencies', agencyId, 'conversations');
    const q = userProfile?.role === 'admin' ? query(base, orderBy('lastMessageAt', 'desc'), limit(30)) : query(base, where('accessUids', 'array-contains', user.uid), orderBy('lastMessageAt', 'desc'), limit(30));
    return onSnapshot(q, () => { load().catch(e => setError(e.message)); }, e => setError(e.message));
  }, [agencyId, firestore, load, user, userProfile?.role]);
  useEffect(() => {
    if (!agencyId || !selected?.id) return;
    const id = selected.id;
    let initial = true;
    return onSnapshot(query(collection(firestore, 'agencies', agencyId, 'conversations', id, 'messages'), orderBy('createdAt', 'desc'), limit(50)), () => { if (initial) { initial = false; return; } open(id).catch(e => setError(e.message)); }, e => setError(e.message));
  }, [agencyId, firestore, selected?.id, open]);
  useEffect(() => { if (userProfile?.role === 'admin') api('agents').then(d => setAgents(d.agents)).catch(e => setError(e.message)); }, [api, userProfile?.role]);
  useEffect(() => {
    setTemplate(''); setEstimate(''); setText(''); setNote(false); setTemplates([]); setAttachment(null);
    if (selected?.channel === 'whatsapp') api(`templates/${selected.connectionId}`).then(d => setTemplates((d.data || []).filter((t: { status: string }) => t.status === 'APPROVED'))).catch(e => setError(e.message));
  }, [api, selected?.id, selected?.channel, selected?.connectionId]);
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Operația a eșuat.'); } finally { setBusy(false); } }
  async function patch(data: Record<string, unknown>) { if (!selected) return; await api(`conversations/${selected.id}`, 'PATCH', { ...data, version: selected.version }); await open(selected.id); await load(); }
  const buildMessage = () => { const [name, language] = template.split('|'); return { requestId: crypto.randomUUID(), text, ...(attachment ? { attachmentId: attachment.attachmentId } : {}), ...(name ? { template: { name, language, parameters: parameters ? parameters.split('\n') : [] } } : {}) }; };
  async function send() {
    if (!selected) return;
    if (note) await api(`conversations/${selected.id}/notes`, 'POST', { text });
    else {
      const body = buildMessage();
      const fingerprint = JSON.stringify({ conversationId: selected.id, text: body.text, attachmentId: body.attachmentId, template: body.template });
      if (sendAttempt.current?.fingerprint !== fingerprint) sendAttempt.current = { fingerprint, requestId: body.requestId };
      await api(`conversations/${selected.id}/messages`, 'POST', { ...body, requestId: sendAttempt.current.requestId });
      sendAttempt.current = null;
    }
    setText(''); setEstimate(''); setAttachment(null); await open(selected.id);
  }
  async function upload(file: File) {
    if (!user || !selected) return;
    const form = new FormData(); form.set('file', file); form.set('conversationId', selected.id);
    const response = await fetch('/api/communications-media', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body: form });
    const value = await response.json(); if (!response.ok) throw new Error(value.message); setAttachment(value);
  }
  async function download(messageId: string, index: number, name: string) {
    if (!user || !selected) return;
    const response = await fetch(`/api/communications-media?conversationId=${selected.id}&messageId=${messageId}&index=${index}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (!response.ok) throw new Error((await response.json()).message);
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function migrate() {
    let next: string | null = null; let total = 0;
    do { const data = await api('migrate', 'POST', { cursor: next || undefined }); next = data.cursor; total += data.imported; setMigration(`${total} conversații verificate`); } while (next);
    await load();
  }
  return <div className="min-h-screen bg-slate-50 p-4 text-slate-900 lg:p-6">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-semibold">Inbox</h1><p className="text-sm text-slate-500">Conversațiile agenției, conectate la clienți și proprietăți.</p></div><div className="flex gap-2"><Button variant="outline" asChild><Link href="/marketing/whatsapp">Canale</Link></Button><Button variant="outline" asChild><Link href="/inbox/storia">Istoric Storia</Link></Button>{userProfile?.role === 'admin' && <Button disabled={busy} variant="outline" onClick={() => act(migrate)}>Importă Storia</Button>}</div></header>
    {error && <div role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>}{migration && <p className="mb-3 text-sm">{migration}</p>}
    <details className="mb-4 rounded-lg border bg-white p-3"><summary className="cursor-pointer text-sm font-medium">Conversație WhatsApp cu un contact CRM</summary><div className="mt-3 flex flex-wrap gap-2"><Input className="max-w-xs" value={newContactId} onChange={e => setNewContactId(e.target.value)} placeholder="ID contact CRM"/><select className={field} value={newConnectionId} onChange={e => setNewConnectionId(e.target.value)}><option value="">Numărul agenției</option>{connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button disabled={busy || !newContactId || !newConnectionId} onClick={() => act(async () => { const d = await api('conversations','POST',{contactId:newContactId,connectionId:newConnectionId}); await open(d.conversationId); await load(); })}>Deschide conversația</Button></div><p className="mt-2 text-xs text-slate-500">Nu se trimite niciun mesaj la deschidere. Pentru inițiere sunt necesare consimțământul și un șablon aprobat.</p></details>
    <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)_250px]">
      <aside className="rounded-xl border bg-white p-3"><form className="flex gap-1" onSubmit={e => { e.preventDefault(); act(async () => { const d = await api(`search?q=${encodeURIComponent(search)}`); setResults(d.results); }); }}><Input aria-label="Caută în conversații" value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) setResults([]); }} placeholder="Nume, telefon, mesaj…"/><Button type="submit" variant="outline">Caută</Button></form>
        <select aria-label="Canal" className={`my-3 w-full ${field}`} value={channel} onChange={e => setChannel(e.target.value)}><option value="all">Toate canalele</option>{Object.entries(CHANNEL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Starea conversației" className={`mb-3 w-full ${field}`} value={stateFilter} onChange={e => setStateFilter(e.target.value)}>{[['all','Toate stările'],['new','Noi'],['open','Deschise'],['waiting','În așteptare'],['resolved','Rezolvate'],['snoozed','Amânate'],['spam','Spam']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
        <div className="max-h-[65vh] space-y-1 overflow-auto">{results.map(r => <button key={r.messageId} className="w-full rounded-lg bg-blue-50 p-3 text-left" onClick={() => act(() => open(r.conversationId, undefined, r.messageId))}><strong>{r.name}</strong><p className="line-clamp-3 text-sm">{r.text}</p></button>)}{rows.map(c => <button key={c.id} onClick={() => act(() => open(c.id))} className={`w-full rounded-lg p-3 text-left ${selected?.id === c.id ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-slate-50'}`}><strong className="block truncate">{c.name}</strong><span className="text-xs text-slate-500">{CHANNEL_LABELS[c.channel]}{c.needsReply ? ' · De răspuns' : ''}</span><p className="truncate text-sm">{c.latestMessage}</p><time className="text-xs text-slate-400">{date(c.lastMessageAt)}</time></button>)}{!rows.length && <p className="p-4 text-sm text-slate-500">Conectează un canal sau importă istoricul Storia pentru a vedea conversațiile.</p>}{cursor && <Button variant="ghost" onClick={() => act(() => load(cursor))}>Mai multe</Button>}</div>
      </aside>
      <main className="flex min-h-[70vh] flex-col rounded-xl border bg-white p-4">{selected ? <><div className="mb-3 flex items-center justify-between border-b pb-3"><div><h2 className="font-semibold">{selected.name}</h2><p className="text-xs text-slate-500">{CHANNEL_LABELS[selected.channel]} · {selected.channel !== 'storia' && (withinResponseWindow(selected.lastInboundAt) ? 'Fereastră de răspuns activă' : 'Fereastră de răspuns închisă')}</p></div><Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => patch({ read: true }))}>Marchează citit</Button></div>
      <div className="flex max-h-[52vh] flex-1 flex-col gap-3 overflow-auto">{messageCursor && <Button variant="ghost" onClick={() => act(() => open(selected.id, messageCursor))}>Mesaje mai vechi</Button>}{[...messages].sort((a,b) => a.createdAt.localeCompare(b.createdAt)).map(m => <article id={`message-${m.id}`} key={m.id} className={`max-w-[90%] rounded-xl p-3 ${m.direction === 'sent' ? 'self-end bg-emerald-50' : 'self-start bg-slate-100'}`}><p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>{m.attachments.map((a,i) => <button key={i} className="mt-1 block text-xs underline" onClick={() => act(() => download(m.id, i, a.name))}>📎 {a.name}</button>)}<p className="mt-2 text-[11px] text-slate-500">{date(m.createdAt)} · {m.direction === 'sent' ? `${m.origin === 'imodeus' ? 'ImoDeus' : 'Aplicație externă'} · ${m.status}` : 'Primit'}</p>{m.error && <p className="text-xs text-red-700">{m.error}</p>}</article>)}{notes.map(n => <div key={n.id} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm"><strong>Notă internă</strong><p className="whitespace-pre-wrap">{n.text}</p></div>)}</div>
      <div className="mt-3 space-y-2 border-t pt-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={note} onChange={e => setNote(e.target.checked)}/>Notă internă</label>{selected.channel === 'whatsapp' && !note && <><select className={field} aria-label="Șablon WhatsApp" value={template} onChange={e => { setTemplate(e.target.value); setEstimate(''); }}><option value="">Mesaj liber</option>{templates.map(t => <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>)}</select>{template && <Textarea aria-label="Parametri șablon" placeholder="Valorile șablonului, câte una pe linie" value={parameters} onChange={e => setParameters(e.target.value)}/>}</>}
        <Textarea aria-label={note ? 'Notă internă' : 'Mesaj către client'} value={text} onChange={e => { setText(e.target.value); setEstimate(''); }} placeholder={note ? 'Scrie pentru echipă…' : 'Scrie un răspuns…'}/>{estimate && <p className="text-xs">{estimate}</p>}
        {!note && !template && selected.channel !== 'storia' && <label className="block text-xs">Atașament JPEG, PNG sau PDF (max. 10 MB)<input type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) act(() => upload(file)); e.target.value = ''; }}/></label>}{attachment && <button className="text-xs underline" onClick={() => setAttachment(null)}>{attachment.name} · Elimină</button>}
        {['messenger','instagram'].includes(selected.channel) && <Button variant="outline" disabled={busy} onClick={() => act(async () => { await api(`conversations/${selected.id}/sync`, 'POST', {}); await open(selected.id); })}>Sincronizează istoricul disponibil</Button>}
        <div className="flex flex-wrap gap-2"><Button disabled={busy || (!text.trim() && !template && !attachment) || (!note && selected.channel === 'storia')} onClick={() => act(send)}>{note ? 'Salvează nota' : 'Trimite'}</Button>{!note && selected.channel !== 'storia' && <Button variant="outline" disabled={busy} onClick={() => act(async () => { const d = await api(`conversations/${selected.id}/preview`, 'POST', buildMessage()); setEstimate(`Cost estimat: ${(d.estimate.amountMicros / 1000000).toFixed(4)} ${d.estimate.currency} · ${d.estimate.category}`); })}>Verifică trimiterea</Button>}{selected.externalUrl && <Button asChild variant="outline"><a href={selected.externalUrl} target="_blank" rel="noreferrer">Deschide în Storia</a></Button>}</div></div></> : <div className="m-auto text-center text-slate-500">Selectează o conversație.</div>}</main>
      <aside className="space-y-4 rounded-xl border bg-white p-4">{selected && <><h2 className="font-semibold">Contact și activitate</h2><p className="text-sm">{selected.phone || selected.email || 'Date de contact necompletate'}</p>{selected.contactId ? <Button variant="outline" asChild><Link href="/leads">Vezi cumpărătorii</Link></Button> : <div className="space-y-2"><select className={field} value={contactType} onChange={e => setContactType(e.target.value)} aria-label="Tip contact"><option value="Cumparator">Cumpărător</option><option value="Client">Client / proprietar</option><option value="Partener">Partener</option></select><Button disabled={busy} variant="outline" onClick={() => act(async () => { await api(`conversations/${selected.id}/contact`, 'POST', { contactType }); await open(selected.id); })}>Adaugă în CRM</Button></div>}
      <label className="block text-sm">Stare<select className={`mt-1 w-full ${field}`} value={selected.status} onChange={e => act(() => patch({ status: e.target.value }))}><option value="new">Nouă</option><option value="open">În lucru</option><option value="waiting">Așteaptă clientul</option><option value="resolved">Rezolvată</option><option value="spam">Spam</option></select></label>
      {userProfile?.role === 'admin' && selected.channel === 'whatsapp' && <details><summary className="cursor-pointer text-sm font-medium">Consimțământ WhatsApp</summary><select className={field} value={consentPurpose} onChange={e => setConsentPurpose(e.target.value)}><option value="marketing">Oferte / marketing</option><option value="service">Comunicare de serviciu</option></select><Textarea className="my-2" placeholder="Dovada și data acordului sau retragerii" value={consentEvidence} onChange={e => setConsentEvidence(e.target.value)}/><div className="flex gap-1">{[['granted','Înregistrează'],['revoked','Retrage']].map(([status,label]) => <Button key={status} size="sm" variant="outline" disabled={busy || consentEvidence.trim().length < 10} onClick={() => act(async () => { await api('consent', 'POST', { conversationId:selected.id,purpose:consentPurpose,status,evidence:consentEvidence }); setConsentEvidence(''); })}>{label}</Button>)}</div></details>}
      {userProfile?.role === 'admin' && <label className="block text-sm">Agent responsabil<select className={`mt-1 w-full ${field}`} value={selected.assigneeId || ''} onChange={e => act(() => patch({ assigneeId: e.target.value || null }))}><option value="">Neatribuită</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      <div className="space-y-2"><h3 className="text-sm font-medium">Proprietăți</h3>{selected.propertyIds.map(id => <Link key={id} className="block truncate text-sm text-emerald-700" href={`/properties/${id}`}>{id}</Link>)}<Input placeholder="ID proprietate" value={propertyId} onChange={e => setPropertyId(e.target.value)}/><Button variant="outline" disabled={busy || !propertyId} onClick={() => act(() => patch({ propertyId }))}>Asociază</Button></div><Button variant="outline" asChild><Link href="/viewings">Vizionări</Link></Button></>}</aside>
    </div>
  </div>;
}


