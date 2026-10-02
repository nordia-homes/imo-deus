'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Connection } from '@/lib/communications/model';
import { useCommunications } from './useCommunications';
export default function WhatsAppTemplates({ connections, allowed }: { connections: Connection[]; allowed: boolean }) {
  const api = useCommunications();
  const [id, setId] = useState(''); const [rows, setRows] = useState<Array<{ name: string; language: string; status: string; category: string }>>([]);
  const [name, setName] = useState(''); const [body, setBody] = useState(''); const [language, setLanguage] = useState('ro'); const [category, setCategory] = useState('UTILITY');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  async function load(connectionId: string) { setRows((await api('templates/' + connectionId)).data || []); }
  async function act(fn: () => Promise<void>) { setBusy(true); setNotice(''); try { await fn(); } catch(e) { setNotice(e instanceof Error ? e.message : 'Operația a eșuat.'); } finally { setBusy(false); } }
  return <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Șabloane WhatsApp</h2>
    <select aria-label="Număr WhatsApp pentru șabloane" className="w-full rounded border p-2" value={id} disabled={busy} onChange={e => { const next = e.target.value; setId(next); setRows([]); if(next) void act(() => load(next)); }}><option value="">Alege numărul</option>{connections.filter(c => c.status === 'connected').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <Button variant="outline" disabled={!id || busy} onClick={() => void act(() => load(id))}>Actualizează șabloanele</Button>
    {rows.map(t => <div key={t.name + t.language} className="border-t py-2"><strong>{t.name}</strong><p>{t.language} · {t.category} · {t.status}</p></div>)}
    {allowed && <form className="space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); void act(async () => { const result = await api('templates/' + id, 'POST', { name, language, category, body }); setNotice('Șablon creat în Meta: ' + result.status + '. Trimiterea este disponibilă numai după aprobare.'); setName(''); setBody(''); await load(id); }); }}>
      <h3 className="font-semibold">Creează șablon text</h3><p className="text-sm text-slate-600">Meta verifică șablonul. Acest pas nu trimite aplicația la App Review. Pentru oferte și promovare alege Marketing.</p>
      <Input required aria-label="Nume șablon" placeholder="confirmare_solicitare" pattern="[a-z][a-z0-9_]{1,99}" maxLength={100} value={name} onChange={e => setName(e.target.value)} />
      <select aria-label="Limba șablonului" className="rounded border p-2" value={language} onChange={e => setLanguage(e.target.value)}><option value="ro">Română</option><option value="en_US">English (US)</option></select>
      <select aria-label="Categoria șablonului" className="rounded border p-2" value={category} onChange={e => setCategory(e.target.value)}><option value="UTILITY">Utility — solicitare sau tranzacție existentă</option><option value="MARKETING">Marketing — oferte/promovare</option></select>
      <textarea required aria-label="Textul șablonului" className="min-h-28 w-full rounded border p-2" maxLength={1024} placeholder="Text simplu, fără variabile, linkuri dinamice sau atașamente" value={body} onChange={e => setBody(e.target.value)} />
      <Button type="submit" disabled={busy || !id}>Creează șablonul în Meta</Button>
    </form>}{notice && <p role="status">{notice}</p>}
  </section>;
}
