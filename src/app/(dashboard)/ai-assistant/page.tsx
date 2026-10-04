'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgency } from '@/context/AgencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, CheckCircle2, ChevronRight, History, Loader2, Plus, Search, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AssistantAction, AssistantCard, AssistantMessage, AssistantPlan, AssistantSearch } from '@/lib/ai-assistant/contracts';

const prompts = ['Găsește 5 apartamente în Titan sub 130000 euro.', 'Arată-mi vizionările de mâine și sarcinile restante.', 'Găsește proprietățile potrivite pentru un client.', 'Verifică starea conexiunii WhatsApp.'];
const labels: Record<AssistantAction['kind'], string> = { create_contact: 'Creează contact', archive_contact: 'Arhivează / reactivează contact', assign_record: 'Atribuie unui agent', create_property: 'Creează proprietate', update_contact: 'Actualizează contact', update_preferences: 'Actualizează cerințele clientului', update_property: 'Actualizează proprietate', import_owner_listing: 'Importă anunțul în CRM', activate_property: 'Activează proprietatea', record_offer: 'Înregistrează ofertă', add_interaction: 'Adaugă interacțiune', create_task: 'Creează sarcină', update_task: 'Actualizează sarcină', schedule_viewing: 'Programează vizionare', update_viewing: 'Actualizează vizionare', recommend_properties: 'Adaugă oferte în portal', create_automation: 'Programează automatizare', update_automation: 'Actualizează automatizare', existing_operation: 'Acțiune CRM' };
function safeLink(value: unknown) {
  const link = String(value || '');
  if (link.startsWith('/') && !link.startsWith('//')) return link;
  try { const url = new URL(link); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
type Session = { id: string; title: string };
type Consent = { listingId: string; title: string; phone: string; connectionId: string; connections: { id: string; name: string }[]; evidence: string; purpose: 'marketing' | 'service'; confirmed: boolean; calledAt: string };

export default function AiAssistantPage() {
  const { user, agencyId, userProfile } = useAgency();
  return <AiAssistantWorkspace key={`${user?.uid || 'anonymous'}:${agencyId || 'none'}:${userProfile?.role || 'none'}`} />;
}
function AiAssistantWorkspace() {
  const { user, agencyId, userProfile } = useAgency();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, AssistantPlan>>({});
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aiConfigured, setAiConfigured] = useState(true);
  const [backgroundConfigured, setBackgroundConfigured] = useState(false);
  const [progress, setProgress] = useState('');
  const [autonomy, setAutonomy] = useState({ available: false, enabled: false });
  const [consent, setConsent] = useState<Consent | null>(null);
  const [zone, setZone] = useState('');
  const [priceMax, setPriceMax] = useState('130000');
  const [rooms, setRooms] = useState('');
  const [count, setCount] = useState('5');
  const endRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);

  const api = useCallback(async (path: string, body?: unknown) => {
    if (!user) throw new Error('Autentifică-te pentru a folosi asistentul.');
    const token = await user.getIdToken();
    const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || 'Cererea nu a fost confirmată.');
    return result;
  }, [user]);
  const refreshSessions = useCallback(async () => {
    const version = generation.current;
    const data = await api('/api/ai-assistant/workspace');
    if (version !== generation.current) return;
    setSessions(data.sessions); setAiConfigured(data.aiConfigured); setBackgroundConfigured(data.backgroundConfigured === true);
    if (data.autonomy) setAutonomy(data.autonomy);
  }, [api]);

  useEffect(() => {
    generation.current++;
    queueMicrotask(() => {
      setSessionId(crypto.randomUUID());
      if (user && agencyId) refreshSessions().catch(e => setError(e.message));
    });
  }, [user?.uid, agencyId, refreshSessions, user]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  async function perform(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Cererea nu a fost confirmată.'); }
    finally { inFlight.current = false; setBusy(false); setProgress(''); }
  }
  async function openSession(id: string) {
    await perform(async () => {
      const version = ++generation.current;
      const data = await api('/api/ai-assistant/workspace?sessionId=' + encodeURIComponent(id));
      if (version !== generation.current) return;
      setSessionId(id); setMessages(data.messages); setHistoryCursor(data.nextCursor); setPlans({});
      for (const message of data.messages as AssistantMessage[]) {
        if (message.planId) {
          const state = await api('/api/ai-assistant/workspace?planId=' + encodeURIComponent(message.planId));
          if (version === generation.current) setPlans(p => ({ ...p, [message.planId!]: state.plan }));
        }
      }
    });
  }
  function newSession() {
    if (busy) return;
    generation.current++; setSessionId(crypto.randomUUID()); setMessages([]); setPlans({}); setHistoryCursor(null); setError('');
  }
  async function send(text = input) {
    if (!text.trim() || !sessionId || busy) return;
    await perform(async () => {
      const version = generation.current, requestId = crypto.randomUUID();
      const message: AssistantMessage = { id: requestId + '-user', role: 'user', text: text.trim(), createdAt: new Date().toISOString() };
      setMessages(m => [...m, message]); setInput('');
      let data;
      if (backgroundConfigured) {
        const job = await api('/api/ai-assistant/workspace', { kind: 'start', sessionId, requestId, prompt: text.trim() });
        setProgress('Comanda este salvată și va fi procesată pe server.');
        const started = Date.now(); let completed = false;
        while (!completed && version === generation.current && Date.now() - started < 180000) {
          const token = await user!.getIdToken();
          const response = await fetch('/api/ai-assistant/workspace?jobId=' + job.jobId + '&stream=1', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
          if (!response.ok || !response.body) throw new Error('Comanda rămâne salvată pe server. Reîncarcă istoricul pentru rezultat.');
          const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
          for (;;) {
            const chunk = await reader.read(); if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
              const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
              if (!line.startsWith('data: ')) continue;
              const event = JSON.parse(line.slice(6));
              if (event.type === 'PROGRESS_EVENT') setProgress(event.text);
              if (event.type === 'ERROR_EVENT') throw new Error(event.text);
              if (event.type === 'ACTION_RESULT') { if (event.status === 'failed') throw new Error(event.error); data = { message: event.message }; completed = true; }
            }
          }
        }
        if (!data) throw new Error('Procesarea continuă pe server. Deschide istoricul pentru rezultat.');
      } else data = await api('/api/ai-assistant/workspace', { kind: 'chat', sessionId, requestId, prompt: text.trim() });
      setProgress('');
      if (version !== generation.current) return;
      setMessages(m => [...m, data.message]);
      if (data.message.planId) {
        const state = await api('/api/ai-assistant/workspace?planId=' + encodeURIComponent(data.message.planId));
        if (version === generation.current) setPlans(p => ({ ...p, [data.message.planId]: state.plan }));
      }
      await refreshSessions();
    });
  }
  async function search(query: AssistantSearch, messageId?: string, cardIndex?: number) {
    await perform(async () => {
      const version = generation.current;
      const result = await api('/api/ai-assistant/workspace', { kind: 'search', query, sessionId, requestId: crypto.randomUUID() });
      if (version !== generation.current) return;
      const card: AssistantCard = { type: 'results', title: query.source === 'owners' ? 'Anunțuri proprietari' : 'Potriviri din CRM', source: query.source, search: query, ...result };
      if (messageId !== undefined && cardIndex !== undefined) setMessages(m => m.map(item => item.id === messageId ? { ...item, cards: item.cards?.map((old, index) => index === cardIndex ? { ...card, rows: [...old.rows, ...card.rows].filter((row, i, all) => all.findIndex(r => r.id === row.id) === i) } : old) } : item));
      else setMessages(m => [...m, result.message]);
      await refreshSessions();
    });
  }
  async function execute(planId: string, cancel = false) {
    await perform(async () => {
      const version = generation.current;
      let result = await api('/api/ai-assistant/workspace', { kind: cancel ? 'cancel' : backgroundConfigured ? 'execute_background' : 'execute', planId });
      if (result.jobId) {
        setProgress('Planul confirmat este executat pe server.');
        const started = Date.now();
        for (;;) {
          result = await api('/api/ai-assistant/workspace?jobId=' + result.jobId);
          if (result.status === 'failed') throw new Error(result.error);
          if (result.status === 'completed') break;
          if (version !== generation.current || Date.now() - started > 180000) throw new Error('Execuția continuă pe server. Verifică starea planului din istoric.');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        setProgress('');
      }
      if (version !== generation.current) return;
      setPlans(p => ({ ...p, [planId]: result.plan }));
    });
  }
  async function inspect(planId: string) {
    await perform(async () => {
      const version = generation.current;
      const result = await api('/api/ai-assistant/workspace', { kind: 'inspect', planId });
      if (version === generation.current) setPlans(p => ({ ...p, [planId]: result.plan }));
    });
  }
  async function startConsent(row: Record<string, unknown>) {
    await perform(async () => {
      const version = generation.current;
      const [favorite, connections] = await Promise.all([
        api('/api/ai-assistant/workspace', { kind: 'read', query: { resource: 'ownerListingFavorites', id: row.id } }),
        api('/api/ai-assistant/workspace', { kind: 'read', query: { resource: 'channelConnections', limit: 100 } }),
      ]);
      if (version !== generation.current) return;
      const available = connections.rows.filter((c: any) => c.channel === 'whatsapp' && c.status === 'connected');
      setConsent({ listingId: String(row.id), title: String(row.title || favorite.rows[0].title || 'Proprietar'), phone: favorite.rows[0].ownerPhone || '', connectionId: available[0]?.id || '', connections: available, evidence: '', purpose: 'marketing', confirmed: false, calledAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) });
    });
  }
  async function saveConsent() {
    if (!consent) return;
    const current = consent;
    await perform(async () => {
      const result = await api('/api/ai-assistant/owner-consent', { listingId: current.listingId, connectionId: current.connectionId, confirmedPhoneConsent: current.confirmed, purpose: current.purpose, calledAt: new Date(current.calledAt).toISOString(), evidence: current.evidence });
      setConsent(null);
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', text: 'Acordul telefonic a fost înregistrat pentru ' + current.phone + '. Conversația: ' + result.conversationId + '. Poți cere trimiterea unui șablon aprobat pentru scopul confirmat.', createdAt: result.recordedAt }]);
      setInput('Verifică șabloanele aprobate și pregătește un mesaj pentru conversația ' + result.conversationId);
    });
  }

  async function prepareActions(actions: AssistantAction[]) {
    await perform(async () => {
      const version = generation.current;
      const result = await api('/api/ai-assistant/workspace', { kind: 'prepare', sessionId, requestId: crypto.randomUUID(), actions });
      if (version !== generation.current) return;
      setMessages(m => [...m, result.message]);
      const state = await api('/api/ai-assistant/workspace?planId=' + encodeURIComponent(result.message.planId));
      if (version === generation.current) setPlans(p => ({ ...p, [result.message.planId]: state.plan }));
      await refreshSessions();
    });
  }
  async function downloadArtifact(row: Record<string, unknown>) {
    await perform(async () => {
      if (!user) return;
      const response = await fetch('/api/ai-assistant/artifacts/' + encodeURIComponent(String(row.artifactId)), { headers: { Authorization: 'Bearer ' + await user.getIdToken() } });
      if (!response.ok) throw new Error('Fișierul nu poate fi descărcat cu permisiunile actuale.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = String(row.fileName || 'document.pdf'); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function renderCard(card: AssistantCard, messageId: string, cardIndex: number) {
    return <div key={cardIndex} className="my-3 rounded-2xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><strong>{card.title}</strong><span className="text-xs text-muted-foreground">{card.rows.length} rezultate • {card.source === 'owners' ? 'surse proprietari' : card.source === 'crm' ? 'portofoliu CRM' : 'date CRM'}</span></div>
      {!card.rows.length && <p className="text-sm text-muted-foreground">Nicio potrivire în segmentul verificat.{card.nextCursor ? ' Continuă căutarea.' : ''}</p>}
      <div className="space-y-2">{card.rows.map((row, index) => {
        const href = safeLink(row.link);
        return <div key={String(row.id || index)} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div>
            {href ? <a className="font-medium underline underline-offset-4" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{String(row.title || row.name || row.description || row.id)}</a> : <p className="font-medium">{String(row.title || row.name || row.description || row.id)}</p>}
            <p className="text-sm text-muted-foreground">{[row.location, row.price != null ? String(row.price) + (typeof row.price === 'number' ? ' EUR' : '') : null, row.rooms ? String(row.rooms) + ' camere' : null].filter(Boolean).join(' • ')}</p>
            {row.reasoning ? <p className="mt-1 text-sm">{String(row.reasoning)}</p> : null}
          </div>{card.source === 'owners' && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => prepareActions([{ kind: 'existing_operation', operation: 'owner_prospect', params: {}, query: {}, body: { listingId: row.id, action: 'add' } }])}>Adaugă în prospectare</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => startConsent(row)}><ShieldCheck className="mr-1 h-4 w-4" />Confirm acordul WhatsApp</Button></div>}</div>
          {row.artifactId ? <Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={() => downloadArtifact(row)}>Descarcă {String(row.fileName || 'PDF')}</Button> : null}
          <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Detalii și identificator</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(row, null, 2)}</pre></details>
        </div>;
      })}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.search && card.nextCursor && <Button size="sm" variant="outline" disabled={busy} onClick={() => search({ ...card.search!, cursor: card.nextCursor! }, messageId, cardIndex)}>Continuă căutarea<ChevronRight className="ml-1 h-4 w-4" /></Button>}
        {card.source === 'owners' && card.search && <Button size="sm" variant="outline" disabled={busy} onClick={() => { const { cursor: _, ...query } = card.search!; void search({ ...query, source: 'crm' }); }}>Vezi potrivirile din CRM</Button>}
      </div>
    </div>;
  }

  return <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5 p-4 lg:flex-row lg:p-7">
    <main className="flex min-h-[75vh] min-w-0 flex-1 flex-col rounded-3xl border bg-background/95 shadow-sm lg:h-[calc(100dvh-150px)] lg:min-h-[620px]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><Bot className="h-6 w-6" /></div><div><h1 className="text-xl font-semibold">AI Assistant</h1><p className="text-sm text-muted-foreground">Date actuale. Acțiuni urmărite. Controlul rămâne la tine.</p></div></div><Button variant="outline" onClick={newSession} disabled={busy}><Plus className="mr-2 h-4 w-4" />Conversație nouă</Button></header>
      {autonomy.available && <div className="flex flex-wrap items-center gap-2 border-b px-6 py-2 text-xs"><Button size="sm" variant={autonomy.enabled ? 'default' : 'outline'} disabled={busy} aria-pressed={autonomy.enabled} onClick={() => perform(async () => { setAutonomy(await api('/api/ai-assistant/workspace', { kind: 'autonomy', enabled: !autonomy.enabled })); })}>{autonomy.enabled ? 'Oprește pașii safe automați' : 'Autorizează pașii safe'}</Button><span className="text-muted-foreground">30 zile: sarcini, notițe, prospectare, import și recomandări în portal. Mesajele și publicările cer confirmare.</span></div>}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
        {historyCursor && <Button variant="ghost" disabled={busy} onClick={() => perform(async () => { const data = await api('/api/ai-assistant/workspace?sessionId=' + sessionId + '&before=' + historyCursor); setMessages(m => [...data.messages, ...m]); setHistoryCursor(data.nextCursor); })}>Încarcă istoricul anterior</Button>}
        {!messages.length && <div className="mx-auto max-w-2xl py-14 text-center"><Sparkles className="mx-auto mb-5 h-10 w-10 text-emerald-600" /><h2 className="text-3xl font-semibold">{userProfile?.name?.split(' ')[0] || 'Salut'}, ce rezolvăm în CRM?</h2><p className="mt-3 text-muted-foreground">Caută anunțuri, verifică clienți, programează vizionări și pregătește următoarele acțiuni.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{prompts.map(prompt => <button key={prompt} disabled={busy} onClick={() => send(prompt)} className="rounded-2xl border p-4 text-left text-sm transition hover:bg-muted disabled:opacity-50">{prompt}</button>)}</div></div>}
        {progress && busy && <p role="status" className="rounded-xl border p-3 text-sm text-muted-foreground">{progress}</p>}
        {messages.map(message => <article key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-3' : 'max-w-full'}>
          <div className="mb-1 text-xs font-medium text-muted-foreground">{message.role === 'user' ? 'Tu' : 'AI Assistant'}</div>
          <div className="prose prose-sm max-w-none dark:prose-invert"><Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown></div>
          {message.cards?.map((card, index) => renderCard(card, message.id, index))}
          {message.planId && <div className="my-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4"><strong>Plan de acțiune</strong><ol className="my-3 space-y-2">{message.actions?.map((action, index) => <li key={index} className="rounded-xl border bg-background p-3"><p className="text-sm font-medium">{index + 1}. {labels[action.kind]}{action.kind === 'existing_operation' ? ': ' + action.operation : ''}</p><details className="mt-1 text-xs"><summary className="cursor-pointer text-muted-foreground">Verifică datele acțiunii</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify(action, null, 2)}</pre></details></li>)}</ol>
            {plans[message.planId]?.risks && <p className="mb-2 text-xs text-muted-foreground">Risc pe pași: {plans[message.planId].risks!.join(', ')}.</p>}
            {plans[message.planId]?.externalCostNote && <p className="mb-3 rounded-xl border border-amber-200 p-3 text-sm">{plans[message.planId].externalCostNote}</p>}
            {(!plans[message.planId] || plans[message.planId].status === 'pending') ? <div className="flex gap-2"><Button disabled={busy || !plans[message.planId]} onClick={() => execute(message.planId!)}><CheckCircle2 className="mr-2 h-4 w-4" />Execută planul</Button><Button disabled={busy || !plans[message.planId]} variant="outline" onClick={() => execute(message.planId!, true)}>Anulează</Button></div> : <div className="text-sm space-y-2">
              <p>Stare: {({ running: 'în execuție', completed: 'finalizat', cancelled: 'anulat', failed: 'oprit cu eroare', unknown: 'rezultat de verificat', pending: 'pregătit' })[plans[message.planId].status]}</p>
              {plans[message.planId].error && <p className="text-destructive">{plans[message.planId].error}</p>}
              {plans[message.planId].stoppedStep && <details className="rounded-xl border bg-background p-3"><summary className="cursor-pointer">Starea pasului oprit</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(plans[message.planId].stoppedStep, null, 2)}</pre></details>}
              <p>{plans[message.planId].results?.length || 0} pași confirmați.</p>
              {plans[message.planId].results?.map((step, index) => {
                const result = step.result as Record<string, unknown>;
                const link = safeLink(result?.link);
                return <div key={index} className="rounded-xl border bg-background p-3"><p>{index + 1}. {labels[step.kind as AssistantAction['kind']] || 'Acțiune CRM'} — confirmat</p>{result?.note ? <p className="mt-1 text-muted-foreground">{String(result.note)}</p> : null}{link && <a className="mt-1 inline-block text-emerald-700 underline" href={link} target="_blank" rel="noopener noreferrer">Deschide rezultatul</a>}{result?.artifactId ? <Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={() => downloadArtifact(result)}>Descarcă {String(result.fileName || 'PDF')}</Button> : null}</div>;
              })}
              {plans[message.planId].status === 'failed' && <Button variant="outline" disabled={busy} onClick={() => execute(message.planId!)}>Reia pașii rămași</Button>}
              {['running', 'unknown'].includes(plans[message.planId].status) && <Button variant="outline" disabled={busy} onClick={() => inspect(message.planId!)}>Verifică execuția</Button>}
              <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Detaliile rezultatelor</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(plans[message.planId].results || [], null, 2)}</pre></details>
            </div>}
          </div>}
        </article>)}
        {busy && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Verific datele și rezultatul cererii…</div>}
        <div ref={endRef} />
      </div>
      <footer className="border-t p-4">{error && <p role="alert" className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{!aiConfigured && <p className="mb-3 text-sm text-amber-700">Serviciul AI nu este configurat. Poți folosi căutarea structurată.</p>}<form className="flex gap-2" onSubmit={e => { e.preventDefault(); void send(); }}><Input aria-label="Comandă pentru AI Assistant" placeholder="Scrie ce vrei să rezolvi…" value={input} onChange={e => setInput(e.target.value)} disabled={busy || !user} maxLength={6000} /><Button aria-label="Trimite comanda" type="submit" disabled={busy || !input.trim() || !user}><Send className="h-4 w-4" /></Button></form><p className="mt-2 text-xs text-muted-foreground">Asistentul folosește permisiunile tale. Acțiunile pregătite au rezultat confirmat doar după execuție.</p></footer>
    </main>
    <aside className="w-full space-y-4 lg:w-80">
      <section className="rounded-3xl border bg-background p-5"><h2 className="mb-3 flex items-center gap-2 font-semibold"><Search className="h-4 w-4" />Caută în Anunțuri proprietari</h2><form className="space-y-3" onSubmit={e => { e.preventDefault(); void search({ source: 'owners', transactionType: 'sale', propertyType: 'apartment', zone: zone.trim() || undefined, priceMax: Number(priceMax), rooms: rooms ? Number(rooms) : undefined, limit: Number(count) }); }}><label className="block text-sm">Zonă<Input value={zone} onChange={e => setZone(e.target.value)} placeholder="Titan, Pipera…" /></label><label className="block text-sm">Buget maxim EUR<Input type="number" min="1" required value={priceMax} onChange={e => setPriceMax(e.target.value)} /></label><div className="grid grid-cols-2 gap-2"><label className="block text-sm">Camere<Input type="number" min="1" max="30" value={rooms} onChange={e => setRooms(e.target.value)} placeholder="Oricare" /></label><label className="block text-sm">Rezultate<Input type="number" min="1" max="100" required value={count} onChange={e => setCount(e.target.value)} /></label></div><Button className="w-full" type="submit" disabled={busy || !user}>Caută proprietăți</Button></form><p className="mt-3 text-xs text-muted-foreground">Căutarea parcurge datele de pe server. Portofoliul CRM apare separat.</p></section>
      <section className="rounded-3xl border bg-background p-5"><h2 className="mb-3 flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Conversații recente</h2><div className="max-h-80 space-y-1 overflow-auto">{sessions.map(session => <button key={session.id} disabled={busy} onClick={() => openSession(session.id)} className={'w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted ' + (session.id === sessionId ? 'bg-muted font-medium' : '')}>{session.title}</button>)}{!sessions.length && <p className="text-sm text-muted-foreground">Conversațiile cu asistentul se salvează aici.</p>}</div></section>
    </aside>
    {consent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="consent-title"><div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl"><div className="flex items-start justify-between"><h2 id="consent-title" className="text-lg font-semibold">Confirm acordul WhatsApp</h2><Button size="icon" variant="ghost" aria-label="Închide" onClick={() => setConsent(null)} disabled={busy}><X className="h-4 w-4" /></Button></div><p className="my-3 text-sm">{consent.title} • {consent.phone || 'Telefon indisponibil'}</p><label className="block text-sm">Număr WhatsApp al agenției<select className="my-2 w-full rounded-md border bg-background p-2" value={consent.connectionId} onChange={e => setConsent(c => c && ({ ...c, connectionId: e.target.value }))}>{consent.connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block text-sm">Scop<select className="my-2 w-full rounded-md border bg-background p-2" value={consent.purpose} onChange={e => setConsent(c => c && ({ ...c, purpose: e.target.value as Consent['purpose'] }))}><option value="marketing">Propunere de colaborare / marketing</option><option value="service">Comunicare de serviciu</option></select></label><label className="block text-sm">Data și ora apelului<input type="datetime-local" className="my-2 w-full rounded-md border bg-background p-2" value={consent.calledAt} onChange={e => setConsent(c => c && ({ ...c, calledAt: e.target.value }))} /></label>{!consent.connections.length && <p className="my-2 text-sm text-amber-700">Nu există un număr WhatsApp conectat al agenției.</p>}<label className="block text-sm">Ce a confirmat proprietarul în apel<textarea className="my-2 min-h-24 w-full rounded-md border bg-background p-2" value={consent.evidence} maxLength={2000} onChange={e => setConsent(c => c && ({ ...c, evidence: e.target.value }))} /></label><label className="my-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={consent.confirmed} onChange={e => setConsent(c => c && ({ ...c, confirmed: e.target.checked }))} /><span>Confirm că am obținut în apel acordul proprietarului pentru mesaje WhatsApp cu scopul selectat.</span></label>{error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy || !consent.confirmed || !consent.connectionId || !consent.phone || !consent.calledAt || consent.evidence.trim().length < 10} onClick={saveConsent}>Înregistrează acordul</Button></div></div>}
  </div>;
}
