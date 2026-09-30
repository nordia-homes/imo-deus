'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { collaborationApi } from '@/lib/collaboration/client';
import type { CollaborationCase, CollaborationLead, CollaborationListing } from '@/lib/collaboration/model';

type Tab = 'catalog' | 'leads' | 'cases' | 'notifications' | 'profile';
type CollaborationNotification = { id: string; title: string; body: string; actionUrl: string; isRead: boolean; createdAt: string };

export default function CollaborationPage() {
  const router = useRouter();
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>('catalog');
  const [listings, setListings] = useState<CollaborationListing[]>([]);
  const [leads, setLeads] = useState<CollaborationLead[]>([]);
  const [cases, setCases] = useState<CollaborationCase[]>([]);
  const [notifications, setNotifications] = useState<CollaborationNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [accountType, setAccountType] = useState<'crm' | 'collaborator_only'>('crm');
  const [team, setTeam] = useState<{ uid: string; name: string; email: string; role: string; status: string }[]>([]);
  const [teamEmail, setTeamEmail] = useState(''); const [inviteUrl, setInviteUrl] = useState('');
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState<Record<string, boolean>>({});
  useEffect(() => { const value = new URLSearchParams(window.location.search).get('tab'); if (value === 'leads' || value === 'cases' || value === 'notifications') setTab(value); }, []);
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true); setError('');
    try {
      const [catalogResult, leadsResult, casesResult, notificationResult, meResult] = await Promise.all([
        collaborationApi<{ listings: CollaborationListing[]; nextCursor: string | null }>(user, '?view=catalog'),
        collaborationApi<{ leads: CollaborationLead[] }>(user, '?view=leads'),
        collaborationApi<{ cases: CollaborationCase[] }>(user, '?view=cases'),
        collaborationApi<{ notifications: CollaborationNotification[] }>(user, '?view=notifications'),
        collaborationApi<{ account: { name: string; phone: string; accountType: 'crm' | 'collaborator_only' } }>(user, '?view=me'),
      ]);
      setListings(catalogResult.listings); setNextCursor(catalogResult.nextCursor); setLeads(leadsResult.leads); setCases(casesResult.cases); setNotifications(notificationResult.notifications); setProfile({ name: meResult.account.name, phone: meResult.account.phone }); setAccountType(meResult.account.accountType);
      if (meResult.account.accountType === 'collaborator_only') { const token = await user.getIdToken(); const teamResponse = await fetch('/api/collaboration/team', { headers: { Authorization: `Bearer ${token}` } }); if (teamResponse.ok) { const teamData = await teamResponse.json(); setTeam(teamData.members || []); setCanManageTeam(teamData.canManage === true); } }
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Nu am putut încărca colaborările.'); }
    finally { setBusy(false); }
  }, [user]);
  async function loadMore() {
    if (!user || !nextCursor) return;
    try { const result = await collaborationApi<{ listings: CollaborationListing[]; nextCursor: string | null }>(user, `?view=catalog&cursor=${encodeURIComponent(nextCursor)}`); setListings(previous => [...previous, ...result.listings]); setNextCursor(result.nextCursor); }
    catch (e) { setError(e instanceof Error ? e.message : 'Nu am putut încărca următoarea pagină.'); }
  }
  async function saveProfile() {
    if (!user) return;
    try { await collaborationApi(user, '', { action: 'profile', ...profile }); setError('Profilul a fost salvat.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Profilul nu a putut fi salvat.'); }
  }
  async function inviteTeamMember() {
    if (!user) return;
    try { const response = await fetch('/api/collaboration/team', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite', email: teamEmail }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setInviteUrl(result.url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Invitația nu a putut fi creată.'); }
  }
  async function removeTeamMember(uid: string) {
    if (!user) return;
    try { const response = await fetch('/api/collaboration/team', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', uid }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setTeam(current => current.map(member => member.uid === uid ? { ...member, status: 'suspended' } : member)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Membrul nu a putut fi suspendat.'); }
  }
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => listings.filter(item => `${item.title} ${item.city} ${item.zone} ${item.propertyType}`.toLocaleLowerCase('ro').includes(query.toLocaleLowerCase('ro'))), [listings, query]);
  async function openCase(leadId: string) {
    if (!user) return;
    try { const result = await collaborationApi<{ case: CollaborationCase }>(user, '', { action: 'case', leadId, acceptedTerms: acceptedTerms[leadId] === true }); router.push(`/collaboration/cases/${result.case.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Nu am putut crea dosarul.'); }
  }
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm uppercase tracking-widest text-emerald-400">Rețeaua ImoDeus</p><h1 className="mt-1 text-3xl font-bold">Colaborări</h1><p className="mt-2 text-slate-300">Proprietățile deschise colaborării sunt disponibile tuturor colaboratorilor activi.</p></div><button onClick={() => void load()} className="rounded-full border border-white/20 px-4 py-2 text-sm">{busy ? 'Se încarcă…' : 'Actualizează'}</button></div><div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">{([['catalog','Proprietăți'],['leads','Cumpărătorii mei'],['cases','Dosare comune'],['notifications',`Notificări${notifications.filter(item => !item.isRead).length ? ` (${notifications.filter(item => !item.isRead).length})` : ''}`],['profile','Profil']] as const).map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm ${tab === key ? 'bg-emerald-500 font-semibold text-slate-950' : 'bg-white/10'}`}>{label}</button>)}</div>{error && <p role="alert" className="rounded-xl bg-red-900/30 p-4 text-red-200">{error}</p>}
    {tab === 'catalog' && <section className="space-y-5"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Caută după proprietate, oraș sau zonă" className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-900 p-3" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(item => <Link href={`/collaboration/properties/${item.id}`} key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 transition hover:border-emerald-400/60">{item.images[0] && <div className="relative h-52"><Image src={item.images[0].url} alt={item.images[0].alt || item.title} fill unoptimized className="object-cover" /></div>}<div className="space-y-2 p-5"><h2 className="text-xl font-semibold">{item.title}</h2><p className="text-emerald-300">{item.price.toLocaleString('ro-RO')} €</p><p className="text-sm text-slate-300">{item.city} · {item.zone} · {item.rooms} camere · {item.squareFootage} m²</p><p className="text-sm text-slate-400">Agent: {item.ownerAgentName}</p></div></Link>)}</div>{!filtered.length && <p className="text-slate-400">Nu există proprietăți care corespund căutării.</p>}{nextCursor && <button onClick={() => void loadMore()} className="rounded-full border border-white/20 px-5 py-2">Încarcă mai multe proprietăți</button>}</section>}
    {tab === 'leads' && <section className="space-y-3">{leads.map(lead => <article key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900 p-5"><div><p className="font-semibold">{lead.buyerName}</p><p className="text-sm text-slate-300">{lead.buyerPhone} · {lead.buyerEmail}</p><p className="mt-2 text-sm">{lead.kind === 'viewing' ? 'Solicitare vizionare' : 'Mesaj'}: {lead.message || '—'}</p><p className="mt-1 text-xs text-slate-400">{new Date(lead.createdAt).toLocaleString('ro-RO')}</p></div><div className="space-y-2"><label className="flex max-w-72 items-start gap-2 text-xs text-slate-300"><input type="checkbox" checked={acceptedTerms[lead.id] || false} onChange={e => setAcceptedTerms(current => ({ ...current, [lead.id]: e.target.checked }))} />Accept condițiile de colaborare afișate în fișa proprietății și transmit datele cumpărătorului agentului proprietății.</label><button disabled={!acceptedTerms[lead.id]} onClick={() => void openCase(lead.id)} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Deschide dosar comun</button></div></article>)}{!leads.length && <p className="text-slate-400">Nu ai încă solicitări din linkurile tale.</p>}</section>}
    {tab === 'cases' && <section className="space-y-3">{cases.map(item => <Link href={`/collaboration/cases/${item.id}`} key={item.id} className="block rounded-2xl border border-white/10 bg-slate-900 p-5 hover:border-emerald-400/60"><p className="font-semibold">{item.propertyTitle}</p><p className="text-sm text-slate-300">Colaborator: {item.collaboratorName} · Cumpărător: {item.buyerName}</p><p className="mt-2 text-sm text-emerald-300">{item.status}</p></Link>)}{!cases.length && <p className="text-slate-400">Nu există dosare comune.</p>}</section>}
    {tab === 'notifications' && <section className="space-y-3">{notifications.map(item => <button key={item.id} onClick={() => { if (!user) return; void collaborationApi(user, '', { action: 'read-notification', notificationId: item.id }).then(() => { setNotifications(previous => previous.map(n => n.id === item.id ? { ...n, isRead: true } : n)); window.location.href = item.actionUrl; }); }} className={`block w-full rounded-2xl border p-5 text-left ${item.isRead ? 'border-white/10 bg-slate-900' : 'border-emerald-400/50 bg-emerald-900/20'}`}><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-slate-300">{item.body}</p><p className="mt-2 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('ro-RO')}</p></button>)}{!notifications.length && <p className="text-slate-400">Nu ai notificări noi.</p>}</section>}
    {tab === 'profile' && <section className="max-w-xl space-y-4 rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-semibold">Datele afișate cumpărătorilor</h2><label className="block text-sm">Nume<input className="mt-1 w-full rounded-xl bg-white/10 p-3" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label><label className="block text-sm">Telefon profesional<input className="mt-1 w-full rounded-xl bg-white/10 p-3" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></label><button onClick={() => void saveProfile()} className="rounded-full bg-emerald-500 px-5 py-2 font-semibold text-slate-950">Salvează profilul</button>{accountType === 'collaborator_only' && <div className="space-y-3 border-t border-white/10 pt-5"><h3 className="font-semibold">Echipa agenției</h3>{team.map(member => <div key={member.uid} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-sm"><span>{member.name} · {member.email} · {member.status}</span>{canManageTeam && member.status === 'active' && member.role !== 'admin' && <button onClick={() => void removeTeamMember(member.uid)} className="text-red-300">Suspendă</button>}</div>)}{canManageTeam && <><label className="block text-sm">Invită un coleg<input type="email" placeholder="coleg@agentie.ro" className="mt-1 w-full rounded-xl bg-white/10 p-3" value={teamEmail} onChange={e => setTeamEmail(e.target.value)} /></label><button onClick={() => void inviteTeamMember()} disabled={!teamEmail} className="rounded-full border border-emerald-400 px-5 py-2">Generează invitație</button>{inviteUrl && <div className="space-y-2"><input readOnly value={inviteUrl} className="w-full rounded-xl bg-white/10 p-3 text-xs" /><button onClick={() => void navigator.clipboard.writeText(inviteUrl)} className="text-emerald-300">Copiază linkul de invitație</button></div>}</>}</div>}</section>}
  </main>;
}
