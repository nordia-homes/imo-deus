'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { BuyerCollaborationListing } from '@/lib/collaboration/model';

function visitorId() {
  const key = 'imodeus-collaboration-visitor';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch { return crypto.randomUUID(); }
}

export function CollaborationBuyerPage({ listing, collaborator, token }: { listing: BuyerCollaborationListing; collaborator: { name: string; phone: string; email: string }; token: string }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' });
  const [kind, setKind] = useState<'message' | 'viewing'>('message');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [photo, setPhoto] = useState(0);
  const endpoint = `/api/collaboration/public/${encodeURIComponent(token)}`;
  useEffect(() => { void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'view', visitorId: visitorId() }) }); }, [endpoint]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, kind }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Solicitarea nu a fost trimisă.');
      setNotice('Solicitarea a ajuns la consultantul care ți-a trimis proprietatea.');
      setForm({ name: '', email: '', phone: '', message: '', website: '' });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'A apărut o eroare.'); }
    finally { setBusy(false); }
  }
  async function react(reaction: 'like' | 'dislike') {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'reaction', reaction, visitorId: visitorId() }) });
      if (!response.ok) throw new Error('Reacția nu a putut fi salvată.');
      setNotice(reaction === 'like' ? 'Am salvat aprecierea ta.' : 'Am salvat reacția ta.');
    } catch { setNotice('Reacția nu a putut fi salvată. Încearcă din nou.'); }
  }
  const phoneDigits = collaborator.phone.replace(/\D/g, '');
  const whatsappNumber = phoneDigits.startsWith('0') ? `40${phoneDigits.slice(1)}` : phoneDigits;
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><Link href="/" className="text-xl font-bold">ImoDeus<span className="text-emerald-400">.ai</span></Link><span className="text-sm text-slate-300">Proprietate prezentată de {collaborator.name}</span></header>
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
      {listing.images.length > 0 && <div className="relative h-72 bg-slate-800 sm:h-[470px]"><Image src={listing.images[photo]?.url || listing.images[0].url} alt={listing.images[photo]?.alt || listing.title} fill unoptimized className="object-cover" />{listing.images.length > 1 && <div className="absolute bottom-4 right-4 flex gap-2"><button className="rounded-full bg-black/70 px-4 py-2" onClick={() => setPhoto((photo + listing.images.length - 1) % listing.images.length)}>‹</button><button className="rounded-full bg-black/70 px-4 py-2" onClick={() => setPhoto((photo + 1) % listing.images.length)}>›</button></div>}</div>}
      <div className="space-y-4 p-6"><p className="text-sm uppercase tracking-widest text-emerald-400">{listing.transactionType} · {listing.propertyType}</p><h1 className="text-3xl font-bold">{listing.title}</h1><p className="text-2xl font-semibold">{listing.price.toLocaleString('ro-RO')} €</p><p className="text-slate-300">{[listing.city, listing.zone, `${listing.rooms} camere`, `${listing.squareFootage} m²`].filter(Boolean).join(' · ')}</p><p className="whitespace-pre-wrap text-slate-200">{listing.description}</p><div className="flex gap-3"><button onClick={() => void react('like')} className="rounded-full border border-white/20 px-4 py-2 hover:bg-white/10">Îmi place</button><button onClick={() => void react('dislike')} className="rounded-full border border-white/20 px-4 py-2 hover:bg-white/10">Nu mi se potrivește</button></div></div>
    </section>
    <section className="grid gap-5 md:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-bold">Consultantul tău</h2><p className="mt-3 text-lg">{collaborator.name}</p><p className="mt-1 text-slate-300">{collaborator.phone}</p><div className="mt-5 flex flex-wrap gap-3"><a className="rounded-full bg-emerald-500 px-5 py-3 font-semibold text-slate-950" href={`tel:${collaborator.phone}`}>Sună</a><a className="rounded-full border border-white/20 px-5 py-3" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">WhatsApp</a><a className="rounded-full border border-white/20 px-5 py-3" href={`mailto:${collaborator.email}`}>Email</a></div></div>
      <form onSubmit={submit} className="space-y-3 rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-bold">Scrie consultantului</h2><div className="flex gap-2"><button type="button" onClick={() => setKind('message')} className={`rounded-full px-4 py-2 ${kind === 'message' ? 'bg-emerald-500 text-slate-950' : 'bg-white/10'}`}>Mesaj</button><button type="button" onClick={() => setKind('viewing')} className={`rounded-full px-4 py-2 ${kind === 'viewing' ? 'bg-emerald-500 text-slate-950' : 'bg-white/10'}`}>Solicită vizionare</button></div><input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /><input required minLength={2} maxLength={120} placeholder="Nume" className="w-full rounded-xl bg-white/10 p-3" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input required type="email" placeholder="Email" className="w-full rounded-xl bg-white/10 p-3" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input required minLength={8} placeholder="Telefon" className="w-full rounded-xl bg-white/10 p-3" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><textarea required={kind === 'message'} placeholder="Mesajul tău" className="min-h-24 w-full rounded-xl bg-white/10 p-3" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /><button disabled={busy} className="w-full rounded-full bg-emerald-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Se trimite…' : kind === 'viewing' ? 'Trimite cererea de vizionare' : 'Trimite mesajul'}</button>{notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}</form></section>
  </div></main>;
}
