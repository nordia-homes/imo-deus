'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { collaborationApi } from '@/lib/collaboration/client';
import type { CollaborationLink, CollaborationListing } from '@/lib/collaboration/model';

export default function CollaborationPropertyPage() {
  const { user } = useUser(); const params = useParams(); const id = String(params?.listingId || '');
  const [listing, setListing] = useState<CollaborationListing | null>(null);
  const [link, setLink] = useState<CollaborationLink | null>(null);
  const [activity, setActivity] = useState({ views: 0, likes: 0, dislikes: 0 });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const [property, ownLink, linkActivity] = await Promise.all([collaborationApi<{ listing: CollaborationListing }>(user, `?view=listing&id=${encodeURIComponent(id)}`), collaborationApi<{ link: CollaborationLink | null }>(user, `?view=link&id=${encodeURIComponent(id)}`), collaborationApi<{ views: number; likes: number; dislikes: number }>(user, `?view=link-activity&id=${encodeURIComponent(id)}`)]);
      setListing(property.listing); setLink(ownLink.link); setActivity(linkActivity);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Proprietatea nu a putut fi încărcată.'); }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);
  async function generate() {
    if (!user) return;
    setBusy(true); setError('');
    try { const result = await collaborationApi<{ link: CollaborationLink }>(user, '', { action: 'link', listingId: id }); setLink(result.link); }
    catch (e) { setError(e instanceof Error ? e.message : 'Linkul nu a putut fi generat.'); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!user || !link) return;
    setBusy(true);
    try { await collaborationApi(user, '', { action: 'revoke-link', linkId: link.id }); setLink(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Linkul nu a putut fi revocat.'); }
    finally { setBusy(false); }
  }
  const url = link && typeof window !== 'undefined' ? `${window.location.origin}/c/${link.id}` : '';
  if (error && !listing) return <main className="mx-auto max-w-5xl p-6"><Link href="/collaboration" className="text-emerald-300">← Catalog</Link><p className="mt-5">{error}</p></main>;
  if (!listing) return <main className="mx-auto max-w-5xl p-6">Se încarcă proprietatea…</main>;
  const digits = listing.ownerAgentPhone.replace(/\D/g, ''); const whatsapp = digits.startsWith('0') ? `40${digits.slice(1)}` : digits;
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8"><Link href="/collaboration" className="text-sm text-emerald-300">← Înapoi la catalog</Link><div className="grid gap-5 md:grid-cols-2">{listing.images.map((image,index) => <div key={`${image.url}-${index}`} className="relative h-64 overflow-hidden rounded-2xl bg-slate-800"><Image src={image.url} alt={image.alt || listing.title} fill unoptimized className="object-cover" /></div>)}</div><section className="rounded-3xl border border-white/10 bg-slate-900 p-6"><h1 className="text-3xl font-bold">{listing.title}</h1><p className="mt-3 text-2xl text-emerald-300">{listing.price.toLocaleString('ro-RO')} €</p><p className="mt-2 text-slate-300">{listing.city} · {listing.zone} · {listing.rooms} camere · {listing.squareFootage} m²</p><p className="mt-5 whitespace-pre-wrap">{listing.description}</p><div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-900/10 p-4"><h2 className="font-semibold">Condiții de colaborare</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{listing.terms}</p></div></section><section className="grid gap-5 md:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-semibold">Agentul proprietății</h2><p className="mt-3">{listing.ownerAgentName} · {listing.ownerAgencyName}</p><p className="mt-1 text-slate-300">{listing.ownerAgentPhone}</p><div className="mt-5 flex flex-wrap gap-2"><a href={`tel:${listing.ownerAgentPhone}`} className="rounded-full bg-emerald-500 px-4 py-2 text-slate-950">Sună</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 px-4 py-2">WhatsApp</a>{listing.ownerAgentEmail && <a href={`mailto:${listing.ownerAgentEmail}`} className="rounded-full border border-white/20 px-4 py-2">Email</a>}</div></div><div className="rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-semibold">Link pentru cumpărătorii tăi</h2><p className="mt-2 text-sm text-slate-300">Cumpărătorii vor vedea datele tale de contact. Solicitările lor vor ajunge în contul tău.</p>{link ? <div className="mt-5 space-y-3"><input readOnly value={url} className="w-full rounded-xl bg-white/10 p-3 text-sm" /><p className="text-sm text-slate-300">{activity.views} vizite · {activity.likes} aprecieri · {activity.dislikes} reacții negative</p><div className="flex gap-2"><button onClick={() => void navigator.clipboard.writeText(url)} className="rounded-full bg-emerald-500 px-4 py-2 text-slate-950">Copiază</button><button onClick={() => void revoke()} disabled={busy} className="rounded-full border border-red-400 px-4 py-2 text-red-200">Revocă</button></div></div> : <button onClick={() => void generate()} disabled={busy} className="mt-5 rounded-full bg-emerald-500 px-4 py-2 text-slate-950">Generează link unic</button>}{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}</div></section></main>;
}
