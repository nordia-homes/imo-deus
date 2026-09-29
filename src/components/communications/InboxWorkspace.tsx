'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Building2, CheckCheck, Clock3, ExternalLink, Inbox, MessageCircleMore, Paperclip, Plus, Search, Send, ShieldCheck, SlidersHorizontal, UserRound, UsersRound, X } from 'lucide-react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { CHANNEL_LABELS, type Connection, type Conversation, type Message } from '@/lib/communications/model';
import type { Property } from '@/lib/types';
import { useCommunications } from './useCommunications';

const field = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15';
const date = (value: string) => new Date(value).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
const time = (value: string) => new Date(value).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
const initials = (value: string) => value.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?';
const statusLabel: Record<Conversation['status'], string> = { new: 'Nouă', open: 'În lucru', waiting: 'Așteaptă clientul', snoozed: 'Amânată', resolved: 'Rezolvată', spam: 'Spam' };
const channelClass: Record<Conversation['channel'], string> = { whatsapp: 'bg-emerald-500/10 text-emerald-700', messenger: 'bg-sky-500/10 text-sky-700', instagram: 'bg-fuchsia-500/10 text-fuchsia-700', storia: 'bg-violet-500/10 text-violet-700' };
export default function InboxWorkspace() {
  const api = useCommunications(); const firestore = useFirestore(); const { agencyId, userProfile, user } = useAgency();
  const [rows, setRows] = useState<Conversation[]>([]); const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); const [notes, setNotes] = useState<Array<{ id: string; text: string }>>([]);
  const [channel, setChannel] = useState('all'); const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'conversation'>('list');
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (!detailsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetailsOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailsOpen]);
  const [results, setResults] = useState<Array<{ conversationId: string; messageId: string; text: string; name: string }>>([]);
  const [text, setText] = useState(''); const [note, setNote] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const sendAttempt = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const autoOpened = useRef(false);
  const mobileConversationRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (mobilePane !== 'conversation' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const pane = mobileConversationRef.current;
      if (!pane) return;
      pane.style.top = `${viewport.offsetTop}px`;
      pane.style.height = `${viewport.height}px`;
    };
    syncViewport();
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    return () => {
      viewport.removeEventListener('resize', syncViewport);
      viewport.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, [mobilePane, selected?.id]);
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
    setSelected(data.conversation);
    setMessages(prev => more ? [...prev, ...data.messages] : data.messages);
    setMessageCursor(data.cursor);
    if (!more) { const payload = await api(`conversations/${id}/notes`); setNotes(payload.notes); }
    if (target) setTimeout(() => document.getElementById((window.matchMedia('(max-width: 767px)').matches ? 'mobile-message-' : 'message-') + target)?.scrollIntoView({ block: 'center' }), 100);
  }, [api]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('conversationId');
    if (id) open(id).then(() => setMobilePane('conversation')).catch(e => setError(e.message));
  }, [open]);
  useEffect(() => {
    if (autoOpened.current || selected || !rows.length || new URLSearchParams(window.location.search).get('conversationId')) return;
    autoOpened.current = true;
    open(rows[0].id).catch(e => setError(e.message));
  }, [rows, selected, open]);
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
  const selectedPropertyId = selected?.propertyIds?.[0] || null;
  const propertyRef = useMemoFirebase(
    () => agencyId && selectedPropertyId ? doc(firestore, 'agencies', agencyId, 'properties', selectedPropertyId) : null,
    [agencyId, firestore, selectedPropertyId],
  );
  const { data: associatedProperty } = useDoc<Property>(propertyRef);
  const propertyImage = associatedProperty?.images?.[0]?.url;
  const attentionCount = rows.filter(row => row.needsReply).length;
  const unreadCount = user ? rows.filter(row => row.lastInboundAt && (!row.readBy?.[user.uid] || row.lastInboundAt > row.readBy[user.uid])).length : 0;

  const visibleRows = attentionOnly ? rows.filter(row => row.needsReply) : rows;
  const mobileRows = visibleRows.filter(row => !search.trim() || [row.name, row.phone, row.latestMessage].filter(Boolean).join(' ').toLocaleLowerCase('ro-RO').includes(search.trim().toLocaleLowerCase('ro-RO')));
  const selectedAgent = agents.find(agent => agent.id === selected?.assigneeId);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f5f8fc] text-slate-800 md:px-3 md:py-2">
      <div className="pointer-events-none absolute -left-28 top-36 hidden h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl md:block" />
      <div className="pointer-events-none absolute right-0 top-20 hidden h-80 w-80 rounded-full bg-violet-200/30 blur-3xl md:block" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-white md:hidden">
        {mobilePane === 'list' ? <>
          <header className="relative isolate shrink-0 border-b border-emerald-100 bg-gradient-to-br from-white via-[#f5fcfa] to-[#eaf7fb] px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] shadow-[0_14px_32px_-26px_rgba(23,48,74,0.5)]">
            <div className="flex items-center justify-between gap-3">
              <SidebarTrigger aria-label="Deschide meniul aplicației" className="h-10 w-10 shrink-0 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-cyan-50 text-emerald-700 shadow-sm" />
              <div className="min-w-0 flex-1">
                <h1 className="flex items-baseline gap-1.5 text-[28px] font-bold tracking-tight text-[#17304a]">Inbox <span className="text-[18px] font-semibold text-emerald-700">({unreadCount})</span></h1>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/marketing/whatsapp" aria-label="Gestionează canalele" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/85 text-slate-600 shadow-sm"><SlidersHorizontal className="h-5 w-5" /></Link>
                <details className="relative">
                  <summary aria-label="Conversație nouă" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_10px_24px_-10px_rgba(16,130,84,0.7)] [&::-webkit-details-marker]:hidden"><Plus className="h-6 w-6" /></summary>
                  <div className="absolute right-0 top-12 z-30 w-[min(88vw,320px)] space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <p className="text-sm font-semibold text-[#17304a]">Conversație WhatsApp nouă</p>
                    <Input value={newContactId} onChange={e => setNewContactId(e.target.value)} placeholder="ID contact CRM" />
                    <select className={field + ' w-full'} value={newConnectionId} onChange={e => setNewConnectionId(e.target.value)}><option value="">Numărul agenției</option>{connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select>
                    <Button className="w-full rounded-xl bg-emerald-600 text-white" disabled={busy || !newContactId || !newConnectionId} onClick={() => act(async () => { const result = await api('conversations', 'POST', { contactId: newContactId, connectionId: newConnectionId }); await open(result.conversationId); await load(); setMobilePane('conversation'); })}>Deschide conversația</Button>
                    <p className="text-[11px] leading-4 text-slate-500">Deschiderea nu trimite automat un mesaj.</p>
                  </div>
                </details>
              </div>
            </div>
            <form className="relative mt-4" onSubmit={event => { event.preventDefault(); act(async () => { const result = await api('search?q=' + encodeURIComponent(search)); setResults(result.results); }); }}>
              <Search className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-slate-400" />
              <Input type="search" aria-label="Caută conversații" className="h-11 rounded-2xl border border-white/90 bg-white/90 pl-11 text-base shadow-[0_10px_24px_-20px_rgba(23,48,74,0.5)] focus-visible:ring-emerald-300" value={search} onChange={event => { setSearch(event.target.value); if (!event.target.value) setResults([]); }} placeholder="Caută un client sau un mesaj" />
            </form>
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setAttentionOnly(false)} className={'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ' + (!attentionOnly ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}>Toate</button>
              <button type="button" onClick={() => setAttentionOnly(true)} className={'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ' + (attentionOnly ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}>De răspuns {attentionCount}</button>
              <select aria-label="Canal" className="h-8 shrink-0 rounded-full border-0 bg-slate-100 px-3 text-xs font-semibold text-slate-600" value={channel} onChange={event => setChannel(event.target.value)}><option value="all">Toate canalele</option>{Object.entries(CHANNEL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
              <select aria-label="Stare" className="h-8 shrink-0 rounded-full border-0 bg-slate-100 px-3 text-xs font-semibold text-slate-600" value={stateFilter} onChange={event => setStateFilter(event.target.value)}>{[['all', 'Toate stările'], ['new', 'Noi'], ['open', 'În lucru'], ['waiting', 'În așteptare'], ['resolved', 'Rezolvate'], ['snoozed', 'Amânate'], ['spam', 'Spam']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </div>
          </header>
          {error && <div role="alert" className="shrink-0 bg-amber-50 px-4 py-2 text-xs text-amber-800">{error}</div>}
          {migration && <p className="shrink-0 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">{migration}</p>}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-gradient-to-b from-[#f1f7f8] via-[#f6f8fb] to-[#f8fafc] px-3 py-3">
            {results.map(result => <button key={result.messageId} type="button" className="group relative flex w-full items-start gap-3 overflow-hidden rounded-[22px] border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50/70 p-4 text-left shadow-[0_12px_30px_-24px_rgba(23,48,74,0.55)] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => act(async () => { await open(result.conversationId, undefined, result.messageId); setMobilePane('conversation'); })}>
              <span className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-base font-bold text-sky-700">{initials(result.name)}</span>
              <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">Rezultat în mesaje</span><strong className="mt-1 block truncate text-[15px] text-[#17304a]">{result.name}</strong><span className="mt-1 line-clamp-2 max-h-10 overflow-hidden text-[13px] leading-5 text-slate-600" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{result.text}</span></span>
              <span className="mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100/90 text-slate-500"><ArrowRight className="h-4 w-4" /></span>
            </button>)}
            {mobileRows.map(conversation => <button key={conversation.id} type="button" className={'group relative flex w-full items-start gap-3 overflow-hidden rounded-[22px] border p-4 text-left shadow-[0_14px_36px_-27px_rgba(23,48,74,0.45)] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + (conversation.needsReply ? 'border-emerald-100 bg-gradient-to-br from-white via-white to-cyan-50/90' : 'border-slate-200/80 bg-white/90')} onClick={() => act(async () => { await open(conversation.id); setMobilePane('conversation'); })}>
              {conversation.needsReply && <><span className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b from-emerald-400 via-cyan-400 to-violet-400" /><span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-cyan-200/45 blur-2xl" /></>}
              <span className={'relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-white/80 text-base font-bold ring-1 ring-slate-200/50 ' + channelClass[conversation.channel]}>{initials(conversation.name)}{conversation.needsReply && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.65)]" />}</span>
              <span className="relative min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{CHANNEL_LABELS[conversation.channel]}</span>
                <strong className="mt-1 block truncate text-[15px] leading-5 text-[#17304a]">{conversation.name}</strong>
                <span className="mt-1 line-clamp-2 max-h-10 overflow-hidden text-[13px] leading-5 text-slate-600" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{conversation.latestMessage || 'Conversație deschisă'}</span>
                <span className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><Clock3 className="h-3.5 w-3.5" /><time>{time(conversation.lastMessageAt)}</time><span aria-hidden="true">·</span><span>{statusLabel[conversation.status]}</span></span>
              </span>
              <span className={'relative mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' + (conversation.needsReply ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}><ArrowRight className="h-4 w-4" /></span>
            </button>)}
            {!mobileRows.length && <div className="rounded-[22px] border border-emerald-100 bg-white px-6 py-12 text-center shadow-sm"><MessageCircleMore className="mx-auto h-9 w-9 text-emerald-500" /><p className="mt-3 text-sm font-semibold text-[#17304a]">{attentionOnly ? 'Niciun mesaj de răspuns' : 'Nicio conversație găsită'}</p><p className="mt-1 text-xs text-slate-500">Schimbă filtrele sau începe o conversație nouă.</p></div>}
            {cursor && <Button variant="ghost" className="w-full rounded-2xl bg-white text-emerald-700" onClick={() => act(() => load(cursor))}>Încarcă mai multe</Button>}
          </div>
        </> : selected ? <section ref={mobileConversationRef} role="dialog" aria-modal="true" aria-label={'Conversația cu ' + selected.name} className="fixed inset-x-0 top-0 z-50 flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f7f4ee]">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 shadow-sm">
            <button type="button" className="flex h-10 w-9 shrink-0 items-center justify-center text-slate-600" aria-label="Înapoi la conversații" onClick={() => { setDetailsOpen(false); setMobilePane('list'); }}><ArrowLeft className="h-5 w-5" /></button>
            <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ' + channelClass[selected.channel]}>{initials(selected.name)}</span>
            <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold text-[#17304a]">{selected.name}</h2><p className="truncate text-[11px] text-slate-500">{CHANNEL_LABELS[selected.channel]} · {statusLabel[selected.status]}</p></div>
            <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600" aria-label="Detalii client" onClick={() => setDetailsOpen(true)}><UserRound className="h-5 w-5" /></button>
          </header>
          {associatedProperty && selectedPropertyId && <Link href={'/properties/' + selectedPropertyId} className="flex shrink-0 items-center gap-2 border-b border-emerald-100 bg-white/95 px-3 py-2">
            <span className="flex h-10 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">{propertyImage ? <Image src={propertyImage} alt={associatedProperty.title || 'Proprietate'} width={44} height={40} unoptimized className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#17304a]">{associatedProperty.title}</strong><span className="block truncate text-[11px] text-slate-500">{[associatedProperty.location || associatedProperty.address, associatedProperty.rooms ? associatedProperty.rooms + ' camere' : null, associatedProperty.squareFootage ? associatedProperty.squareFootage + ' m²' : null].filter(Boolean).join(' · ')}</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700" />
          </Link>}
          {error && <div role="alert" className="shrink-0 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4" style={{ backgroundImage: 'radial-gradient(rgba(113,143,125,0.11) 0.7px, transparent 0.7px)', backgroundSize: '22px 22px' }}>
            {messageCursor && <Button variant="ghost" className="mx-auto flex rounded-full bg-white text-xs text-slate-600" onClick={() => act(() => open(selected.id, messageCursor))}>Mesaje mai vechi</Button>}
            {[...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(message => <article id={'mobile-message-' + message.id} key={message.id} className={'w-fit max-w-[85%] rounded-2xl border px-3 py-2 shadow-sm ' + (message.direction === 'sent' ? 'ml-auto rounded-br-sm border-[#9fdfbc] bg-[#d9f7e8]' : 'mr-auto rounded-bl-sm border-[#b9d3fa] bg-[#e6f0ff]')}><p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#17304a]">{message.text}</p>{message.attachments.map((item, index) => <button key={index} type="button" className="mt-2 flex items-center gap-1 text-xs text-emerald-700 underline" onClick={() => act(() => download(message.id, index, item.name))}><Paperclip className="h-3 w-3" />{item.name}</button>)}<p className="mt-1 text-right text-[10px] text-slate-500">{time(message.createdAt)} · {message.direction === 'sent' ? message.status : 'Primit'}</p>{message.error && <p className="text-xs text-red-700">{message.error}</p>}</article>)}
            {notes.map(item => <div key={item.id} className="mx-auto max-w-[90%] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>Notă internă</strong><p className="mt-1 whitespace-pre-wrap">{item.text}</p></div>)}
            {!messages.length && !notes.length && <p className="py-16 text-center text-xs text-slate-500">Conversația începe aici.</p>}
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-[#f7faf9] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <div className="mb-2 flex items-center gap-2"><button type="button" onClick={() => setNote(false)} className={'rounded-full px-3 py-1 text-[11px] font-semibold ' + (!note ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-500')}>Răspuns</button><button type="button" onClick={() => setNote(true)} className={'rounded-full px-3 py-1 text-[11px] font-semibold ' + (note ? 'bg-amber-100 text-amber-800' : 'bg-white text-slate-500')}>Notă internă</button><span className="ml-auto text-[10px] text-slate-400">{selected.channel === 'storia' && !note ? 'Istoric Storia' : ''}</span></div>
            {selected.channel === 'whatsapp' && !note && <div className="mb-2"><select className={field + ' w-full'} aria-label="Șablon WhatsApp" value={template} onChange={event => { setTemplate(event.target.value); setEstimate(''); }}><option value="">Mesaj liber</option>{templates.map(item => <option key={item.name + '|' + item.language} value={item.name + '|' + item.language}>{item.name} ({item.language})</option>)}</select>{template && <Textarea className="mt-2 text-base" aria-label="Parametri șablon" placeholder="Valori șablon, câte una pe linie" value={parameters} onChange={event => setParameters(event.target.value)} />}</div>}
            <div className="flex items-end gap-2">
              {!note && !template && selected.channel !== 'storia' && <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-slate-600 shadow-sm" aria-label="Atașează fișier"><Paperclip className="h-5 w-5" /><input className="sr-only" type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) act(() => upload(file)); event.target.value = ''; }} /></label>}
              <Textarea aria-label={note ? 'Notă internă' : 'Mesaj către client'} className="max-h-28 min-h-11 flex-1 resize-none rounded-[22px] border-0 bg-white px-4 py-3 text-base shadow-sm focus-visible:ring-emerald-300" value={text} onChange={event => { setText(event.target.value); setEstimate(''); }} placeholder={note ? 'Scrie o notă...' : 'Scrie un mesaj...'} />
              <Button size="icon" className="h-11 w-11 shrink-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700" aria-label={note ? 'Salvează nota' : 'Trimite mesajul'} disabled={busy || (!text.trim() && !template && !attachment) || (!note && selected.channel === 'storia')} onClick={() => act(send)}><Send className="h-5 w-5" /></Button>
            </div>
            {attachment && <button type="button" className="mt-2 text-xs text-emerald-700" onClick={() => setAttachment(null)}>{attachment.name} · Elimină</button>}
            {estimate && <p className="mt-2 text-xs text-emerald-700">{estimate}</p>}
            <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Mai multe opțiuni</summary><div className="mt-2 flex flex-wrap gap-2">{['messenger', 'instagram'].includes(selected.channel) && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(async () => { await api('conversations/' + selected.id + '/sync', 'POST', {}); await open(selected.id); })}>Sincronizează istoricul</Button>}{!note && selected.channel !== 'storia' && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(async () => { const result = await api('conversations/' + selected.id + '/preview', 'POST', buildMessage()); setEstimate('Cost estimat: ' + (result.estimate.amountMicros / 1000000).toFixed(4) + ' ' + result.estimate.currency + ' · ' + result.estimate.category); })}>Verifică trimiterea</Button>}{selected.externalUrl && <Button size="sm" variant="outline" asChild><a href={selected.externalUrl} target="_blank" rel="noreferrer">Deschide în Storia</a></Button>}<Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => patch({ read: true }))}>Marchează citit</Button></div></details>
          </div>
        </section> : null}
        {detailsOpen && selected && <section role="dialog" aria-modal="true" aria-label="Detalii client" className="fixed inset-x-0 top-0 z-[80] flex h-dvh min-h-0 flex-col bg-[#f7f9fc]">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4"><button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600" aria-label="Înapoi la conversație" onClick={() => setDetailsOpen(false)}><ArrowLeft className="h-5 w-5" /></button><h2 className="text-base font-bold text-[#17304a]">Detalii client</h2></header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm"><span className={'mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold ' + channelClass[selected.channel]}>{initials(selected.name)}</span><h3 className="mt-3 font-bold text-[#17304a]">{selected.name}</h3><p className="mt-1 text-sm text-slate-500">{selected.phone || selected.email || 'Date de contact necompletate'}</p><p className="mt-2 text-xs text-slate-400">{CHANNEL_LABELS[selected.channel]}</p></div>
            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Gestionare conversație</h3>
              <label className="block text-xs font-medium text-slate-600">Stare<select className={field + ' mt-1 w-full'} value={selected.status} onChange={event => act(() => patch({ status: event.target.value }))}><option value="new">Nouă</option><option value="open">În lucru</option><option value="waiting">Așteaptă clientul</option><option value="resolved">Rezolvată</option><option value="spam">Spam</option></select></label>
              {userProfile?.role === 'admin' && <label className="block text-xs font-medium text-slate-600">Agent responsabil<select className={field + ' mt-1 w-full'} value={selected.assigneeId || ''} onChange={event => act(() => patch({ assigneeId: event.target.value || null }))}><option value="">Neatribuită</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>}
              <Button variant="outline" className="w-full rounded-xl" disabled={busy} onClick={() => act(() => patch({ read: true }))}><CheckCheck className="h-4 w-4" /> Marchează citit</Button>
            </section>
            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact CRM</h3>
              {selected.contactId ? <Button variant="outline" asChild className="w-full rounded-xl"><Link href="/leads">Vezi cumpărătorii <ArrowRight className="h-4 w-4" /></Link></Button> : <><select className={field + ' w-full'} value={contactType} onChange={event => setContactType(event.target.value)} aria-label="Tip contact"><option value="Cumparator">Cumpărător</option><option value="Client">Client / proprietar</option><option value="Partener">Partener</option></select><Button disabled={busy} className="w-full rounded-xl bg-emerald-600 text-white" onClick={() => act(async () => { await api('conversations/' + selected.id + '/contact', 'POST', { contactType }); await open(selected.id); })}>Adaugă în CRM</Button></>}
            </section>
            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Proprietăți asociate</h3>
              {selected.propertyIds.length ? selected.propertyIds.map(id => <Link key={id} href={'/properties/' + id} className="block truncate rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{id} <ArrowRight className="inline h-3.5 w-3.5" /></Link>) : <p className="text-xs text-slate-500">Nicio proprietate asociată.</p>}
              <div className="flex gap-2"><Input className="min-w-0 rounded-xl" placeholder="ID proprietate" value={propertyId} onChange={event => setPropertyId(event.target.value)} /><Button variant="outline" size="icon" className="shrink-0 rounded-xl" disabled={busy || !propertyId} aria-label="Asociază proprietatea" onClick={() => act(() => patch({ propertyId }))}><Plus className="h-4 w-4" /></Button></div>
            </section>
            {userProfile?.role === 'admin' && selected.channel === 'whatsapp' && <details className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-500">Consimțământ WhatsApp</summary><div className="mt-3 space-y-2"><select className={field + ' w-full'} value={consentPurpose} onChange={event => setConsentPurpose(event.target.value)}><option value="marketing">Oferte / marketing</option><option value="service">Comunicare de serviciu</option></select><Textarea placeholder="Dovada și data acordului sau retragerii" value={consentEvidence} onChange={event => setConsentEvidence(event.target.value)} /><div className="flex gap-2">{[['granted', 'Înregistrează'], ['revoked', 'Retrage']].map(([status, label]) => <Button key={status} size="sm" variant="outline" disabled={busy || consentEvidence.trim().length < 10} onClick={() => act(async () => { await api('consent', 'POST', { conversationId: selected.id, purpose: consentPurpose, status, evidence: consentEvidence }); setConsentEvidence(''); })}>{label}</Button>)}</div></div></details>}
            <Button variant="outline" asChild className="w-full rounded-xl"><Link href="/viewings">Vezi vizionările <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>}
      </div>
      <div className="relative mx-auto hidden min-h-0 w-full max-w-[1800px] flex-1 flex-col gap-2 md:flex">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-sm"><Inbox className="h-4 w-4" /></span><div><h1 className="flex flex-wrap items-baseline gap-1 text-lg font-bold leading-tight text-[#17304a]">Inbox <button type="button" aria-pressed={attentionOnly} onClick={() => setAttentionOnly(value => !value)} className={attentionOnly ? 'rounded-full bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-800' : 'text-xs font-semibold text-emerald-700 hover:underline'}>({attentionCount} de răspuns)</button></h1><p className="text-[11px] text-slate-500">Centrul de mesaje al agenției</p></div></div>
          <div className="flex flex-wrap items-center gap-1.5"><Button size="sm" variant="outline" asChild className="h-8 rounded-full border-slate-200 bg-white text-xs"><Link href="/marketing/whatsapp">Canale</Link></Button><Button size="sm" variant="outline" asChild className="h-8 rounded-full border-slate-200 bg-white text-xs"><Link href="/inbox/storia">Istoric Storia</Link></Button>{userProfile?.role === 'admin' && <Button size="sm" disabled={busy} variant="outline" className="h-8 rounded-full border-slate-200 bg-white text-xs" onClick={() => act(migrate)}>Importă</Button>}</div>
        </div>
        {error && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
        {migration && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{migration}</p>}

        <div className="relative grid min-h-0 flex-1 gap-2 md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
          <aside className={'min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/90 shadow-[0_20px_60px_-45px_rgba(25,53,78,0.4)] ' + (mobilePane === 'conversation' ? 'hidden md:flex' : 'flex')}>
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-cyan-50/70 p-4">
              <div className="flex items-center justify-between">
                <div><h2 className="font-bold text-[#17304a]">Conversații</h2><p className="text-xs text-slate-500">Fluxul de mesaje al agenției</p></div>
                <span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">{rows.length}</span>
              </div>
              <details className="group mt-3 rounded-xl border border-emerald-100 bg-white/90 px-2.5 py-2 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#17304a] [&::-webkit-details-marker]:hidden">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Plus className="h-4 w-4" /></span>
                  Conversație nouă
                  <span className="ml-auto text-xs font-normal text-slate-400">WhatsApp</span>
                </summary>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <Input className="h-10 max-w-xs rounded-xl" value={newContactId} onChange={e => setNewContactId(e.target.value)} placeholder="ID contact CRM" />
                  <select className={field} value={newConnectionId} onChange={e => setNewConnectionId(e.target.value)}><option value="">Numărul agenției</option>{connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <Button className="rounded-xl" disabled={busy || !newContactId || !newConnectionId} onClick={() => act(async () => { const d = await api('conversations', 'POST', { contactId: newContactId, connectionId: newConnectionId }); await open(d.conversationId); await load(); })}>Deschide conversația</Button>
                  <p className="w-full text-xs text-slate-500">Deschiderea nu trimite un mesaj. Inițierea cere consimțământ și un șablon aprobat.</p>
                </div>
              </details>
              <form className="relative mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); act(async () => { const d = await api('search?q=' + encodeURIComponent(search)); setResults(d.results); }); }}>
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input aria-label="Caută în conversații" className="h-10 min-w-0 rounded-xl border-slate-200 bg-white pl-9" value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) setResults([]); }} placeholder="Nume, telefon, mesaj..." />
                <Button type="submit" size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl border-slate-200" aria-label="Caută"><ArrowRight className="h-4 w-4" /></Button>
              </form>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="relative"><span className="sr-only">Canal</span><select aria-label="Canal" className={field + ' w-full appearance-none pr-7'} value={channel} onChange={e => setChannel(e.target.value)}><option value="all">Toate canalele</option>{Object.entries(CHANNEL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><SlidersHorizontal className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-slate-400" /></label>
                <select aria-label="Starea conversației" className={field + ' w-full'} value={stateFilter} onChange={e => setStateFilter(e.target.value)}>{[['all', 'Toate stările'], ['new', 'Noi'], ['open', 'Deschise'], ['waiting', 'În așteptare'], ['resolved', 'Rezolvate'], ['snoozed', 'Amânate'], ['spam', 'Spam']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </div>

            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-gradient-to-b from-[#fbfdfd] to-white p-2.5">
              {results.length > 0 && <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Rezultate în mesaje</div>}
              {results.map(result => <button key={result.messageId} className="w-full rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3 text-left transition hover:bg-cyan-100/70" onClick={() => act(() => open(result.conversationId, undefined, result.messageId))}><strong className="text-sm text-[#17304a]">{result.name}</strong><p className="mt-1 line-clamp-2 text-xs text-slate-600">{result.text}</p></button>)}
              {visibleRows.map(conversation => <button key={conversation.id} onClick={() => act(() => open(conversation.id))} className={'group relative w-full overflow-hidden rounded-[18px] border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ' + (selected?.id === conversation.id ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50/50 shadow-[0_10px_25px_-18px_rgba(16,185,129,0.8)]' : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50')}>
                {selected?.id === conversation.id && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-emerald-400 via-cyan-400 to-violet-400" />}
                <span className="flex items-start gap-3">
                  <span className={'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ' + channelClass[conversation.channel]}>{initials(conversation.name)}{conversation.needsReply && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2"><strong className="truncate text-sm text-[#17304a]">{conversation.name}</strong><time className="shrink-0 text-[10px] text-slate-400">{time(conversation.lastMessageAt)}</time></span>
                    <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{CHANNEL_LABELS[conversation.channel]} · {statusLabel[conversation.status]}</span>
                    <span className="mt-1.5 block truncate text-xs leading-5 text-slate-600">{conversation.latestMessage || 'Conversație deschisă'}</span>

                  </span>
                </span>
              </button>)}
              {!visibleRows.length && <div className="flex flex-col items-center px-4 py-12 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-violet-100 text-emerald-700"><Inbox className="h-6 w-6" /></span><p className="mt-3 text-sm font-semibold text-[#17304a]">{attentionOnly ? 'Totul este la zi' : 'Nicio conversație aici'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{attentionOnly ? 'Nu există conversații care așteaptă răspuns.' : 'Conectează un canal sau importă istoricul Storia.'}</p></div>}
              {cursor && <Button variant="ghost" className="w-full rounded-xl text-emerald-700" onClick={() => act(() => load(cursor))}>Încarcă mai multe</Button>}
            </div>
          </aside>

          <main className={'min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_20px_60px_-45px_rgba(25,53,78,0.4)] ' + (mobilePane === 'list' ? 'hidden md:flex' : 'flex')}>
            {selected ? <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white via-emerald-50/50 to-cyan-50/60 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 md:hidden" aria-label="Înapoi la conversații" onClick={() => setMobilePane('list')}><ArrowLeft className="h-4 w-4" /></button>
                  <span className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold ' + channelClass[selected.channel]}>{initials(selected.name)}</span>
                  <div className="min-w-0"><h2 className="truncate text-base font-bold text-[#17304a]">{selected.name}</h2><p className="mt-0.5 text-xs text-slate-500">{CHANNEL_LABELS[selected.channel]} · {statusLabel[selected.status]}</p></div>
                </div>
                <div className="flex items-center gap-2"><Button size="sm" variant="outline" className="rounded-full border-slate-200 bg-white" disabled={busy} onClick={() => act(() => patch({ read: true }))}><CheckCheck className="h-4 w-4" /> <span className="hidden sm:inline">Marchează citit</span></Button><Button size="sm" variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" onClick={() => setDetailsOpen(true)}><UserRound className="h-4 w-4" /> Detalii client</Button></div>
              </div>
              {associatedProperty && selectedPropertyId && <Link href={'/properties/' + selectedPropertyId} className="group flex shrink-0 items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-cyan-50/70 via-white to-emerald-50/60 px-4 py-2.5 transition hover:from-cyan-50 hover:to-emerald-50 sm:px-5">
                <span className="flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-slate-400">
                  {propertyImage ? <Image src={propertyImage} alt={associatedProperty.title || 'Proprietate'} width={56} height={48} unoptimized className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#17304a]">{associatedProperty.title || 'Proprietate asociată'}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{[associatedProperty.location || associatedProperty.address, associatedProperty.rooms ? associatedProperty.rooms + ' camere' : null, associatedProperty.squareFootage ? associatedProperty.squareFootage + ' m²' : null, Number.isFinite(associatedProperty.price) ? new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(associatedProperty.price) : null].filter(Boolean).join(' · ')}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
              </Link>}
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.045),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.05),transparent_40%)] px-4 py-5 sm:px-6">
                {messageCursor && <Button variant="ghost" className="self-center rounded-full text-xs text-slate-500" onClick={() => act(() => open(selected.id, messageCursor))}>Mesaje mai vechi</Button>}
                {[...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(message => <article id={'message-' + message.id} key={message.id} className={'max-w-[88%] rounded-[20px] border px-4 py-3 shadow-sm sm:max-w-[75%] ' + (message.direction === 'sent' ? 'self-end rounded-br-md border-[#9fdfbc] bg-[#d9f7e8] shadow-[0_8px_22px_-16px_rgba(16,130,84,0.55)]' : 'self-start rounded-bl-md border-[#b9d3fa] bg-[#e6f0ff] shadow-[0_8px_22px_-16px_rgba(55,105,185,0.45)]')}>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{message.text}</p>
                  {message.attachments.map((attachmentItem, index) => <button key={index} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 underline underline-offset-2" onClick={() => act(() => download(message.id, index, attachmentItem.name))}><Paperclip className="h-3.5 w-3.5" /> {attachmentItem.name}</button>)}
                  <p className="mt-2 text-[10px] text-slate-400">{date(message.createdAt)} · {message.direction === 'sent' ? (message.origin === 'imodeus' ? 'ImoDeus' : 'Aplicație externă') + ' · ' + message.status : 'Primit'}</p>
                  {message.error && <p className="mt-1 text-xs text-red-700">{message.error}</p>}
                </article>)}
                {notes.map(item => <div key={item.id} className="max-w-[90%] self-center rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm"><strong className="text-xs uppercase tracking-wide text-amber-700">Notă internă</strong><p className="mt-1 whitespace-pre-wrap">{item.text}</p></div>)}
                {!messages.length && !notes.length && <div className="m-auto text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-100 to-cyan-100 text-emerald-700"><MessageCircleMore className="h-7 w-7" /></span><p className="mt-3 text-sm font-semibold text-[#17304a]">Conversația începe aici</p><p className="mt-1 text-xs text-slate-500">Mesajele și notele vor apărea în acest spațiu.</p></div>}
              </div>
              <div className="shrink-0 border-t border-slate-100 bg-white p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setNote(false)} className={'rounded-full px-3 py-1.5 text-xs font-semibold transition ' + (!note ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500 hover:text-slate-700')}>Răspuns către client</button>
                  <button type="button" onClick={() => setNote(true)} className={'rounded-full px-3 py-1.5 text-xs font-semibold transition ' + (note ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500 hover:text-slate-700')}>Notă internă</button>
                </div>
                {selected.channel === 'whatsapp' && !note && <div className="mb-2 space-y-2"><select className={field + ' w-full'} aria-label="Șablon WhatsApp" value={template} onChange={e => { setTemplate(e.target.value); setEstimate(''); }}><option value="">Mesaj liber</option>{templates.map(item => <option key={item.name + '|' + item.language} value={item.name + '|' + item.language}>{item.name} ({item.language})</option>)}</select>{template && <Textarea aria-label="Parametri șablon" className="rounded-xl" placeholder="Valorile șablonului, câte una pe linie" value={parameters} onChange={e => setParameters(e.target.value)} />}</div>}
                <Textarea aria-label={note ? 'Notă internă' : 'Mesaj către client'} className={'min-h-[84px] resize-none rounded-2xl border-slate-200 p-3 focus-visible:ring-emerald-400/30 ' + (note ? 'bg-amber-50/60' : 'bg-[#fbfdfd]')} value={text} onChange={e => { setText(e.target.value); setEstimate(''); }} placeholder={note ? 'Scrie o notă pentru echipă...' : 'Scrie un răspuns pentru client...'} />
                {estimate && <p className="mt-2 text-xs text-emerald-700">{estimate}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!note && !template && selected.channel !== 'storia' && <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"><Paperclip className="h-3.5 w-3.5" /> Atașează<input className="sr-only" type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) act(() => upload(file)); e.target.value = ''; }} /></label>}
                  {attachment && <button className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700" onClick={() => setAttachment(null)}>{attachment.name} · Elimină</button>}
                  {['messenger', 'instagram'].includes(selected.channel) && <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => act(async () => { await api('conversations/' + selected.id + '/sync', 'POST', {}); await open(selected.id); })}>Sincronizează istoricul</Button>}
                  <span className="ml-auto" />
                  {!note && selected.channel !== 'storia' && <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => act(async () => { const d = await api('conversations/' + selected.id + '/preview', 'POST', buildMessage()); setEstimate('Cost estimat: ' + (d.estimate.amountMicros / 1000000).toFixed(4) + ' ' + d.estimate.currency + ' · ' + d.estimate.category); })}>Verifică trimiterea</Button>}
                  {selected.externalUrl && <Button size="sm" asChild variant="outline" className="rounded-full"><a href={selected.externalUrl} target="_blank" rel="noreferrer">Deschide în Storia <ExternalLink className="h-3.5 w-3.5" /></a></Button>}
                  <Button size="sm" className="rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700" disabled={busy || (!text.trim() && !template && !attachment) || (!note && selected.channel === 'storia')} onClick={() => act(send)}>{note ? 'Salvează nota' : 'Trimite'} <Send className="h-3.5 w-3.5" /></Button>
                </div>
                {!note && !template && selected.channel !== 'storia' && <p className="mt-2 text-[11px] text-slate-400">Atașamente acceptate: JPEG, PNG sau PDF, maximum 10 MB.</p>}
              </div>
            </> : <div className="flex flex-1 flex-col items-center justify-center px-6 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-emerald-100 via-cyan-50 to-violet-100 text-emerald-700 shadow-sm"><MessageCircleMore className="h-9 w-9" /></span><h2 className="mt-5 text-xl font-bold text-[#17304a]">Un spațiu pentru fiecare conversație</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">Alege un mesaj din stânga pentru a răspunde, a lăsa note și a gestiona relația cu clientul.</p></div>}
          </main>

          {detailsOpen && selected && <div className="fixed inset-0 z-50 lg:absolute lg:z-20"><button type="button" className="absolute inset-0 bg-[#17304a]/20 backdrop-blur-[2px]" aria-label="Închide detaliile clientului" onClick={() => setDetailsOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="Detalii client" className="absolute inset-y-0 right-0 z-10 flex w-full max-w-[360px] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[-18px_0_50px_-28px_rgba(25,53,78,0.45)]">
            <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-emerald-50/60 px-4 py-4">
              <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><UserRound className="h-4 w-4" /></span><div><h2 className="font-bold text-[#17304a]">Context client</h2><p className="text-xs text-slate-500">Profil și gestionare</p></div><Button type="button" size="icon" variant="ghost" className="ml-auto rounded-full" aria-label="Închide detaliile clientului" onClick={() => setDetailsOpen(false)}><X className="h-4 w-4" /></Button></div>
            </div>
            {selected ? <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-[#f8fbfe] to-emerald-50/40 p-4 text-center">
                <span className={'mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] text-xl font-bold ' + channelClass[selected.channel]}>{initials(selected.name)}</span>
                <h3 className="mt-3 font-bold text-[#17304a]">{selected.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{selected.phone || selected.email || 'Date de contact necompletate'}</p>
                <span className={'mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ' + channelClass[selected.channel]}>{CHANNEL_LABELS[selected.channel]}</span>
              </div>
              <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3.5">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /><h3 className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Gestionare conversație</h3></div>
                <label className="block text-xs font-medium text-slate-600">Stare<select className={field + ' mt-1 w-full'} value={selected.status} onChange={e => act(() => patch({ status: e.target.value }))}><option value="new">Nouă</option><option value="open">În lucru</option><option value="waiting">Așteaptă clientul</option><option value="resolved">Rezolvată</option><option value="spam">Spam</option></select></label>
                {userProfile?.role === 'admin' && <label className="block text-xs font-medium text-slate-600">Agent responsabil<select className={field + ' mt-1 w-full'} value={selected.assigneeId || ''} onChange={e => act(() => patch({ assigneeId: e.target.value || null }))}><option value="">Neatribuită</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>}
                {selectedAgent && <p className="text-xs text-slate-500">În grija lui {selectedAgent.name}</p>}
              </section>
              <section className="space-y-2 rounded-2xl border border-slate-100 bg-white p-3.5">
                <div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-violet-600" /><h3 className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Contact CRM</h3></div>
                {selected.contactId ? <><p className="text-xs text-emerald-700">Contact asociat acestei conversații</p><Button variant="outline" asChild className="w-full rounded-xl"><Link href="/leads">Vezi cumpărătorii <ArrowRight className="h-4 w-4" /></Link></Button></> : <><p className="text-xs text-slate-500">Transformă conversația într-un contact urmărit în CRM.</p><select className={field + ' w-full'} value={contactType} onChange={e => setContactType(e.target.value)} aria-label="Tip contact"><option value="Cumparator">Cumpărător</option><option value="Client">Client / proprietar</option><option value="Partener">Partener</option></select><Button disabled={busy} variant="outline" className="w-full rounded-xl border-emerald-200 text-emerald-700" onClick={() => act(async () => { await api('conversations/' + selected.id + '/contact', 'POST', { contactType }); await open(selected.id); })}><Plus className="h-4 w-4" /> Adaugă în CRM</Button></>}
              </section>
              <section className="space-y-2 rounded-2xl border border-slate-100 bg-white p-3.5">
                <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-md bg-cyan-100" /><h3 className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Proprietăți asociate</h3></div>
                {selected.propertyIds.length ? selected.propertyIds.map(id => <Link key={id} className="block truncate rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100" href={'/properties/' + id}>{id} <ExternalLink className="ml-1 inline h-3 w-3" /></Link>) : <p className="text-xs text-slate-500">Nicio proprietate asociată încă.</p>}
                <div className="flex gap-2"><Input className="h-10 min-w-0 rounded-xl" placeholder="ID proprietate" value={propertyId} onChange={e => setPropertyId(e.target.value)} /><Button size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl" aria-label="Asociază proprietatea" disabled={busy || !propertyId} onClick={() => act(() => patch({ propertyId }))}><Plus className="h-4 w-4" /></Button></div>
              </section>
              {userProfile?.role === 'admin' && selected.channel === 'whatsapp' && <details className="rounded-2xl border border-slate-100 bg-white p-3.5"><summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Consimțământ WhatsApp</summary><div className="mt-3 space-y-2"><select className={field + ' w-full'} value={consentPurpose} onChange={e => setConsentPurpose(e.target.value)}><option value="marketing">Oferte / marketing</option><option value="service">Comunicare de serviciu</option></select><Textarea className="rounded-xl" placeholder="Dovada și data acordului sau retragerii" value={consentEvidence} onChange={e => setConsentEvidence(e.target.value)} /><div className="flex flex-wrap gap-1">{[['granted', 'Înregistrează'], ['revoked', 'Retrage']].map(([status, label]) => <Button key={status} size="sm" variant="outline" className="rounded-full" disabled={busy || consentEvidence.trim().length < 10} onClick={() => act(async () => { await api('consent', 'POST', { conversationId: selected.id, purpose: consentPurpose, status, evidence: consentEvidence }); setConsentEvidence(''); })}>{label}</Button>)}</div></div></details>}
              <Button variant="outline" asChild className="w-full rounded-xl border-slate-200"><Link href="/viewings">Vezi vizionările <ArrowRight className="h-4 w-4" /></Link></Button>
            </div> : <div className="flex flex-col items-center px-5 py-14 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-500"><UserRound className="h-6 w-6" /></span><p className="mt-3 text-sm font-semibold text-[#17304a]">Profilul clientului</p><p className="mt-1 text-xs leading-5 text-slate-500">Selectează o conversație pentru a vedea detaliile și acțiunile CRM.</p></div>}
          </aside>
          </div>}
        </div>
      </div>
    </div>
  );
}
